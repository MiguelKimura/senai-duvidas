// Fake em memória do `firebase/firestore`, aplicado automaticamente pelo Jest
// (mock manual de módulo de node_modules, encontrado a partir de `roots: src`).
//
// Por que um fake e não `jest.fn()` solto: os testes de caracterização precisam
// afirmar coisas como "o card some da lista depois do Excluir" e "a lista chega
// ordenada por horário". Isso exige um armazenamento com semântica real de
// escrita e de notificação — stubs sem estado só provariam que uma função foi
// chamada, não que a tela reagiu.
//
// Nada aqui fala com a rede. Os testes de integração de verdade rodam contra o
// Firebase Emulator Suite, com projectId `demo-senai-duvidas` (ver tests/rules).

/** @type {Map<string, Map<string, object>>} caminho da coleção -> id -> dados */
const armazem = new Map();

/** @type {Array<{caminho: string, ordenacoes: string[], callback: Function}>} */
let ouvintes = [];

/**
 * Escritas com `serverTimestamp()` que o "servidor" ainda não confirmou.
 *
 * @type {Array<{caminho: string, id: string, campos: string[]}>}
 */
let carimbosPendentes = [];

/** O instante que `__confirmarCarimbos` grava. Nulo = relógio da máquina. */
let relogioDoServidor = null;

let contadorId = 0;

const db = { __tipo: 'firestore-fake' };

// --- utilidades internas ---------------------------------------------------

function colecaoDe(caminho) {
  if (!armazem.has(caminho)) {
    armazem.set(caminho, new Map());
  }
  return armazem.get(caminho);
}

function caminhoDoPai(caminhoDoDocumento) {
  return caminhoDoDocumento.slice(0, caminhoDoDocumento.lastIndexOf('/'));
}

function idDe(caminhoDoDocumento) {
  return caminhoDoDocumento.slice(caminhoDoDocumento.lastIndexOf('/') + 1);
}

function criarSnapshotDeDocumento(caminhoDoDocumento) {
  const dados = colecaoDe(caminhoDoPai(caminhoDoDocumento)).get(idDe(caminhoDoDocumento));

  return {
    id: idDe(caminhoDoDocumento),
    ref: { __tipo: 'doc', __caminho: caminhoDoDocumento, id: idDe(caminhoDoDocumento) },
    exists: () => dados !== undefined,
    data: () => (dados === undefined ? undefined : { ...dados }),
  };
}

function valorOrdenavel(valor) {
  if (valor instanceof Timestamp) return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  return valor;
}

function documentosDe(caminho, ordenacoes = []) {
  const documentos = [...colecaoDe(caminho).entries()].map(([id]) =>
    criarSnapshotDeDocumento(`${caminho}/${id}`)
  );

  ordenacoes.forEach(({ campo, direcao }) => {
    documentos.sort((a, b) => {
      const esquerda = valorOrdenavel(a.data()[campo]);
      const direita = valorOrdenavel(b.data()[campo]);

      if (esquerda === direita) return 0;
      const comparacao = esquerda < direita ? -1 : 1;
      return direcao === 'desc' ? -comparacao : comparacao;
    });
  });

  return documentos;
}

/**
 * Separa os campos carimbados pelo servidor do resto do documento.
 *
 * O documento fica com `null` nos campos carimbados — é exatamente o que o SDK
 * real entrega no documento local, antes de o servidor responder. Gravar o
 * sentinela cru pularia essa janela, que é onde a UI diz "enviando…".
 */
function separarCarimbos(dados) {
  const campos = [];
  const gravados = {};

  Object.entries(dados).forEach(([campo, valor]) => {
    if (valor && valor.__tipo === 'serverTimestamp') {
      campos.push(campo);
      gravados[campo] = null;
    } else {
      gravados[campo] = valor;
    }
  });

  return { gravados, campos };
}

/** Registra os campos que o "servidor" ainda precisa carimbar. */
function anotarCarimbos(caminho, id, campos) {
  if (campos.length > 0) {
    carimbosPendentes.push({ caminho, id, campos });
  }
}

function criarSnapshotDeConsulta(caminho, ordenacoes) {
  const docs = documentosDe(caminho, ordenacoes);

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (visitante) => docs.forEach(visitante),
  };
}

function notificar(caminho) {
  ouvintes
    .filter((ouvinte) => ouvinte.caminho === caminho)
    .forEach((ouvinte) => ouvinte.callback(criarSnapshotDeConsulta(caminho, ouvinte.ordenacoes)));
}

// --- API pública do SDK ----------------------------------------------------

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromDate(data) {
    return new Timestamp(Math.floor(data.getTime() / 1000), (data.getTime() % 1000) * 1e6);
  }

  static now() {
    return Timestamp.fromDate(new Date());
  }

  toMillis() {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toDate() {
    return new Date(this.toMillis());
  }
}

export function getFirestore() {
  return db;
}

export function collection(_db, ...segmentos) {
  return { __tipo: 'colecao', __caminho: segmentos.join('/') };
}

export function doc(dbOuColecao, ...segmentos) {
  const prefixo = dbOuColecao && dbOuColecao.__tipo === 'colecao' ? [dbOuColecao.__caminho] : [];
  const caminho = [...prefixo, ...segmentos].join('/');

  return { __tipo: 'doc', __caminho: caminho, id: idDe(caminho) };
}

