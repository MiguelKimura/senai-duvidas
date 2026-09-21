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
// `uploadImage` continua em `firebase.js` e continua como estava: quem mexe
// nele é a task 04.
import * as storage from 'firebase/storage';
import { __arquivosEnviados, __resetarStorage } from 'firebase/storage';
import { __definirUsuarioDoPopup, __resetarAuth } from 'firebase/auth';
import * as firebase from '../firebase';
import { auth, db, storage as storageExportado, uploadImage } from '../firebase';
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

describe('firebase.js — uploadImage (AC-IMG-02, ainda sem interface)', () => {
  it('envia o arquivo para imagens/<nome> e devolve a URL pública', async () => {
    const arquivo = new File(['conteudo'], 'erro-do-vscode.png', { type: 'image/png' });

    const url = await uploadImage(arquivo);

    expect(__arquivosEnviados()).toEqual(['imagens/erro-do-vscode.png']);
    expect(url).toBe('https://fake.storage/imagens/erro-do-vscode.png');
  });

  it('usa o nome do arquivo como caminho, então dois alunos se sobrescrevem', async () => {
    // Sem uid nem sala no caminho: o segundo upload de um `print.png` apaga o
    // primeiro. A task 04 troca por um caminho com escopo.
    await uploadImage(new File(['a'], 'print.png', { type: 'image/png' }));
    await uploadImage(new File(['b'], 'print.png', { type: 'image/png' }));

    expect(__arquivosEnviados()).toEqual(['imagens/print.png']);
  });

  it('propaga e registra a falha de upload', async () => {
    jest.spyOn(storage, 'uploadBytes').mockRejectedValue(new Error('rede caiu'));

    await expect(
      uploadImage(new File(['a'], 'print.png', { type: 'image/png' }))
    ).rejects.toThrow('rede caiu');
    expect(console.error).toHaveBeenCalled();
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
