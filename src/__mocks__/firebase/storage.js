// Fake do `firebase/storage`, aplicado automaticamente pelo Jest.
//
// Até a v0.5.0 este fake guardava o mínimo: `uploadBytes` e `getDownloadURL`,
// porque o único cliente era a `uploadImage` órfã de `src/firebase.js`. A task
// 04 traz o upload de verdade, e com ele três coisas que o fake precisa saber
// imitar para que os critérios possam ser provados sem navegador:
//
//   * **progresso** — o `UploadTask` emite `state_changed` enquanto sobe, e é
//     disso que a barra do AC-IMG-08 vive;
//   * **cancelamento** — `task.cancel()` interrompe a subida e o erro chega
//     com `storage/canceled`, que a tela não pode tratar como falha de rede;
//   * **listar e apagar** — a exclusão do chamado varre a pasta do anexo e
//     apaga o que achar (AC-CHAMADO-08).
//
// Nada aqui fala com a rede. Os testes de Storage Rules de verdade rodam no
// emulador, em `tests/rules/storage.rules.test.js`.

let arquivos = new Map();

/** @type {Array<object>} tarefas de upload ainda não concluídas. */
let tarefas = [];

/** Quando ligado, o upload fica parado até o teste mandá-lo seguir. */
let segurandoUploads = false;

/**
 * Código de erro que derruba todo upload, inclusive os que ainda não
 * começaram.
 *
 * Existe para tirar a corrida dos testes de falha: a tela mostra "0%" assim
 * que o arquivo é escolhido, mas o upload só chega ao Storage depois de ler os
 * magic bytes e comprimir a imagem. Mandar falhar nesse intervalo não faria
 * nada, e o teste passaria ou não conforme a carga da máquina.
 */
let modoDeFalha = null;

export function getStorage() {
  return { __tipo: 'storage-fake' };
}

export function ref(storageOuRef, caminho) {
  const prefixo =
    storageOuRef && storageOuRef.__tipo === 'storage-ref' ? `${storageOuRef.__caminho}/` : '';
  const completo = `${prefixo}${caminho || ''}`.replace(/\/$/, '');

  return {
    __tipo: 'storage-ref',
    __caminho: completo,
    fullPath: completo,
    name: completo.slice(completo.lastIndexOf('/') + 1),
  };
}

export async function uploadBytes(referencia, arquivo) {
  arquivos.set(referencia.__caminho, arquivo);

  return { ref: referencia };
}

export async function getDownloadURL(referencia) {
  if (!arquivos.has(referencia.__caminho)) {
    const erro = new Error('Objeto não encontrado no Storage.');
    erro.code = 'storage/object-not-found';
    throw erro;
  }

  return `https://fake.storage/${referencia.__caminho}`;
}

export async function deleteObject(referencia) {
  if (!arquivos.has(referencia.__caminho)) {
    const erro = new Error('Objeto não encontrado no Storage.');
    erro.code = 'storage/object-not-found';
    throw erro;
  }

  arquivos.delete(referencia.__caminho);
}

/**
 * Lista o que existe sob um prefixo, como o SDK real.
 *
 * O Storage não tem pastas: o que parece pasta é prefixo de nome. `listAll`
 * devolve os objetos cujo caminho começa com o da referência.
 */
export async function listAll(referencia) {
  const prefixo = `${referencia.__caminho}/`;

  return {
    prefixes: [],
    items: [...arquivos.keys()]
      .filter((caminho) => caminho.startsWith(prefixo))
      .map((caminho) => ref({ __tipo: 'storage-fake' }, caminho)),
  };
}

/** Erro do SDK, com o `code` que a aplicação usa para se decidir. */
function erroDeStorage(codigo, mensagem) {
  const erro = new Error(mensagem);
  erro.code = codigo;
  return erro;
}

/**
 * Sobe o arquivo em partes, devolvendo a tarefa que a tela acompanha.
 *
 * A tarefa é "thenable" como a do SDK: dá para `await` nela direto, e ao mesmo
 * tempo ela emite progresso por `on('state_changed', ...)`.
 */
