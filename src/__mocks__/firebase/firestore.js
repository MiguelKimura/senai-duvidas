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
  colecaoDe(colecao.__caminho).set(id, { ...dados });
  notificar(colecao.__caminho);

  return { __tipo: 'doc', __caminho: `${colecao.__caminho}/${id}`, id };
}

export async function setDoc(referencia, dados) {
  colecaoDe(caminhoDoPai(referencia.__caminho)).set(idDe(referencia.__caminho), { ...dados });
  notificar(caminhoDoPai(referencia.__caminho));
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

/** Limpa dados, ouvintes e contador de ids. Chamado entre testes. */
export function __resetarFirestore() {
  armazem.clear();
  ouvintes = [];
  contadorId = 0;
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
