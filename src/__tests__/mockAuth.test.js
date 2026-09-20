// O fake de Auth precisa suportar as DUAS formas de uso que convivem hoje no
// código: a modular (`onAuthStateChanged(auth, cb)`, usada em App.js) e a de
// método no objeto (`auth.onAuthStateChanged(cb)`, usada em Login.js). Fixar as
// duas aqui impede que a task 01, ao unificar o AuthContext, quebre em silêncio.
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  __definirUsuarioAtual,
  __resetarAuth,
  __registrarCredencial,
} from 'firebase/auth';

const auth = getAuth();

beforeEach(() => {
  __resetarAuth();
});

describe('fake de Auth', () => {
  it('começa sem usuário autenticado', () => {
    expect(auth.currentUser).toBeNull();
  });

  it('__definirUsuarioAtual publica o usuário em auth.currentUser', () => {
    __definirUsuarioAtual({ uid: 'uid-1', email: 'ana@senai.br', displayName: 'Ana' });

    expect(auth.currentUser.email).toBe('ana@senai.br');
  });

  it('notifica os ouvintes registrados na forma modular', () => {
    const ouvinte = jest.fn();
    onAuthStateChanged(auth, ouvinte);

    __definirUsuarioAtual({ uid: 'uid-1', email: 'ana@senai.br' });

    expect(ouvinte).toHaveBeenLastCalledWith(expect.objectContaining({ uid: 'uid-1' }));
  });

  it('notifica os ouvintes registrados como método do objeto auth', () => {
    const ouvinte = jest.fn();
    auth.onAuthStateChanged(ouvinte);

    __definirUsuarioAtual({ uid: 'uid-1', email: 'ana@senai.br' });

    expect(ouvinte).toHaveBeenLastCalledWith(expect.objectContaining({ uid: 'uid-1' }));
  });

  it('cancela a inscrição do ouvinte', () => {
    const ouvinte = jest.fn();
    const cancelar = onAuthStateChanged(auth, ouvinte);
    ouvinte.mockClear();

    cancelar();
    __definirUsuarioAtual({ uid: 'uid-1' });

    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('signInWithEmailAndPassword aceita credencial registrada', async () => {
    __registrarCredencial('ana@senai.br', 'senha123', { uid: 'uid-1', displayName: 'Ana' });

    const credencial = await signInWithEmailAndPassword(auth, 'ana@senai.br', 'senha123');

    expect(credencial.user.uid).toBe('uid-1');
    expect(auth.currentUser.uid).toBe('uid-1');
  });

  it('signInWithEmailAndPassword rejeita credencial inválida com código do Firebase', async () => {
    await expect(signInWithEmailAndPassword(auth, 'ana@senai.br', 'errada')).rejects.toMatchObject({
      code: 'auth/invalid-credential',
    });
  });

  it('createUserWithEmailAndPassword cria e autentica o usuário', async () => {
    const credencial = await createUserWithEmailAndPassword(auth, 'novo@senai.br', 'senha123');

    expect(credencial.user.uid).toEqual(expect.any(String));
    expect(auth.currentUser.email).toBe('novo@senai.br');
  });

  it('createUserWithEmailAndPassword recusa e-mail já em uso', async () => {
    await createUserWithEmailAndPassword(auth, 'novo@senai.br', 'senha123');

    await expect(
      createUserWithEmailAndPassword(auth, 'novo@senai.br', 'outra123')
    ).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
  });

  it('updateProfile altera o displayName do usuário', async () => {
    const { user } = await createUserWithEmailAndPassword(auth, 'novo@senai.br', 'senha123');

    await updateProfile(user, { displayName: 'Novo Aluno' });

    expect(auth.currentUser.displayName).toBe('Novo Aluno');
  });

  it('signOut limpa o usuário atual e avisa os ouvintes', async () => {
    const ouvinte = jest.fn();
    onAuthStateChanged(auth, ouvinte);
    __definirUsuarioAtual({ uid: 'uid-1' });

    await signOut(auth);

    expect(auth.currentUser).toBeNull();
    expect(ouvinte).toHaveBeenLastCalledWith(null);
  });
});
