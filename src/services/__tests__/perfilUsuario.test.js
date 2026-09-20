// `garantirPerfil` — a única porta pela qual o papel do usuário é decidido.
//
// Na v0.2.0 o papel vinha de `localStorage.getItem('tipoUsuario')`: duas linhas
// no DevTools e o aluno abria a tela do professor. Aqui o papel passa a sair do
// Firestore, e de mais lugar nenhum.
//
// Primeiro ciclo: o documento `usuarios/{uid}` do primeiro login social.
// Antes desta task, quem entrava por Google ou GitHub não tinha documento
// nenhum, e o `Login` respondia "Usuário não encontrado no banco de dados" —
// a pessoa autenticava e ficava presa na tela de login.
import {
  collection,
  getDocs,
  getFirestore,
  query,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import { garantirPerfil } from '../perfilUsuario';

const db = getFirestore();

const ANA_DO_GOOGLE = {
  uid: 'uid-ana',
  email: 'ana@senai.br',
  displayName: 'Ana Souza',
  providerData: [{ providerId: 'google.com' }],
};

async function usuariosGravados() {
  const snapshot = await getDocs(query(collection(db, 'usuarios')));
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

beforeEach(() => {
  __resetarFirestore();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('primeiro acesso — o documento é criado (AC-AUTH-03, AC-AUTH-04)', () => {
  it('cria usuarios/{uid} com uid, nome, email, tipo aluno e criadoEm', async () => {
    await garantirPerfil(ANA_DO_GOOGLE);

    expect(await usuariosGravados()).toEqual([
      {
        id: 'uid-ana',
        uid: 'uid-ana',
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
        criadoEm: expect.anything(),
        provedor: 'google.com',
      },
    ]);
  });

  it('grava criadoEm como timestamp do servidor, não como relógio do cliente', async () => {
    // AC-AUTH-01 e AC-TEMPO-01: o relógio das máquinas do laboratório não é
    // confiável, então a marca de criação tem que vir do servidor.
    await garantirPerfil(ANA_DO_GOOGLE);

    const [perfil] = await usuariosGravados();
    expect(perfil.criadoEm).toEqual({ __tipo: 'serverTimestamp' });
  });

  it('devolve o papel aluno e o perfil recém-criado', async () => {
    const resultado = await garantirPerfil(ANA_DO_GOOGLE);

    expect(resultado.papel).toBe('aluno');
    expect(resultado.perfil).toEqual(expect.objectContaining({ uid: 'uid-ana', tipo: 'aluno' }));
    expect(resultado.criado).toBe(true);
  });

  it('registra o provedor do GitHub quando o login vem de lá', async () => {
    await garantirPerfil({
      ...ANA_DO_GOOGLE,
      providerData: [{ providerId: 'github.com' }],
    });

    const [perfil] = await usuariosGravados();
    expect(perfil.provedor).toBe('github.com');
  });

  it('cai para o trecho do e-mail quando o provedor não informa nome', async () => {
    // O GitHub só entrega `displayName` para quem preencheu o perfil por lá.
    await garantirPerfil({ ...ANA_DO_GOOGLE, displayName: null });

    const [perfil] = await usuariosGravados();
    expect(perfil.nome).toBe('ana');
  });

  it('não sobrescreve o documento de quem já existe', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-ana', uid: 'uid-ana', nome: 'Ana S.', email: 'ana@senai.br', tipo: 'aluno' },
    ]);

    const resultado = await garantirPerfil(ANA_DO_GOOGLE);

    expect(await usuariosGravados()).toEqual([
      { id: 'uid-ana', uid: 'uid-ana', nome: 'Ana S.', email: 'ana@senai.br', tipo: 'aluno' },
    ]);
    expect(resultado.criado).toBe(false);
  });

  it('recusa um usuário sem uid em vez de gravar lixo no banco', async () => {
    await expect(garantirPerfil({ email: 'ana@senai.br' })).rejects.toThrow(/uid/i);
    expect(await usuariosGravados()).toHaveLength(0);
  });
});
