// O banco de cada teste end-to-end, semeado por REST — AC-TEST-06, AC-TEST-09.
//
// Duas decisões que valem ser lidas antes de mexer aqui.
//
// **1. A semeadura não passa pela interface.** Um teste que criasse a sala
// clicando, entrasse com o PIN clicando e abrisse trinta chamados clicando
// levaria minutos e falharia por qualquer motivo no caminho — e o defeito
// apareceria no teste do chat, apontando para a tela de criar sala. Cada spec
// clica **no fluxo que ele testa** e recebe o resto pronto.
//
// **2. Nada de SDK aqui.** A alternativa era `@firebase/rules-unit-testing`,
// que já é devDependency. Ela traz o SDK inteiro para dentro do processo do
// Playwright, e o SDK mantém conexão viva com o emulador — que é exatamente o
// que faz um `emulators:exec` não terminar depois do último teste. O REST do
// emulador é `fetch` e mais nada: sem conexão para vazar, sem processo preso.
//
// A guarda de projeto é a mesma de `tests/rules/projetoDeTeste.js`, e pela
// mesma razão: estes helpers **apagam o banco inteiro** antes de cada arquivo.
// Rodar isso contra o projeto da escola apagaria uma aula em andamento.
const { PROJETO_DE_TESTE, PROJETO_DE_PRODUCAO } = require('../../rules/projetoDeTeste');

/** O host dos emuladores, configurável para duas sessões não disputarem a porta. */
const HOST = process.env.EMULADOR_HOST || '127.0.0.1';

const PORTA_AUTH = Number(process.env.EMULADOR_PORTA_AUTH || 9099);
const PORTA_FIRESTORE = Number(process.env.EMULADOR_PORTA_FIRESTORE || 8080);
const PORTA_STORAGE = Number(process.env.EMULADOR_PORTA_STORAGE || 9199);

/** O endereço do app servido para o navegador. */
const ENDERECO_DO_APP = process.env.E2E_ENDERECO || `http://${HOST}:3100`;

/**
 * O projeto contra o qual tudo isto roda, conferido a cada chamada.
 *
 * A conferência não é paranoia decorativa: o `projectId` sai de variável de
 * ambiente em três lugares diferentes (o build do app, o emulador e estes
 * helpers), e é fácil um deles apontar para outro lugar.
 */
function projeto() {
  if (PROJETO_DE_TESTE === PROJETO_DE_PRODUCAO || !PROJETO_DE_TESTE.startsWith('demo-')) {
    throw new Error(
      `projectId "${PROJETO_DE_TESTE}" não é um projeto de emulador: os testes apagam o banco.`
    );
  }

  return PROJETO_DE_TESTE;
}

const baseFirestore = () =>
  `http://${HOST}:${PORTA_FIRESTORE}/v1/projects/${projeto()}/databases/(default)/documents`;

const baseAuth = () => `http://${HOST}:${PORTA_AUTH}/identitytoolkit.googleapis.com/v1`;

/** `owner` é o token que o emulador aceita como administrador. */
const CABECALHOS = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };

/** Uma chamada ao emulador que grita quando falha, em vez de seguir em frente. */
async function chamar(url, opcoes = {}) {
  const resposta = await fetch(url, { headers: CABECALHOS, ...opcoes });

  if (!resposta.ok) {
    const corpo = await resposta.text();

    throw new Error(`${opcoes.method || 'GET'} ${url} respondeu ${resposta.status}: ${corpo}`);
  }

  return resposta.status === 204 ? null : resposta.json().catch(() => null);
}

// ---------------------------------------------------------------------------
// Conversão para o formato de valores do Firestore
// ---------------------------------------------------------------------------
//
// O REST do Firestore não aceita JSON comum: cada campo precisa dizer de que
// tipo é. A conversão mora aqui, em uma função, porque cada spec que a
// reescrevesse erraria o `timestampValue` do próprio jeito.

