// Chamadas ao Firebase Auth, isoladas num único módulo.
//
// Nada aqui decide papel e nada aqui desenha tela: o papel sai de
// `perfilUsuario.js` e a mensagem de erro sai de `utils/errosAuth.js`, montada
// por quem renderiza. Este módulo só fala com o SDK — é o que torna o resto
// testável sem subir Firebase.
import {
  browserLocalPersistence,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Promessa única de `setPersistence`.
 *
 * `browserLocalPersistence` guarda a sessão no IndexedDB: ela sobrevive a
 * fechar a aba, a Ctrl+F5 e a desligar a máquina (AC-SESSAO-01 a 03), e o SDK
 * renova o token sozinho enquanto ela existir (AC-SESSAO-04).
 *
 * Guardar a promessa em vez de repetir a chamada evita uma ida extra ao
 * IndexedDB a cada login, e garante que o primeiro login espere a mesma
 * configuração que o segundo.
 */
let persistenciaConfigurada = null;

/**
 * Garante que a persistência local esteja valendo antes de qualquer login.
 * @returns {Promise<void>}
 */
export function garantirPersistenciaLocal() {
  if (!persistenciaConfigurada) {
    persistenciaConfigurada = setPersistence(auth, browserLocalPersistence);
  }

  return persistenciaConfigurada;
}

/** Provedor do Google com os escopos que a aplicação usa. */
function provedorGoogle() {
  const provedor = new GoogleAuthProvider();
  provedor.addScope('email');
  provedor.addScope('profile');
  return provedor;
}

/** Provedor do GitHub com os escopos que a aplicação usa. */
function provedorGithub() {
  const provedor = new GithubAuthProvider();
  provedor.addScope('read:user');
  provedor.addScope('user:email');
  return provedor;
}

/**
 * Login por janela do provedor social.
 * @param {object} provedor instância de `GoogleAuthProvider` ou `GithubAuthProvider`.
 * @returns {Promise<object>} usuário do Firebase Auth.
 */
async function entrarPorPopup(provedor) {
  await garantirPersistenciaLocal();
  const credencial = await signInWithPopup(auth, provedor);

  return credencial.user;
}

/**
 * Login com e-mail e senha.
 * @param {string} email
 * @param {string} senha
 * @returns {Promise<object>} usuário do Firebase Auth.
 * @throws o erro cru do SDK — quem renderiza traduz com `traduzirErroDeAuth`.
 */
export async function entrarComEmailESenha(email, senha) {
  await garantirPersistenciaLocal();
  const credencial = await signInWithEmailAndPassword(auth, email, senha);

  return credencial.user;
}

/**
 * Login com Google (AC-AUTH-03).
 * @returns {Promise<object>} usuário do Firebase Auth.
 */
export function entrarComGoogle() {
  return entrarPorPopup(provedorGoogle());
}

/**
 * Login com GitHub (AC-AUTH-04).
 * @returns {Promise<object>} usuário do Firebase Auth.
 */
export function entrarComGithub() {
  return entrarPorPopup(provedorGithub());
}

/**
 * Encerra a sessão do Firebase (AC-AUTH-08).
 * @returns {Promise<void>}
 */
export function sair() {
  return signOut(auth);
}

/**
 * Observa o estado de autenticação.
 * @param {(usuario: object|null) => void} aoMudar chamado com o estado corrente e a cada mudança.
 * @returns {() => void} cancela a inscrição.
 */
export function observarAutenticacao(aoMudar) {
  return onAuthStateChanged(auth, aoMudar);
}

/** Zera a memória da persistência. Só os testes precisam disto. */
export function __esquecerPersistencia() {
  persistenciaConfigurada = null;
}
