// Configuração do Firebase por variáveis de ambiente (AC-AUTH-10).
//
// Até a v0.1.0 as chaves do projeto `senai-duvidas` estavam escritas no fonte.
// Elas continuam sendo o fallback — apagá-las de uma vez quebraria todo deploy
// que ainda não tem `.env`, inclusive o que está em produção agora. O contrato
// que este arquivo fixa é:
//
//   * com as REACT_APP_FIREBASE_* definidas, é o `.env` que manda;
//   * sem elas, cai nos valores da v0.1.0 e AVISA, para que a pendência fique
//     visível no console em vez de silenciosa;
//   * o comportamento sem `.env` é byte a byte o de hoje — é isso que garante
//     a compatibilidade futura exigida pelo protocolo.
// Nada de importar `firebase/app` aqui: cada `jest.isolateModules` cria um
// registro de modulos proprio, com uma instancia nova do mock. A configuracao
// precisa ser lida de dentro do mesmo escopo que carregou `src/firebase.js`.

const VARIAVEIS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

/** A config hard-coded da v0.1.0, que segue valendo como fallback. */
const CONFIG_DA_V010 = {
  apiKey: 'AIzaSyA2fYSQknvMEeqlxMEwMjq49IrnazOGqkQ',
  authDomain: 'senai-duvidas.firebaseapp.com',
  projectId: 'senai-duvidas',
  storageBucket: 'senai-duvidas.appspot.com',
  messagingSenderId: '212239446381',
  appId: '1:212239446381:web:a16be214f6f54014a2ea64',
};

const ambienteOriginal = {};

/**
 * Importa `src/firebase.js` do zero, já com o ambiente atual.
 *
 * @returns {{modulo: object, config: object}} o módulo e a configuração que
 *   ele passou para `initializeApp`.
 */
function carregarFirebase() {
  let resultado;

  jest.isolateModules(() => {
    const modulo = require('../firebase');
    const { __ultimaConfiguracao } = require('firebase/app');
    resultado = { modulo, config: __ultimaConfiguracao() };
  });

  return resultado;
}

beforeEach(() => {
  VARIAVEIS.forEach((nome) => {
    ambienteOriginal[nome] = process.env[nome];
    delete process.env[nome];
  });

  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  VARIAVEIS.forEach((nome) => {
    if (ambienteOriginal[nome] === undefined) delete process.env[nome];
    else process.env[nome] = ambienteOriginal[nome];
  });
  jest.restoreAllMocks();
});

describe('firebase.js — configuração por REACT_APP_* (AC-AUTH-10)', () => {
  it('usa as variáveis de ambiente quando todas estão definidas', () => {
    process.env.REACT_APP_FIREBASE_API_KEY = 'chave-do-env';
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'homolog.firebaseapp.com';
    process.env.REACT_APP_FIREBASE_PROJECT_ID = 'senai-duvidas-homolog';
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'homolog.appspot.com';
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '999';
    process.env.REACT_APP_FIREBASE_APP_ID = '1:999:web:homolog';

    const { config } = carregarFirebase();

    expect(config).toEqual({
      apiKey: 'chave-do-env',
      authDomain: 'homolog.firebaseapp.com',
      projectId: 'senai-duvidas-homolog',
      storageBucket: 'homolog.appspot.com',
      messagingSenderId: '999',
      appId: '1:999:web:homolog',
    });
  });

  it('não avisa nada quando o ambiente está completo', () => {
    VARIAVEIS.forEach((nome) => {
      process.env[nome] = `valor-de-${nome}`;
    });

    carregarFirebase();

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('cai na config da v0.1.0 quando nenhuma variável está definida', () => {
    const { config } = carregarFirebase();

    expect(config).toEqual(CONFIG_DA_V010);
  });

  it('avisa em console.warn quando usa o fallback', () => {
    carregarFirebase();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('REACT_APP_FIREBASE_'));
  });

  it('nomeia no aviso quais variáveis faltaram', () => {
    process.env.REACT_APP_FIREBASE_API_KEY = 'chave-do-env';

    carregarFirebase();

    const aviso = console.warn.mock.calls[0][0];
    expect(aviso).toContain('REACT_APP_FIREBASE_PROJECT_ID');
    // A que foi fornecida não entra na lista de faltantes.
    expect(aviso).not.toContain('REACT_APP_FIREBASE_API_KEY');
  });

  it('mistura: usa o env no que foi definido e o fallback no resto', () => {
    process.env.REACT_APP_FIREBASE_PROJECT_ID = 'senai-duvidas-homolog';

    const { config } = carregarFirebase();

    expect(config).toEqual({
      ...CONFIG_DA_V010,
      projectId: 'senai-duvidas-homolog',
    });
  });

  it('trata variável definida como string vazia como ausente', () => {
    process.env.REACT_APP_FIREBASE_PROJECT_ID = '';

    const { config } = carregarFirebase();

    expect(config.projectId).toBe(CONFIG_DA_V010.projectId);
  });
});

describe('firebase.js — compatibilidade futura', () => {
  it('um build sem .env inicializa exatamente como a v0.1.0', () => {
    const { config } = carregarFirebase();

    // Nenhuma chave nova, nenhuma removida, nenhum valor alterado.
    expect(Object.keys(config).sort()).toEqual(Object.keys(CONFIG_DA_V010).sort());
    expect(config).toEqual(CONFIG_DA_V010);
  });

  it('continua exportando o SDK já inicializado, que é o que o resto importa', () => {
    const { modulo } = carregarFirebase();

    ['app', 'auth', 'db', 'storage', 'uploadImage'].forEach((exportado) => {
      expect(modulo[exportado]).toBeDefined();
    });
  });

  it('o login social mudou de endereço, e nada ficou sem dono', () => {
    // A lista antiga incluía `signInWithGoogle` e `signInWithGithub`. A task 01
    // os moveu para `services/auth.js`, onde a persistência é garantida antes
    // do login e o erro não vira `alert()`. A garantia de superfície não foi
    // afrouxada: continua existindo, apontando para o novo endereço.
    const { modulo } = carregarFirebase();

    expect(modulo.signInWithGoogle).toBeUndefined();
    expect(modulo.signInWithGithub).toBeUndefined();

    const servico = require('../services/auth');
    expect(servico.entrarComGoogle).toBeDefined();
    expect(servico.entrarComGithub).toBeDefined();
  });
});
