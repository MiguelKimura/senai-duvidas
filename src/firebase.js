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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"; // Importando o Firebase Storage

// Configuração do Firebase (AC-AUTH-10).
//
// A fonte da verdade são as variáveis `REACT_APP_FIREBASE_*` do `.env` — veja
// `.env.example`. Os valores abaixo são o fallback: continuam aqui porque
// removê-los quebraria todo deploy que ainda não tem `.env`, inclusive o que
// está em produção. São as chaves públicas do cliente Firebase, que o bundle
// expõe de qualquer forma; o que protege os dados são as Security Rules.
//
// Cada variável é lida de forma estática, e não por `process.env[nome]`, para
// não depender de como o empacotador substitui `process.env` no build.
const CONFIG_DE_FALLBACK = {
  apiKey: "AIzaSyA2fYSQknvMEeqlxMEwMjq49IrnazOGqkQ",
  authDomain: "senai-duvidas.firebaseapp.com",
  projectId: "senai-duvidas",
  storageBucket: "senai-duvidas.appspot.com",
  messagingSenderId: "212239446381",
  appId: "1:212239446381:web:a16be214f6f54014a2ea64"
};

const VALORES_DO_AMBIENTE = {
  apiKey: ["REACT_APP_FIREBASE_API_KEY", process.env.REACT_APP_FIREBASE_API_KEY],
  authDomain: ["REACT_APP_FIREBASE_AUTH_DOMAIN", process.env.REACT_APP_FIREBASE_AUTH_DOMAIN],
  projectId: ["REACT_APP_FIREBASE_PROJECT_ID", process.env.REACT_APP_FIREBASE_PROJECT_ID],
  storageBucket: [
    "REACT_APP_FIREBASE_STORAGE_BUCKET",
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET
  ],
  messagingSenderId: [
    "REACT_APP_FIREBASE_MESSAGING_SENDER_ID",
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID
  ],
  appId: ["REACT_APP_FIREBASE_APP_ID", process.env.REACT_APP_FIREBASE_APP_ID]
};

/**
 * Monta a config preferindo o ambiente e caindo no fallback campo a campo.
 * Avisa uma única vez quais variáveis faltaram, para que a pendência de
 * configuração apareça no console em vez de passar despercebida.
 */
const montarConfiguracao = () => {
  const faltantes = [];

  const config = Object.entries(VALORES_DO_AMBIENTE).reduce((acumulado, [campo, par]) => {
    const [nomeDaVariavel, valor] = par;

    if (valor) {
      acumulado[campo] = valor;
    } else {
      acumulado[campo] = CONFIG_DE_FALLBACK[campo];
      faltantes.push(nomeDaVariavel);
    }

    return acumulado;
  }, {});

  if (faltantes.length > 0) {
    console.warn(
      "[firebase] Configuração incompleta: usando os valores embutidos no código para " +
        `${faltantes.join(", ")}. Defina essas variáveis no .env (veja .env.example).`
    );
  }

  return config;
};

const firebaseConfig = montarConfiguracao();

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Auth, Firestore e Storage
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Inicializando o Storage

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
      return "O domínio deste site não está autorizado para login. Verifique as configurações no Firebase.";
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
    await setPersistence(auth, browserLocalPersistence); // Garante a persistência
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
    await setPersistence(auth, browserLocalPersistence); // Garante a persistência
    const result = await signInWithPopup(auth, githubProvider);
    console.log("Usuário logado com GitHub:", result.user);
    return result.user;
  } catch (error) {
    console.error("Erro ao fazer login com GitHub:", error);
    alert(handleAuthError(error));
    throw error;
  }
};

// Função para fazer upload de imagens para o Firebase Storage
const uploadImage = async (imageFile) => {
  const imageRef = ref(storage, `imagens/${imageFile.name}`); // Defina o caminho da imagem
  try {
    // Envia a imagem para o Firebase Storage
    await uploadBytes(imageRef, imageFile);
    // Obtém a URL pública da imagem após o upload
    const imageUrl = await getDownloadURL(imageRef);
    return imageUrl; // Retorna a URL pública
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    throw error;
  }
};

// Listener para detectar mudanças na autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Usuário autenticado:", user);
    // Você pode verificar aqui a persistência do usuário
  } else {
    console.log("Nenhum usuário autenticado");
  }
});

// Definir a persistência do usuário na inicialização para garantir que o login seja mantido
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistência do usuário configurada para 'local'");
  })
  .catch((error) => {
    console.error("Erro ao configurar persistência:", error);
  });

export { app, auth, db, storage, signInWithGoogle, signInWithGithub, uploadImage };