export function query(colecao, ...restricoes) {
  return {
    __tipo: 'consulta',
    __caminho: colecao.__caminho,
    __ordenacoes: restricoes.filter((restricao) => restricao && restricao.__tipo === 'orderBy'),
  };
}

export function orderBy(campo, direcao = 'asc') {
  return { __tipo: 'orderBy', campo, direcao };
}

export function limit(quantidade) {
  return { __tipo: 'limit', quantidade };
}

export function where(campo, operador, valor) {
  return { __tipo: 'where', campo, operador, valor };
}

export async function addDoc(colecao, dados) {
  contadorId += 1;
  const id = `doc-gerado-${contadorId}`;
  const { gravados, campos } = separarCarimbos(dados);

  colecaoDe(colecao.__caminho).set(id, gravados);
  anotarCarimbos(colecao.__caminho, id, campos);
  notificar(colecao.__caminho);

  return { __tipo: 'doc', __caminho: `${colecao.__caminho}/${id}`, id };
}

export async function setDoc(referencia, dados) {
  const caminhoDaColecao = caminhoDoPai(referencia.__caminho);
  const id = idDe(referencia.__caminho);
  const { gravados, campos } = separarCarimbos(dados);

  colecaoDe(caminhoDaColecao).set(id, gravados);
  anotarCarimbos(caminhoDaColecao, id, campos);
  notificar(caminhoDaColecao);
}

export async function updateDoc(referencia, dados) {
  const caminhoDaColecao = caminhoDoPai(referencia.__caminho);
  const id = idDe(referencia.__caminho);
  const existente = colecaoDe(caminhoDaColecao).get(id);

  if (existente === undefined) {
    throw new Error(`updateDoc em documento inexistente: ${referencia.__caminho}`);
  }

  const { gravados, campos } = separarCarimbos(dados);

  colecaoDe(caminhoDaColecao).set(id, { ...existente, ...gravados });
  anotarCarimbos(caminhoDaColecao, id, campos);
  notificar(caminhoDaColecao);
}

export async function getDoc(referencia) {
  return criarSnapshotDeDocumento(referencia.__caminho);
}

export async function deleteDoc(referencia) {
  const caminhoDaColecao = caminhoDoPai(referencia.__caminho);
  colecaoDe(caminhoDaColecao).delete(idDe(referencia.__caminho));
  notificar(caminhoDaColecao);
}

export async function getDocs(consultaOuColecao) {
  return criarSnapshotDeConsulta(
    consultaOuColecao.__caminho,
    consultaOuColecao.__ordenacoes || []
  );
}

export function onSnapshot(consultaOuColecao, callback) {
  const ouvinte = {
    caminho: consultaOuColecao.__caminho,
    ordenacoes: consultaOuColecao.__ordenacoes || [],
    callback,
  };
  ouvintes.push(ouvinte);

  // O SDK real entrega o estado corrente assim que a inscrição é criada.
  callback(criarSnapshotDeConsulta(ouvinte.caminho, ouvinte.ordenacoes));

  return () => {
    ouvintes = ouvintes.filter((inscrito) => inscrito !== ouvinte);
  };
}

export function serverTimestamp() {
  return { __tipo: 'serverTimestamp' };
}

// --- controles de teste ----------------------------------------------------

/** Limpa dados, ouvintes, carimbos pendentes e contador de ids. */
export function __resetarFirestore() {
  armazem.clear();
  ouvintes = [];
  carimbosPendentes = [];
  relogioDoServidor = null;
  contadorId = 0;
}

/**
 * Define o instante que o "servidor" vai carimbar.
 *
 * É o que torna possível provar o AC-TEMPO-02: o teste adianta o relógio da
 * máquina e deixa o do servidor onde está, e a fila não se mexe.
 *
 * @param {string|number|Date} instante
 */
export function __definirRelogioDoServidor(instante) {
  relogioDoServidor = new Date(instante);
}

/**
 * Confirma as escritas pendentes, como o servidor faria ao responder.
 *
 * Troca o `null` pelo `Timestamp` e reemite o `onSnapshot` de cada coleção
 * afetada — a segunda das duas fases da escrita otimista.
 *
 * @param {string|number|Date} [instante] sobrescreve o relógio do servidor.
 */
export function __confirmarCarimbos(instante) {
  const carimbo = Timestamp.fromDate(
    instante !== undefined ? new Date(instante) : relogioDoServidor || new Date()
  );
  const pendentes = carimbosPendentes;
  carimbosPendentes = [];

  const caminhosAfetados = new Set();

  pendentes.forEach(({ caminho, id, campos }) => {
    const documento = colecaoDe(caminho).get(id);
    // O documento pode ter sido apagado entre a escrita e a confirmação.
    if (documento === undefined) return;

    campos.forEach((campo) => {
      documento[campo] = carimbo;
    });
    caminhosAfetados.add(caminho);
  });

  caminhosAfetados.forEach(notificar);
}

/** Quantas escritas esperam o carimbo do servidor. */
export function __carimbosPendentes() {
  return carimbosPendentes.length;
}

/** Popula uma coleção. Cada item precisa de `id`; o resto vira o documento. */
export function __semearColecao(caminho, documentos) {
  documentos.forEach(({ id, ...dados }) => colecaoDe(caminho).set(id, dados));
  notificar(caminho);
}

/** Quantos ouvintes continuam inscritos — usado para provar o AC-PERF-04. */
export function __ouvintesAtivos() {
  return ouvintes.length;
}
