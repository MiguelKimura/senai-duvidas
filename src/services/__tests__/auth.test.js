// `src/services/auth.js` — as chamadas ao Firebase Auth, isoladas.
//
// O ponto central deste ciclo é a ordem: `setPersistence(browserLocalPersistence)`
// precisa acontecer ANTES de qualquer login. Se o login for primeiro, a sessão
// nasce na persistência padrão e some quando a aba fecha — que é exatamente o
// que os AC-SESSAO-01 a 04 proíbem, numa máquina de laboratório que é desligada
// no fim da aula.
import * as firebaseAuth from 'firebase/auth';
import {
  __definirUsuarioAtual,
  __definirUsuarioDoPopup,
  __registrarCredencial,
  __resetarAuth,
} from 'firebase/auth';
import {
  entrarComEmailESenha,
  entrarComGithub,
  entrarComGoogle,
  observarAutenticacao,
  sair,
  __esquecerPersistencia,
} from '../auth';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** Registra a ordem em que `setPersistence` e os logins são chamados. */
function espiarOrdem() {
  const ordem = [];

  jest.spyOn(firebaseAuth, 'setPersistence').mockImplementation(async (_auth, persistencia) => {
    ordem.push(`setPersistence:${persistencia}`);
  });
  jest.spyOn(firebaseAuth, 'signInWithPopup').mockImplementation(async () => {
    ordem.push('signInWithPopup');
    return { user: ANA };
  });
  jest.spyOn(firebaseAuth, 'signInWithEmailAndPassword').mockImplementation(async () => {
    ordem.push('signInWithEmailAndPassword');
    return { user: ANA };
  });

  return ordem;
}

beforeEach(() => {
  __resetarAuth();
  // A persistência é configurada uma vez por sessão do navegador. Cada teste
  // precisa de uma sessão nova para poder observar essa primeira vez.
  __esquecerPersistencia();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('persistência antes do login (AC-SESSAO-01 a AC-SESSAO-04)', () => {
  it('configura browserLocalPersistence antes do popup do Google', async () => {
    const ordem = espiarOrdem();

    await entrarComGoogle();

    expect(ordem).toEqual(['setPersistence:local', 'signInWithPopup']);
  });

  it('configura browserLocalPersistence antes do popup do GitHub', async () => {
    const ordem = espiarOrdem();

    await entrarComGithub();

    expect(ordem).toEqual(['setPersistence:local', 'signInWithPopup']);
  });

  it('configura browserLocalPersistence antes do login por e-mail e senha', async () => {
    const ordem = espiarOrdem();

    await entrarComEmailESenha('ana@senai.br', 'senha123');

    expect(ordem).toEqual(['setPersistence:local', 'signInWithEmailAndPassword']);
  });

  it('não reconfigura a persistência a cada login', async () => {
    // Uma vez por sessão basta; repetir é ida extra ao IndexedDB em máquina
    // de laboratório, que já é lenta.
    const ordem = espiarOrdem();

    await entrarComGoogle();
    await entrarComGithub();

    expect(ordem.filter((evento) => evento.startsWith('setPersistence'))).toHaveLength(1);
  });
});

describe('login social (AC-AUTH-03, AC-AUTH-04)', () => {
  it('o Google entra por signInWithPopup com GoogleAuthProvider', async () => {
    const popup = jest.spyOn(firebaseAuth, 'signInWithPopup').mockResolvedValue({ user: ANA });

    await entrarComGoogle();

    expect(popup).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(firebaseAuth.GoogleAuthProvider)
    );
  });

  it('o GitHub entra por signInWithPopup com GithubAuthProvider', async () => {
    const popup = jest.spyOn(firebaseAuth, 'signInWithPopup').mockResolvedValue({ user: ANA });

    await entrarComGithub();

    expect(popup).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(firebaseAuth.GithubAuthProvider)
    );
  });

  it('devolve o usuário autenticado', async () => {
    __definirUsuarioDoPopup(ANA);

    await expect(entrarComGoogle()).resolves.toEqual(ANA);
    await expect(entrarComGithub()).resolves.toEqual(ANA);
  });

  it('propaga o erro em vez de exibi-lo — quem renderiza é a interface', async () => {
    __definirUsuarioDoPopup(null);
    const alerta = jest.spyOn(window, 'alert').mockImplementation(() => {});

    await expect(entrarComGoogle()).rejects.toMatchObject({
      code: 'auth/popup-closed-by-user',
    });
    expect(alerta).not.toHaveBeenCalled();
  });
});

describe('login por e-mail e senha (AC-AUTH-02)', () => {
  it('devolve o usuário quando a credencial confere', async () => {
    __registrarCredencial('ana@senai.br', 'senha123', { uid: 'uid-ana' });

    await expect(entrarComEmailESenha('ana@senai.br', 'senha123')).resolves.toMatchObject({
      uid: 'uid-ana',
    });
  });

  it('propaga o erro de credencial recusada', async () => {
    await expect(entrarComEmailESenha('ana@senai.br', 'errada')).rejects.toMatchObject({
      code: 'auth/invalid-credential',
    });
  });
});

describe('observarAutenticacao e sair', () => {
  it('avisa o assinante do estado corrente e das mudanças', async () => {
    const assinante = jest.fn();

    observarAutenticacao(assinante);
    expect(assinante).toHaveBeenCalledWith(null);

    __definirUsuarioAtual(ANA);
    expect(assinante).toHaveBeenLastCalledWith(ANA);
  });

  it('devolve uma função que cancela a inscrição', async () => {
    const assinante = jest.fn();

    const cancelar = observarAutenticacao(assinante);
    cancelar();
    __definirUsuarioAtual(ANA);

    expect(assinante).not.toHaveBeenCalledWith(ANA);
  });

  it('sair encerra a sessão do Firebase', async () => {
    __definirUsuarioAtual(ANA);
    const assinante = jest.fn();
    observarAutenticacao(assinante);

    await sair();

    expect(assinante).toHaveBeenLastCalledWith(null);
  });
});
