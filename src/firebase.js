import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

// Inicializa o Firebase.
//
// Este módulo faz exatamente uma coisa: montar e expor o SDK. Até a v0.2.0 ele
// também abria um `onAuthStateChanged` solto no nível do módulo — um listener
// que ninguém cancelava e que registrava o objeto do usuário no console, dado
// pessoal em log. E também chamava `setPersistence` por conta própria, sem
// ninguém esperar a promessa: o primeiro login podia acontecer antes de a
// persistência valer. As duas coisas foram para `services/auth.js` e para o
// `AuthProvider`, onde há ciclo de vida para cuidar delas.
const app = initializeApp(firebaseConfig);

// Inicializa o Auth, Firestore e Storage
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Inicializando o Storage

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

export { app, auth, db, storage, uploadImage };
