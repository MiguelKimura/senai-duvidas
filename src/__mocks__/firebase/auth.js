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
  const usuario = provedor && provedor.__usuarioDeTeste;

  if (!usuario) {
    throw erroDeAuth('auth/popup-closed-by-user', 'Janela fechada antes da autenticação.');
  }

  usuarioAtual = usuario;
  notificar();

  return { user: usuario };
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
  usuarioAtual = null;
  ouvintes = [];
  credenciais = new Map();
  contadorUid = 0;
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
