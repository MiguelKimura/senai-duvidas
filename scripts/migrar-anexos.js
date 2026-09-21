#!/usr/bin/env node
/*
 * Preenche o campo `anexo` a partir do `imagem` antigo — task 04.
 *
 * Uso:
 *   node scripts/migrar-anexos.js --dry-run
 *   node scripts/migrar-anexos.js --confirmar
 *   node scripts/migrar-anexos.js --colecao salas/sala-3b/chamados --confirmar
 *   node scripts/migrar-anexos.js --reverter --confirmar
 *
 * POR QUE ESTE SCRIPT EXISTE — E POR QUE ELE É OPCIONAL
 *
 * Até a v0.5.0 o anexo de um chamado era uma string de URL no campo `imagem`.
 * A v0.6.0 grava **os dois**: `imagem` como sempre, e `anexo` em objeto ao
 * lado, com o caminho no Storage e as dimensões da imagem.
 *
 * O app lê os dois formatos sozinho — é o que `normalizarAnexo` faz, em
 * `src/services/anexos.js`, permanentemente nesta versão. Então nada quebra se
 * este script nunca rodar. O que ele compra é **homogeneidade**: com `anexo`
 * preenchido em todo documento, a 1.0.0 pode parar de gravar `imagem` sem
 * precisar de uma migração no dia do deploy, com o laboratório em aula.
 *
 * É a etapa 1 da migração em duas fases da seção 4 do `tasks/_PROTOCOLO.md`:
 * escrever nos dois formatos (v0.6.0) → migrar (este script) → parar de
 * escrever no antigo (1.0.0).
 *
 * O QUE ELE NUNCA FAZ
 *
 * **Não toca em `imagem`.** Nem para alterar, nem para apagar. `imagem` é o
 * campo que todo cliente já aberto no laboratório procura, e é o backup vivo
 * do `anexo` que este script deriva. Ele sai na 1.0.0, por outro caminho.
 *
 * IDEMPOTÊNCIA
 *
 * "Já migrei este documento?" é a pergunta "ele já tem `anexo`?". Quem tem
 * fica de fora do plano, então a segunda rodada não tem o que fazer e uma
 * rodada interrompida no meio termina na seguinte.
 *
 * REVERSÃO
 *
 * `--reverter` apaga o `anexo` de origem `url` — exatamente o que este script
 * cria — e deixa `imagem` intacto, que é de onde ele saiu. Anexo de origem
 * `upload` não é tocado: ele não veio de `imagem`, nasceu assim, e apagá-lo
 * perderia o `caminho` do arquivo, a única pista que a exclusão do chamado tem
 * para não deixar órfão no Storage (AC-CHAMADO-08).
 *
 * DESENHO
 *
 * As funções puras decidem o que fazer e são testadas em
 * `scripts/__tests__/migrar-anexos.test.js`. A casca no fim do arquivo fala
 * com o Firestore e não tem regra nenhuma.
 *
 * A regra de "o que é um anexo" está duplicada aqui e em
 * `src/services/anexos.js`, de propósito: aquele módulo importa o SDK do
 * Firebase para o navegador e não carrega em Node. A duplicação é o risco
 * desta migração, e o teste a vigia comparando a saída deste script com a de
 * `normalizarAnexo` — se as duas divergirem, quebra na suíte, não no banco.
 */

/** O valor de `origem` do anexo que é só um endereço na internet. */
const ORIGEM_DE_URL = 'url';

/** O valor de `origem` do anexo que o aluno subiu, e que tem `caminho`. */
const ORIGEM_DE_UPLOAD = 'upload';

/** A coleção migrada quando ninguém passa `--colecao`. */
const COLECAO_PADRAO = 'chamados';

/**
 * A string é um endereço de imagem que vale a pena copiar?
 *
 * Espelha `ehUrlDeImagem` de `src/services/anexos.js`: permissivo quanto ao
 * caminho, porque encurtador e serviço de print não põem extensão nenhuma na
 * URL, e estrito quanto ao **esquema**, porque `javascript:` não é anexo.
 *
 * Campo sujo existe: alguém colou a descrição do erro no lugar do link.
 * Copiar aquilo para `anexo` só espalharia o problema para o formato novo.
 */