export function uploadBytesResumable(referencia, dados, metadados = {}) {
  const total = (dados && dados.size) || 0;
  let resolverPromessa;
  let rejeitarPromessa;

  const promessa = new Promise((resolver, rejeitar) => {
    resolverPromessa = resolver;
    rejeitarPromessa = rejeitar;
  });
  // Ninguém observa a promessa antes de `enviarAnexo` fazer `await`; sem isto
  // o Node reclamaria de rejeição não tratada no teste de cancelamento.
  promessa.catch(() => {});

  const ouvintes = [];

  const tarefa = {
    __tipo: 'upload-task',
    __referencia: referencia,
    __dados: dados,
    __metadados: metadados,
    snapshot: { bytesTransferred: 0, totalBytes: total, state: 'running', ref: referencia },

    on(_evento, proximo, aoFalhar, aoConcluir) {
      ouvintes.push({ proximo, aoFalhar, aoConcluir });

      return () => {
        const indice = ouvintes.findIndex((ouvinte) => ouvinte.proximo === proximo);
        if (indice >= 0) ouvintes.splice(indice, 1);
      };
    },

    cancel() {
      if (tarefa.snapshot.state !== 'running') return false;

      tarefa.snapshot = { ...tarefa.snapshot, state: 'canceled' };
      tarefas = tarefas.filter((pendente) => pendente !== tarefa);

      const erro = erroDeStorage('storage/canceled', 'Upload cancelado pelo usuario.');
      ouvintes.forEach((ouvinte) => ouvinte.aoFalhar && ouvinte.aoFalhar(erro));
      rejeitarPromessa(erro);

      return true;
    },

    then: (aoResolver, aoRejeitar) => promessa.then(aoResolver, aoRejeitar),
    catch: (aoRejeitar) => promessa.catch(aoRejeitar),

    __emitir(bytes) {
      tarefa.snapshot = { ...tarefa.snapshot, bytesTransferred: bytes };
      ouvintes.forEach((ouvinte) => ouvinte.proximo && ouvinte.proximo(tarefa.snapshot));
    },

    __concluir() {
      if (tarefa.snapshot.state !== 'running') return;

      tarefa.__emitir(Math.round(total / 2));
      tarefa.__emitir(total);

      arquivos.set(referencia.__caminho, dados);
      tarefa.snapshot = { ...tarefa.snapshot, state: 'success' };
      tarefas = tarefas.filter((pendente) => pendente !== tarefa);

      ouvintes.forEach((ouvinte) => ouvinte.aoConcluir && ouvinte.aoConcluir());
      resolverPromessa({ ref: referencia, metadata: metadados });
    },

    __falhar(codigo = 'storage/retry-limit-exceeded') {
      if (tarefa.snapshot.state !== 'running') return;

      tarefa.snapshot = { ...tarefa.snapshot, state: 'error' };
      tarefas = tarefas.filter((pendente) => pendente !== tarefa);

      const erro = erroDeStorage(codigo, 'Falha ao enviar o arquivo.');
      ouvintes.forEach((ouvinte) => ouvinte.aoFalhar && ouvinte.aoFalhar(erro));
      rejeitarPromessa(erro);
    },
  };

  tarefas.push(tarefa);

  if (modoDeFalha) {
    setTimeout(() => tarefa.__falhar(modoDeFalha), 0);
  } else if (!segurandoUploads) {
    // Sem `__segurarUploads()`, a subida termina sozinha na próxima volta do
    // laço de eventos — que é o caminho feliz da maioria dos testes.
    setTimeout(() => tarefa.__concluir(), 0);
  }

  return tarefa;
}

// --- controles de teste -----------------------------------------------------

export function __resetarStorage() {
  arquivos = new Map();
  tarefas = [];
  segurandoUploads = false;
  modoDeFalha = null;
}

export function __arquivosEnviados() {
  return [...arquivos.keys()];
}

/** Popula o Storage sem passar por upload nenhum. */
export function __semearArquivos(caminhos) {
  caminhos.forEach((caminho) => arquivos.set(caminho, new Blob(['conteudo'])));
}

/** Faz os próximos uploads ficarem parados até `__concluirUploads()`. */
export function __segurarUploads() {
  segurandoUploads = true;
}

/** As tarefas de upload que ainda não terminaram. */
export function __uploadsPendentes() {
  return [...tarefas];
}

/** Emite progresso parcial em todas as tarefas paradas. */
export function __avancarUploads(fracao = 0.5) {
  [...tarefas].forEach((tarefa) =>
    tarefa.__emitir(Math.round(tarefa.snapshot.totalBytes * fracao))
  );
}

/** Conclui todas as tarefas paradas, como o servidor faria ao aceitar os bytes. */
export function __concluirUploads() {
  [...tarefas].forEach((tarefa) => tarefa.__concluir());
}

/** Faz todas as tarefas paradas falharem, como uma rede de laboratório faria. */
export function __falharUploads(codigo) {
  [...tarefas].forEach((tarefa) => tarefa.__falhar(codigo));
}

/**
 * Derruba todo upload, inclusive os que ainda nem começaram.
 *
 * É a rede de laboratório que caiu e continua caída — e é o que deixa o teste
 * de falha independer de quando o arquivo terminou de ser comprimido.
 */
export function __derrubarUploads(codigo = 'storage/retry-limit-exceeded') {
  modoDeFalha = codigo;
  __falharUploads(codigo);
}

/** Devolve a rede: os próximos uploads voltam a terminar normalmente. */
export function __restaurarRede() {
  modoDeFalha = null;
}
