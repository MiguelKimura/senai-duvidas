// Fake em memória do `firebase/auth`.
//
// Precisa servir aos dois estilos de uso que convivem no código da v0.1.0:
//   App.js   -> onAuthStateChanged(auth, callback)   (modular)
//   Login.js -> auth.onAuthStateChanged(callback)    (método do objeto)
// A task 01 unifica isso; até lá, o fake sustenta os dois.

let usuarioAtual = null;
let ouvintes = [];
let credenciais = new Map();
let contadorUid = 0;
// Quem o proximo signInWithPopup devolve. `App.js` constroi os provedores
// dentro do componente, entao nao da para injetar o usuario pelo provedor.
let usuarioDoPopup = null;

function notificar() {
  ouvintes.forEach((callback) => callback(usuarioAtual));
}

function erroDeAuth(codigo, mensagem) {
  const erro = new Error(mensagem);
  erro.code = codigo;
  return erro;
}

function inscrever(callback) {
  ouvintes.push(callback);
  // O SDK real dispara o callback com o estado corrente logo na inscrição.
  callback(usuarioAtual);

  return () => {
    ouvintes = ouvintes.filter((inscrito) => inscrito !== callback);
  };
}

const auth = {
  get currentUser() {
    return usuarioAtual;
  },
  onAuthStateChanged: inscrever,
};

export function getAuth() {
  return auth;
}

export function onAuthStateChanged(_auth, callback) {
  return inscrever(callback);
}

export async function signInWithEmailAndPassword(_auth, email, senha) {
  const registro = credenciais.get(email);

  if (!registro || registro.senha !== senha) {
    throw erroDeAuth('auth/invalid-credential', 'Credencial inválida.');
  }

  usuarioAtual = registro.usuario;
  notificar();

  return { user: usuarioAtual };
}

export async function createUserWithEmailAndPassword(_auth, email, senha) {
  if (credenciais.has(email)) {
    throw erroDeAuth('auth/email-already-in-use', 'E-mail já cadastrado.');
  }

  contadorUid += 1;
  const usuario = { uid: `uid-gerado-${contadorUid}`, email, displayName: null };
  credenciais.set(email, { senha, usuario });

  usuarioAtual = usuario;
  notificar();

  return { user: usuario };
}

export async function updateProfile(usuario, { displayName }) {
  usuario.displayName = displayName;

  if (usuarioAtual && usuarioAtual.uid === usuario.uid) {
    usuarioAtual = { ...usuarioAtual, displayName };
    notificar();
  }
}

export async function signOut() {
  usuarioAtual = null;
  notificar();
}

export async function signInWithPopup(_auth, provedor) {
  const usuario = (provedor && provedor.__usuarioDeTeste) || usuarioDoPopup;

  if (!usuario) {
    throw erroDeAuth('auth/popup-closed-by-user', 'Janela fechada antes da autenticação.');
  }

  usuarioAtual = usuario;
  notificar();

  return { user: usuario };
}

// E-mails de confirmação "enviados", para os testes conferirem.
let verificacoesEnviadas = [];

export async function sendEmailVerification(usuario) {
  verificacoesEnviadas.push(usuario && usuario.email);
}

export async function reload() {
  return undefined;
}

export function __verificacoesEnviadas() {
  return verificacoesEnviadas;
}

export async function setPersistence() {
  return undefined;
}

export const browserLocalPersistence = 'local';

export class GoogleAuthProvider {
  constructor() {
    this.escopos = [];
  }

  addScope(escopo) {
    this.escopos.push(escopo);
  }
}

export class GithubAuthProvider {
  constructor() {
    this.escopos = [];
  }

  addScope(escopo) {
    this.escopos.push(escopo);
  }
}

// --- controles de teste ----------------------------------------------------

/** Zera usuário, ouvintes e credenciais. Chamado entre testes. */
export function __resetarAuth() {
  verificacoesEnviadas = [];
  usuarioAtual = null;
  ouvintes = [];
  credenciais = new Map();
  contadorUid = 0;
  usuarioDoPopup = null;
}

/**
 * Define quem o proximo `signInWithPopup` devolve, independente do provedor.
 * Passe `null` para simular a janela fechada pelo usuario.
 */
export function __definirUsuarioDoPopup(usuario) {
  usuarioDoPopup = usuario;
}

/** Define quem está autenticado e avisa os ouvintes. */
export function __definirUsuarioAtual(usuario) {
  usuarioAtual = usuario;
  notificar();
}

/** Registra um par e-mail/senha aceito por `signInWithEmailAndPassword`. */
export function __registrarCredencial(email, senha, usuario = {}) {
  credenciais.set(email, {
    senha,
    usuario: { uid: `uid-${email}`, email, displayName: null, ...usuario },
  });
}

// ---------------------------------------------------------------------------
// Ligação com o Emulator Suite (AC-TEST-06)
// ---------------------------------------------------------------------------
//
// O mock não simula emulador nenhum: ele apenas registra que `src/firebase.js`
// pediu a ligação, e com quais host e porta. O que o teste precisa provar é
// que o build de produção **não** pede, e que o build de e2e pede uma vez só.

let emuladoresLigados = [];

// A assinatura é a do SDK de verdade, e ela difere das outras duas: o Auth
// recebe uma URL inteira, o Firestore e o Storage recebem host e porta
// separados. O mock desmonta a URL para que a asserção do teste seja a mesma
// nos três — se `src/firebase.js` montar a URL errada, o desmonte falha aqui.
export function connectAuthEmulator(_alvo, url) {
  const { hostname, port } = new URL(url);

  emuladoresLigados.push({ host: hostname, porta: Number(port) });
}

/** As ligações pedidas até agora, em ordem. */
export function __emuladoresLigados() {
  return emuladoresLigados;
}

export function __resetarEmuladores() {
  emuladoresLigados = [];
}