function ehUrlDeImagem(url) {
  if (typeof url !== 'string' || url.trim() === '') return false;

  try {
    const { protocol, href } = new URL(url.trim());

    if (protocol === 'http:' || protocol === 'https:') return true;

    return protocol === 'data:' && href.startsWith('data:image/');
  } catch (_erro) {
    return false;
  }
}

/** O anexo já gravado no documento, no formato objeto, ou `null`. */
function anexoDo(dados) {
  const anexo = dados && dados.anexo;

  return anexo && anexo.url ? anexo : null;
}

/**
 * Decide, sem gravar nada, quem precisa de `anexo` e quem não precisa.
 *
 * As quatro saídas são mutuamente exclusivas e somam `total`, para que o
 * relatório feche: ou o documento entra em `aMigrar`, ou ele já tinha `anexo`,
 * ou não tem imagem nenhuma, ou o que está em `imagem` não é um endereço.
 *
 * @param {Array<{id: string, dados: object}>} documentos
 * @returns {{total: number, aMigrar: Array<{id: string, campos: object}>,
 *   jaTinham: number, semAnexo: number, ilegiveis: number}}
 */
function planejar(documentos) {
  const plano = {
    total: documentos.length,
    aMigrar: [],
    jaTinham: 0,
    semAnexo: 0,
    ilegiveis: 0,
  };

  documentos.forEach(({ id, dados }) => {
    if (anexoDo(dados)) {
      plano.jaTinham += 1;
      return;
    }

    const imagem = dados && dados.imagem;

    if (!imagem) {
      plano.semAnexo += 1;
      return;
    }

    if (!ehUrlDeImagem(imagem)) {
      plano.ilegiveis += 1;
      return;
    }

    plano.aMigrar.push({ id, campos: { anexo: { url: imagem, origem: ORIGEM_DE_URL } } });
  });

  return plano;
}

/**
 * Decide o que a reversão apaga (`--reverter`).
 *
 * Só sai o anexo de origem `url`, que é o que este script cria e que tem o
 * `imagem` original ao lado como backup. `caminho` é o critério de parada mais
 * duro: um anexo que tem caminho no Storage aponta para um arquivo real, e
 * perder o caminho é perder o único jeito de apagar o arquivo depois.
 *
 * @param {Array<{id: string, dados: object}>} documentos
 */
function planejarReversao(documentos) {
  const plano = { total: documentos.length, aMigrar: [], jaTinham: 0, semAnexo: 0, ilegiveis: 0 };

  documentos.forEach(({ id, dados }) => {
    const anexo = anexoDo(dados);

    if (!anexo) {
      plano.semAnexo += 1;
      return;
    }

    if (anexo.origem !== ORIGEM_DE_URL || anexo.caminho) {
      plano.jaTinham += 1;
      return;
    }

    plano.aMigrar.push({ id, campos: { anexo: null } });
  });

  return plano;
}

/**
 * Executa o plano, um documento por vez.
 *
 * Sequencial de propósito, como nas migrações anteriores: o volume é pequeno e
 * uma rajada paralela contra o Firestore gasta cota sem ganhar nada.
 *
 * Falha de um documento não interrompe os outros. Uma migração que para no
 * meio deixa o banco num estado que ninguém sabe descrever; esta vai até o fim
 * e devolve a lista do que não deu — e a rodada seguinte pega o que faltou.
 *
 * @param {object} opcoes
 * @param {Array<{id: string, dados: object}>} opcoes.documentos
 * @param {(id: string, campos: object) => Promise<void>} opcoes.gravar
 * @param {boolean} [opcoes.simulacao] `--dry-run`: conta, e não grava.
 * @param {boolean} [opcoes.reverter]
 * @param {string} [opcoes.colecao] só para o relatório.
 */
async function migrar({
  documentos = [],
  gravar,
  simulacao = false,
  reverter = false,
  colecao = COLECAO_PADRAO,
} = {}) {
  const plano = reverter ? planejarReversao(documentos) : planejar(documentos);
  const falhas = [];
  let atualizados = 0;

  for (const { id, campos } of plano.aMigrar) {
    if (simulacao) {
      atualizados += 1;
      continue;
    }

    try {
      await gravar(id, campos);
      atualizados += 1;
    } catch (erro) {
      falhas.push({ id, erro: erro.message });
    }
  }

  return {
    colecao,
    total: plano.total,
    atualizados,
    jaTinham: plano.jaTinham,
    semAnexo: plano.semAnexo,
    ilegiveis: plano.ilegiveis,
    falhas,
    simulacao,
    reverter,
  };
}

