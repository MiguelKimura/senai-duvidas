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
