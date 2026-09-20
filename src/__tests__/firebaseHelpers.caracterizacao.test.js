// Caracterização dos helpers de `src/firebase.js`.
//
// São as funções que a task 01 (OAuth e sessão) e a task 04 (upload de imagem)
// vão reescrever. Hoje nenhuma delas é chamada pela interface — `uploadImage`
// não tem campo de arquivo e o login social não tem botão —, então este é o
// único lugar que documenta o que elas fazem.
//
// Duas coisas que a task 01 precisa mudar e que ficam registradas aqui:
//   * o erro de login vira `alert()`, que bloqueia a aba inteira;
//   * o módulo abre um `onAuthStateChanged` solto no import, que nunca é
//     cancelado, e loga o objeto do usuário no console — dado pessoal em log,
//     proibido pelas restrições de produção do projeto.
import { __definirUsuarioDoPopup, __resetarAuth } from 'firebase/auth';
import * as storage from 'firebase/storage';
import { __arquivosEnviados, __resetarStorage } from 'firebase/storage';
import { auth, db, signInWithGithub, signInWithGoogle, storage as storageExportado, uploadImage } from '../firebase';

// Import normal, e nao `jest.isolateModules`: os helpers precisam enxergar a
// MESMA instancia dos fakes que o teste manipula. Cada escopo isolado cria um
// registro de modulos proprio, e o `__definirUsuarioDoPopup` daqui nao chegaria
// ate o `signInWithPopup` de la. Quem precisa de isolamento e o teste de
// configuracao (firebaseConfig.test.js), que mexe em process.env.

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

beforeEach(() => {
  __resetarAuth();
  __resetarStorage();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('firebase.js — login com Google e GitHub', () => {
  it('devolve o usuário autenticado quando o popup conclui', async () => {
    __definirUsuarioDoPopup(ANA);

    await expect(signInWithGoogle()).resolves.toEqual(ANA);
  });

  it('o login com GitHub segue o mesmo caminho', async () => {
    __definirUsuarioDoPopup(ANA);

    await expect(signInWithGithub()).resolves.toEqual(ANA);
  });

  it('propaga o erro quando o usuário fecha o popup', async () => {
    __definirUsuarioDoPopup(null);

    await expect(signInWithGoogle()).rejects.toThrow();
  });

  it('avisa o erro por alert bloqueante, traduzido para português', async () => {
    __definirUsuarioDoPopup(null);

    await expect(signInWithGoogle()).rejects.toThrow();

    expect(window.alert).toHaveBeenCalledWith(
      'A janela de login foi fechada antes da autenticação.'
    );
  });

  it('o mesmo tratamento de erro vale para o GitHub', async () => {
    __definirUsuarioDoPopup(null);

    await expect(signInWithGithub()).rejects.toThrow();

    expect(window.alert).toHaveBeenCalledWith(
      'A janela de login foi fechada antes da autenticação.'
    );
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
  it('abre um listener de autenticação que ninguém cancela', () => {
    // Este precisa de isolamento: o listener e aberto no topo do modulo, entao
    // so da para observa-lo espionando ANTES de `src/firebase.js` ser avaliado.
    jest.isolateModules(() => {
      const authIsolado = require('firebase/auth');
      const inscrever = jest.spyOn(authIsolado, 'onAuthStateChanged');

      require('../firebase');

      // Sem `unsubscribe` guardado em lugar nenhum: o listener vive enquanto a
      // aba viver. A task 01 move isso para dentro do AuthContext.
      expect(inscrever).toHaveBeenCalled();
    });
  });

  it('exporta auth, db e storage já inicializados', () => {
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storageExportado).toBeDefined();
  });
});