/** Um valor JavaScript no formato que o REST do Firestore espera. */
function valor(dado) {
  if (dado === null || dado === undefined) return { nullValue: null };
  if (dado instanceof Date) return { timestampValue: dado.toISOString() };
  if (typeof dado === 'boolean') return { booleanValue: dado };
  if (typeof dado === 'number') {
    return Number.isInteger(dado) ? { integerValue: String(dado) } : { doubleValue: dado };
  }
  if (typeof dado === 'string') return { stringValue: dado };
  if (Array.isArray(dado)) return { arrayValue: { values: dado.map(valor) } };

  return { mapValue: { fields: campos(dado) } };
}

/** Um objeto inteiro, campo por campo. */
function campos(objeto) {
  return Object.entries(objeto).reduce((acumulado, [nome, dado]) => {
    acumulado[nome] = valor(dado);

    return acumulado;
  }, {});
}

// ---------------------------------------------------------------------------
// As operações que os specs usam
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Esperar os três emuladores, e não só o primeiro
// ---------------------------------------------------------------------------
//
// O `webServer` do Playwright sabe esperar **uma** URL, e o emulador do
// Firestore — que é Java — abre a porta 8080 bem antes de o Auth abrir a 9099.
// Com a espera em 8080, o primeiro `beforeEach` da suíte morria em
// `ECONNREFUSED 127.0.0.1:9099` de forma intermitente: passava quando a máquina
// estava fria e a subida era lenta, falhava quando era rápida.
//
// Esta função é a espera que faltava. Ela é por **condição**, nunca por tempo
// fixo — o AC-TEST-09 proíbe `sleep`, e um `sleep` aqui teria exatamente o
// defeito que se está corrigindo: escolher um número que é grande demais numa
// máquina e pequeno demais na outra.

/** Os três emuladores que a suíte usa, com uma URL que responde quando sobem. */
const SONDAS = [
  ['Auth', () => `http://${HOST}:${PORTA_AUTH}/`],
  ['Firestore', () => `http://${HOST}:${PORTA_FIRESTORE}/`],
  ['Storage', () => `http://${HOST}:${PORTA_STORAGE}/`],
];

/** Por quanto tempo esperar a subida, no total. */
const ESPERA_MAXIMA_MS = 180000;

/** O intervalo entre duas sondagens. Não é espera cega: é o passo do laço. */
const PASSO_DA_SONDAGEM_MS = 250;

let prontidao = null;

/** Uma sondagem: `true` quando a porta responde qualquer coisa. */
async function respondeu(url) {
  try {
    await fetch(url, { method: 'GET' });

    return true;
  } catch (_erro) {
    return false;
  }
}

/**
 * O estado das três portas, para o erro poder dizer quem está de pé.
 *
 * A sondagem entra por parâmetro para que o teste prove a varredura sem rede e
 * sem emulador.
 *
 * @param {(url: string) => Promise<boolean>} [sonda]
 * @returns {Promise<Array<{nome: string, respondeu: boolean}>>}
 */
async function varrerSondas(sonda = respondeu) {
  return Promise.all(
    SONDAS.map(async ([nome, endereco]) => ({ nome, respondeu: await sonda(endereco()) }))
  );
}

/**
 * A mensagem de quem não subiu, dita em função de quem subiu.
 *
 * São dois problemas diferentes com conselhos opostos. **Nada de pé**: a Suíte
 * não subiu, e subir os emuladores resolve. **Alguém de pé**: a Suíte subiu pela
 * metade, e subir os emuladores é exatamente o que não vai acontecer — o
 * `reuseExistingServer` do Playwright acha a porta respondendo, conclui que já
 * tem Suíte e não sobe. O que resolve é encerrar o processo que segura a porta.
 *
 * Confundir os dois manda quem lê para o lado oposto da causa, e foi o que
 * aconteceu na execução de release da 1.0.0.
 *
 * @param {string} nome o emulador que não respondeu.
 * @param {string} url onde ele foi procurado.
 * @param {Array<{nome: string, respondeu: boolean}>} varredura o estado dos três.
 */
