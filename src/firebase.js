import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

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
  apiKey: 'AIzaSyA2fYSQknvMEeqlxMEwMjq49IrnazOGqkQ',
  authDomain: 'senai-duvidas.firebaseapp.com',
  projectId: 'senai-duvidas',
  storageBucket: 'senai-duvidas.appspot.com',
  messagingSenderId: '212239446381',
  appId: '1:212239446381:web:a16be214f6f54014a2ea64',
};

const VALORES_DO_AMBIENTE = {
  apiKey: ['REACT_APP_FIREBASE_API_KEY', process.env.REACT_APP_FIREBASE_API_KEY],
  authDomain: ['REACT_APP_FIREBASE_AUTH_DOMAIN', process.env.REACT_APP_FIREBASE_AUTH_DOMAIN],
  projectId: ['REACT_APP_FIREBASE_PROJECT_ID', process.env.REACT_APP_FIREBASE_PROJECT_ID],
  storageBucket: [
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  ],
  messagingSenderId: [
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  ],
  appId: ['REACT_APP_FIREBASE_APP_ID', process.env.REACT_APP_FIREBASE_APP_ID],
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
      '[firebase] Configuração incompleta: usando os valores embutidos no código para ' +
        `${faltantes.join(', ')}. Defina essas variáveis no .env (veja .env.example).`
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

// Inicializa o Auth, Firestore e Storage.
//
// A task 04 tirou daqui a última regra de negócio que restava: `uploadImage`,
// que gravava em `imagens/{nome}`. O caminho era global — sem sala e sem uid —
// e dois alunos que enviassem `print.png` se sobrescreviam. Ela era órfã:
// ninguém a chamava, e a interface nunca ofereceu upload de arquivo.
//
// Quem sobe anexo agora é `services/anexos.js`, que confere o conteúdo por
// magic bytes, comprime no cliente e grava em
// `salas/{salaId}/chamados/{chamadoId}/{nome-sorteado}` — o caminho que a
// Storage Rule consegue fechar por sala. Este módulo voltou a fazer uma coisa
// só: montar e expor o SDK.
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// O Firebase Emulator Suite (AC-TEST-06).
//
// A suíte end-to-end roda contra o emulador, nunca contra o projeto da escola
// — é a mesma exigência que `tests/rules/projetoDeTeste.js` faz nos testes de
// rules, e pela mesma razão: os testes apagam coleções inteiras, e há turma em
// aula do outro lado.
//
// A chave é `REACT_APP_EMULADORES`, lida em tempo de build. O `.env` de
// produção não a define, o build de produção não embute nada disto e o caminho
// fica exatamente como estava. `src/__tests__/firebaseConfig.test.js` prova as
// duas metades: que sem a variável nenhuma ligação acontece, e que com ela as
// três acontecem uma vez só.
//
// As portas são configuráveis porque este projeto é tocado por um orquestrador
// que roda várias branches em paralelo, cada uma na própria worktree. A porta
// do emulador é a única coisa que elas de fato compartilham, e duas sessões
// disputando a 8080 derrubam as duas.
const HOST_DO_EMULADOR = process.env.REACT_APP_EMULADOR_HOST || '127.0.0.1';

const portaDoEmulador = (variavel, padrao) => Number(variavel || padrao);

if (process.env.REACT_APP_EMULADORES) {
  connectAuthEmulator(
    auth,
    `http://${HOST_DO_EMULADOR}:${portaDoEmulador(
      process.env.REACT_APP_EMULADOR_PORTA_AUTH,
      9099
    )}`,
    // Sem o banner amarelo por cima da tela: ele cobre o canto inferior da
    // interface e o Playwright passa a clicar nele em vez de no que pediu.
    { disableWarnings: true }
  );

  connectFirestoreEmulator(
    db,
    HOST_DO_EMULADOR,
    portaDoEmulador(process.env.REACT_APP_EMULADOR_PORTA_FIRESTORE, 8080)
  );

  connectStorageEmulator(
    storage,
    HOST_DO_EMULADOR,
    portaDoEmulador(process.env.REACT_APP_EMULADOR_PORTA_STORAGE, 9199)
  );
}

export { app, auth, db, storage };
