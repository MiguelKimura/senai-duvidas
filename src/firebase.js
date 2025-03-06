import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA2fYSQknvMEeqlxMEwMjq49IrnazOGqkQ",
  authDomain: "senai-duvidas.firebaseapp.com",
  projectId: "senai-duvidas",
  storageBucket: "senai-duvidas.appspot.com",
  messagingSenderId: "212239446381",
  appId: "1:212239446381:web:a16be214f6f54014a2ea64"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Auth e Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// Inicializa os provedores de autenticação e adiciona escopos
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

const githubProvider = new GithubAuthProvider();
githubProvider.addScope("read:user");

// Função para tratar erros de autenticação
const handleAuthError = (error) => {
  switch (error.code) {
    case "auth/popup-closed-by-user":
      return "A janela de login foi fechada antes da autenticação.";
    case "auth/network-request-failed":
      return "Falha na rede. Verifique sua conexão com a internet.";
    case "auth/account-exists-with-different-credential":
      return "Este e-mail já está vinculado a outra conta.";
    case "auth/unauthorized-domain":
      return "O domínio deste site não está autorizado para login. Verifique sua configuração no Firebase.";
    case "auth/cancelled-popup-request":
      return "Outra solicitação de login já está em andamento.";
    case "auth/popup-blocked":
      return "O pop-up de login foi bloqueado. Verifique as configurações do navegador.";
    case "auth/internal-error":
      return "Erro interno do Firebase. Tente novamente mais tarde.";
    default:
      return `Erro desconhecido: ${error.message}`;
  }
};

// Função para login com Google
const signInWithGoogle = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Usuário logado com Google:", result.user);
    return result.user;
  } catch (error) {
    console.error("Erro ao fazer login com Google:", error);
    alert(handleAuthError(error));
    throw error;
  }
};

// Função para login com GitHub
const signInWithGithub = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, githubProvider);
    console.log("Usuário logado com GitHub:", result.user);
    return result.user;
  } catch (error) {
    console.error("Erro ao fazer login com GitHub:", error);
    alert(handleAuthError(error));
    throw error;
  }
};

// Listener para detectar mudanças na autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Usuário autenticado:", user);
  } else {
    console.log("Nenhum usuário autenticado");
  }
});

export { app, auth, db, signInWithGoogle, signInWithGithub };