function mensagemDeFalha(nome, url, varredura) {
  const dePe = varredura.filter((porta) => porta.respondeu && porta.nome !== nome);

  if (dePe.length === 0) {
    return (
      `O emulador de ${nome} não respondeu em ${url}, e nenhum dos três está de pé. ` +
      'Suba o Emulator Suite (`npm run emulators`) ou rode via `npm run test:e2e`.'
    );
  }

  const nomes = dePe.map((porta) => porta.nome);
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

  return (
    `O emulador de ${nome} não respondeu em ${url}, mas ${lista} ` +
    `${nomes.length === 1 ? 'está' : 'estão'} de pé: a Suíte subiu pela metade. ` +
    'A causa quase sempre é um emulador órfão de uma execução anterior segurando a ' +
    `porta ${PORTA_FIRESTORE} — o \`reuseExistingServer\` do Playwright a encontra ` +
    'respondendo, conclui que a Suíte já está de pé e não sobe nenhuma. Encerre o ' +
    'processo órfão e rode de novo.'
  );
}

/**
 * Espera os três emuladores, uma vez por processo.
 *
 * Memoizada: com 1 worker e dez arquivos de spec, a espera acontece na primeira
 * chamada e as outras recebem a promessa já resolvida.
 */
function aguardarEmuladores() {
  if (prontidao) return prontidao;

  prontidao = (async () => {
    const limite = Date.now() + ESPERA_MAXIMA_MS;

    for (const [nome, endereco] of SONDAS) {
      const url = endereco();

      // eslint-disable-next-line no-await-in-loop
      while (!(await respondeu(url))) {
        if (Date.now() > limite) {
          // A varredura antes do `throw`: é ela que separa "a Suíte não subiu"
          // de "há órfão na porta", e custa três sondagens uma única vez.
          // eslint-disable-next-line no-await-in-loop
          const varredura = await varrerSondas();

          throw new Error(mensagemDeFalha(nome, url, varredura));
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolver) => setTimeout(resolver, PASSO_DA_SONDAGEM_MS));
      }
    }
  })();

  return prontidao;
}

/**
 * Apaga todo o Firestore e todas as contas do emulador.
 *
 * Roda no `beforeEach` de cada spec. É o que faz um teste não herdar o estado
 * do anterior — a causa mais comum de suíte end-to-end que passa sozinha e
 * falha em conjunto.
 */
async function limparTudo() {
  await aguardarEmuladores();

  await chamar(
    `http://${HOST}:${PORTA_FIRESTORE}/emulator/v1/projects/${projeto()}/databases/(default)/documents`,
    { method: 'DELETE' }
  );

  await chamar(`http://${HOST}:${PORTA_AUTH}/emulator/v1/projects/${projeto()}/accounts`, {
    method: 'DELETE',
  });
}

/**
 * Grava um documento em um caminho, com o id escolhido.
 *
 * @param {string} colecao por exemplo `salas` ou `salas/sala-a/chamados`.
 * @param {string} id o id do documento — escolhido, nunca sorteado: um id
 *   sorteado obrigaria o spec a descobri-lo depois, e a asserção passaria a
 *   depender da ordem de leitura.
 * @param {object} dados campos em JavaScript comum.
 */