/**
 * Lê os argumentos da linha de comando.
 *
 * `--confirmar` existe porque o padrão seguro de um script que escreve em
 * produção não pode ser escrever: sem bandeira nenhuma, ele não faz nada.
 */
function lerOpcoes(argumentos = []) {
  const colecoes = argumentos.reduce(
    (encontradas, argumento, posicao) =>
      argumento === '--colecao' && argumentos[posicao + 1]
        ? [...encontradas, argumentos[posicao + 1]]
        : encontradas,
    []
  );

  return {
    simulacao: argumentos.includes('--dry-run'),
    confirmado: argumentos.includes('--confirmar'),
    reverter: argumentos.includes('--reverter'),
    colecoes: colecoes.length > 0 ? colecoes : [COLECAO_PADRAO],
  };
}

/** O relatório que a pessoa que rodou o script lê. */
function formatarRelatorio(relatorio) {
  const { colecao, total, atualizados, jaTinham, semAnexo, ilegiveis, falhas, simulacao, reverter } =
    relatorio;

  const verbo = reverter ? 'perderiam o anexo' : 'receberiam anexo';
  const feito = reverter ? 'perderam o anexo' : 'receberam anexo';

  const linhas = [
    `${colecao}: ${total} lidos`,
    simulacao
      ? `  ${atualizados} ${verbo} (simulação: --dry-run, nada foi gravado)`
      : `  ${atualizados} ${feito}`,
    `  ${jaTinham} já estavam no formato novo`,
    `  ${semAnexo} sem imagem nenhuma`,
  ];

  if (ilegiveis > 0) {
    linhas.push(`  ${ilegiveis} com 'imagem' que não é endereço — deixados como estão`);
  }

  linhas.push("  O campo 'imagem' NÃO foi tocado: ele é o backup até a 1.0.0.");

  if (falhas.length > 0) {
    linhas.push(`  ${falhas.length} falharam:`);
    falhas.forEach(({ id, erro }) => linhas.push(`    ${id}: ${erro}`));
  }

  return linhas.join('\n');
}

/* c8 ignore start -- casca de I/O: sem regra, e sem como testar sem o Admin SDK */
async function lerColecao(db, caminho) {
  const snapshot = await db.collection(caminho).get();

  return snapshot.docs.map((documento) => ({ id: documento.id, dados: documento.data() }));
}

async function principal(argumentos) {
  const { simulacao, confirmado, reverter, colecoes } = lerOpcoes(argumentos);

  if (!simulacao && !confirmado) {
    process.stdout.write(
      'Nada foi feito. Rode com --dry-run para ver o que mudaria, ' +
        'ou com --confirmar para gravar.\n'
    );
    return;
  }

  const admin = require('firebase-admin');

  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();

  for (const colecao of colecoes) {
    const relatorio = await migrar({
      documentos: await lerColecao(db, colecao),
      // `update` de um campo só, e nunca `set`: `set` sem merge apagaria o
      // documento inteiro, `imagem` incluído.
      gravar: (id, campos) => db.doc(`${colecao}/${id}`).update(campos),
      simulacao,
      reverter,
      colecao,
    });

    process.stdout.write(`${formatarRelatorio(relatorio)}\n`);
    if (relatorio.falhas.length > 0) process.exitCode = 1;
  }
}

if (require.main === module) {
  principal(process.argv.slice(2)).catch((erro) => {
    process.stderr.write(`${erro.stack}\n`);
    process.exitCode = 1;
  });
}
/* c8 ignore stop */

module.exports = {
  COLECAO_PADRAO,
  ORIGEM_DE_UPLOAD,
  ORIGEM_DE_URL,
  ehUrlDeImagem,
  formatarRelatorio,
  lerOpcoes,
  migrar,
  planejar,
  planejarReversao,
};
