// Caracterização dos helpers de `src/firebase.js`.
//
// A task 00 registrou aqui duas coisas que a task 01 tinha de mudar, e as duas
// mudaram. As asserções correspondentes foram **invertidas**, não removidas:
//
//   * o erro de login virava `alert()`, que bloqueia a aba inteira. Agora o
//     serviço propaga o erro cru e quem renderiza traduz e exibe no formulário;
//   * o módulo abria um `onAuthStateChanged` solto no import, nunca cancelado,
//     que logava o objeto do usuário no console — dado pessoal em log, proibido
//     pelas restrições de produção do projeto. Agora o único observador da
//     sessão é o `AuthProvider`, e ele é cancelado no unmount.
//
// O login social também saiu daqui: mora em `src/services/auth.js`, para que o
// módulo de configuração do Firebase não acumule regra de negócio. Os testes
// que o cobriam acompanharam a mudança de endereço.
//
// A task 04 tirou daqui a terceira: `uploadImage`, que gravava em
// `imagens/{nome}` — caminho global, sem sala e sem uid, em que dois alunos
// que enviassem `print.png` se sobrescreviam. Ninguém a chamava, e ela nunca
// chegou a ter interface. O upload de verdade mora em `services/anexos.js`,
// escopado por sala e por chamado. As asserções que a descreviam foram
// INVERTIDAS, não removidas.
import { __arquivosEnviados, __resetarStorage } from 'firebase/storage';
import { __definirUsuarioDoPopup, __resetarAuth } from 'firebase/auth';
import * as firebase from '../firebase';
import { auth, db, storage as storageExportado } from '../firebase';
import { comDimensoes, instalarCanvasFalso, restaurarCanvas } from '../test-utils';
import { entrarComGithub, entrarComGoogle, __esquecerPersistencia } from '../services/auth';

// Import normal, e nao `jest.isolateModules`: os helpers precisam enxergar a
// MESMA instancia dos fakes que o teste manipula. Cada escopo isolado cria um
// registro de modulos proprio, e o `__definirUsuarioDoPopup` daqui nao chegaria
// ate o `signInWithPopup` de la. Quem precisa de isolamento e o teste de
// configuracao (firebaseConfig.test.js), que mexe em process.env.

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

beforeEach(() => {
  __resetarAuth();
  __resetarStorage();
  __esquecerPersistencia();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('login com Google e GitHub — agora em services/auth.js', () => {
  it('devolve o usuário autenticado quando o popup conclui', async () => {
    __definirUsuarioDoPopup(ANA);

    await expect(entrarComGoogle()).resolves.toEqual(ANA);
  });

  it('o login com GitHub segue o mesmo caminho', async () => {
    __definirUsuarioDoPopup(ANA);

    await expect(entrarComGithub()).resolves.toEqual(ANA);
  });

  it('propaga o erro quando o usuário fecha o popup', async () => {
    __definirUsuarioDoPopup(null);

    await expect(entrarComGoogle()).rejects.toThrow();
  });

  it('NÃO avisa por alert bloqueante — quem exibe é o formulário', async () => {
    // Era: `expect(window.alert).toHaveBeenCalledWith('A janela de login foi
    // fechada antes da autenticação.')`. O alert trava a aba e some sem
    // deixar o texto na tela; a tradução agora acontece em `utils/errosAuth`
    // e a mensagem fica renderizada no `Login` (AC-AUTH-05).
    __definirUsuarioDoPopup(null);

    await expect(entrarComGoogle()).rejects.toThrow();

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('o mesmo vale para o GitHub', async () => {
    __definirUsuarioDoPopup(null);

    await expect(entrarComGithub()).rejects.toThrow();

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('firebase.js não exporta mais login: ele só configura o SDK', () => {
    expect(firebase.signInWithGoogle).toBeUndefined();
    expect(firebase.signInWithGithub).toBeUndefined();
  });
});

describe('firebase.js — uploadImage saiu de cena (AC-IMG-02, AC-IMG-11)', () => {
  it('NÃO exporta mais uploadImage: o upload mora em services/anexos.js', () => {
    // Era: "envia o arquivo para imagens/<nome> e devolve a URL pública".
    // Aquele helper era órfão — ninguém o chamava — e o caminho dele não tinha
    // sala nem uid. Agora o módulo de configuração só configura o SDK.
    expect(firebase.uploadImage).toBeUndefined();

    const servico = require('../services/anexos');
    expect(servico.enviarAnexo).toBeDefined();
  });

  it('o caminho novo tem sala e chamado, e dois print.png não se sobrescrevem', async () => {
    // Era: "usa o nome do arquivo como caminho, então dois alunos se
    // sobrescrevem". O nome agora é sorteado, e o caminho é por chamado.
    const { enviarAnexo } = require('../services/anexos');
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
    const print = () =>
      comDimensoes(
        new File([new Uint8Array(png)], 'print.png', { type: 'image/png' }),
        800,
        600
      );

    instalarCanvasFalso();
    await enviarAnexo(print(), { salaId: 'sala-3b', chamadoId: 'c1' });
    await enviarAnexo(print(), { salaId: 'sala-3b', chamadoId: 'c1' });
    restaurarCanvas();

    expect(__arquivosEnviados()).toHaveLength(2);
    __arquivosEnviados().forEach((caminho) =>
      expect(caminho).toMatch(/^salas\/sala-3b\/chamados\/c1\//)
    );
  });

  it('a falha de upload não vira console.error com dado de ninguém', async () => {
    // Era: "propaga e registra a falha de upload" — e o `console.error` do
    // helper antigo despejava o objeto de erro do SDK no console. Agora a
    // falha volta traduzida para quem chamou, e é a tela que a exibe.
    const { ErroDeAnexo } = require('../services/anexos');

    expect(new ErroDeAnexo('falhou').message).toBe('falhou');
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('firebase.js — efeitos colaterais do import', () => {
  it('NÃO abre mais listener de autenticação no import', () => {
    // Era: "abre um listener que ninguém cancela". Aquele listener vivia
    // enquanto a aba vivesse e logava o objeto do usuário no console. O único
    // observador da sessão agora é o `AuthProvider`, cancelado no unmount.
    jest.isolateModules(() => {
      const authIsolado = require('firebase/auth');
      const inscrever = jest.spyOn(authIsolado, 'onAuthStateChanged');

      require('../firebase');

      expect(inscrever).not.toHaveBeenCalled();
    });
  });

  it('não registra dado pessoal no console ao importar', () => {
    jest.isolateModules(() => {
      require('../firebase');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  it('exporta auth, db e storage já inicializados', () => {
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storageExportado).toBeDefined();
  });
});