async function gravar(colecao, id, dados) {
  await chamar(`${baseFirestore()}/${colecao}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ fields: campos(dados) }),
  });
}

/**
 * Grava vários documentos de uma coleção.
 *
 * Em sequência, e não em paralelo: o emulador aceita as duas formas, mas com
 * mil mensagens em paralelo ele passa a responder 429 de forma intermitente, e
 * o teste de carga (AC-PERF-05) fica instável por um motivo que não é o dele.
 *
 * @param {string} colecao
 * @param {Array<{id: string} & object>} documentos
 */
async function gravarVarios(colecao, documentos) {
  for (const { id, ...dados } of documentos) {
    await gravar(colecao, id, dados);
  }
}

/**
 * Grava muitos documentos de uma vez, por `:commit`.
 *
 * Existe por causa do teste de carga (AC-PERF-05), que semeia 1240 documentos:
 * um `POST` por documento levava mais de um minuto e estourava o teto do
 * Playwright antes de o navegador abrir. O `:commit` manda um lote por
 * requisição — nenhuma disputa, nenhum 429, e o mesmo resultado.
 *
 * O lote é de 400 e não de 500, que é o teto do Firestore: os 100 de folga são
 * para o dia em que um documento deste cenário ganhar um campo de escrita
 * implícita e o lote passar a contar mais do que se vê aqui.
 *
 * Diferença de semântica que vale saber: `gravar` recusa um id que já existe, e
 * isto sobrescreve. Para semeadura depois de `limparTudo()` dá no mesmo.
 *
 * @param {string} colecao
 * @param {Array<{id: string} & object>} documentos
 */
async function gravarEmLote(colecao, documentos) {
  const TAMANHO_DO_LOTE = 400;
  const prefixo = `projects/${projeto()}/databases/(default)/documents/${colecao}`;

  for (let inicio = 0; inicio < documentos.length; inicio += TAMANHO_DO_LOTE) {
    const lote = documentos.slice(inicio, inicio + TAMANHO_DO_LOTE);

    // eslint-disable-next-line no-await-in-loop
    await chamar(`${baseFirestore()}:commit`, {
      method: 'POST',
      body: JSON.stringify({
        writes: lote.map(({ id, ...dados }) => ({
          update: { name: `${prefixo}/${id}`, fields: campos(dados) },
        })),
      }),
    });
  }
}

/** Lê um documento de volta, para a asserção olhar o banco e não a tela. */
async function ler(caminho) {
  const resposta = await fetch(`${baseFirestore()}/${caminho}`, { headers: CABECALHOS });

  if (resposta.status === 404) return null;

  const { fields } = await resposta.json();

  return fields || {};
}

/** Os ids de uma coleção, para provar que a escrita da tela chegou ao banco. */
async function idsDe(colecao) {
  const resposta = await fetch(`${baseFirestore()}/${colecao}?pageSize=1000`, {
    headers: CABECALHOS,
  });

  if (!resposta.ok) return [];

  const { documents = [] } = await resposta.json();

  return documents.map(({ name }) => name.split('/').pop());
}

/**
 * Cria uma conta no Auth com o uid escolhido.
 *
 * O endpoint é o de administração (`/projects/{id}/accounts`) e não o
 * `accounts:signUp` público, porque só ele aceita `localId`. Sem uid escolhido,
 * nenhum documento de sala pode ser semeado antes do login — e semear depois
 * significaria clicar a sala inteira em cada teste.
 *
 * @param {{uid: string, email: string, senha: string, nome: string}} conta
 */
async function criarConta({ uid, email, senha, nome }) {
  await chamar(`${baseAuth()}/projects/${projeto()}/accounts`, {
    method: 'POST',
    body: JSON.stringify({
      localId: uid,
      email,
      password: senha,
      displayName: nome,
      emailVerified: true,
    }),
  });
}

module.exports = {
  ENDERECO_DO_APP,
  ESPERA_MAXIMA_MS,
  HOST,
  PORTA_AUTH,
  PORTA_FIRESTORE,
  PORTA_STORAGE,
  aguardarEmuladores,
  campos,
  criarConta,
  gravar,
  gravarEmLote,
  gravarVarios,
  idsDe,
  ler,
  limparTudo,
  mensagemDeFalha,
  projeto,
  varrerSondas,
  valor,
};
