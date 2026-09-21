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
  __confirmarCarimbos,
  __definirRelogioDoServidor,
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
    __confirmarCarimbos();

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

  // Asserção reescrita pela task 02, e reescrita para mais forte. Antes ela
  // afirmava que o sentinela de `serverTimestamp()` ficava gravado no banco,
  // que era só o que o fake da task 01 sabia representar. O fake agora tem as
  // duas fases do SDK real, então dá para afirmar o que o critério de fato
  // pede: o valor que sobra no documento é o instante do **servidor**, e não
  // um instante qualquer que a máquina pudesse ter produzido.
  it('grava criadoEm como timestamp do servidor, não como relógio do cliente', async () => {
    // AC-AUTH-01 e AC-TEMPO-01: o relógio das máquinas do laboratório não é
    // confiável, então a marca de criação tem que vir do servidor.
    __definirRelogioDoServidor('2020-01-01T00:00:00.000Z');

    await garantirPerfil(ANA_DO_GOOGLE);

    // Fase 1: escrita otimista, campo ainda vazio.
    expect((await usuariosGravados())[0].criadoEm).toBeNull();

    // Fase 2: o servidor responde.
    __confirmarCarimbos();

    const [perfil] = await usuariosGravados();
    // Uma data que a máquina que roda este teste não teria como inventar.
    expect(perfil.criadoEm.toDate()).toEqual(new Date('2020-01-01T00:00:00.000Z'));
  });

  it('devolve o papel aluno e o perfil recém-criado', async () => {
    const resultado = await garantirPerfil(ANA_DO_GOOGLE);

    expect(resultado.papel).toBe('aluno');
    expect(resultado.perfil).toEqual(
      expect.objectContaining({ uid: 'uid-ana', tipo: 'aluno' })
    );
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

describe('resolução do papel — as duas fontes precisam concordar (AC-AUTH-06)', () => {
  const CARLOS = {
    uid: 'uid-carlos',
    email: 'carlos@senai.br',
    displayName: 'Carlos Lima',
    providerData: [{ providerId: 'password' }],
  };

  it('é professor quando usuarios/{uid}.tipo e autorizados/{email}.Tipo concordam', async () => {
    __semearColecao('usuarios', [
      {
        id: 'uid-carlos',
        uid: 'uid-carlos',
        nome: 'Carlos Lima',
        email: 'carlos@senai.br',
        tipo: 'professor',
      },
    ]);
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);

    await expect(garantirPerfil(CARLOS)).resolves.toMatchObject({ papel: 'professor' });
  });

  it('ignora a caixa alta do Tipo gravado em autorizados', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-carlos', uid: 'uid-carlos', email: 'carlos@senai.br', tipo: 'professor' },
    ]);
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'Professor' }]);

    await expect(garantirPerfil(CARLOS)).resolves.toMatchObject({ papel: 'professor' });
  });

  it('normaliza o e-mail antes de consultar autorizados', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-carlos', uid: 'uid-carlos', email: '  Carlos@Senai.BR ', tipo: 'professor' },
    ]);
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);

    await expect(garantirPerfil(CARLOS)).resolves.toMatchObject({ papel: 'professor' });
  });

  it('é aluno quando só usuarios diz professor — o cliente escreveu ali sozinho', async () => {
    // Esta é a escalada vista do lado do papel: as rules da v0.2.0 deixam
    // qualquer cliente gravar `tipo: "professor"` no próprio documento. A
    // concordância com `autorizados` é o que desarma isso.
    __semearColecao('usuarios', [
      { id: 'uid-ana', uid: 'uid-ana', email: 'ana@senai.br', tipo: 'professor' },
    ]);

    await expect(garantirPerfil(ANA_DO_GOOGLE)).resolves.toMatchObject({ papel: 'aluno' });
  });

  it('é aluno quando só autorizados diz professor e o documento ainda diz aluno', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-carlos', uid: 'uid-carlos', email: 'carlos@senai.br', tipo: 'aluno' },
    ]);
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);

    await expect(garantirPerfil(CARLOS)).resolves.toMatchObject({ papel: 'aluno' });
  });

  it('é aluno quando autorizados traz um Tipo diferente de professor', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-carlos', uid: 'uid-carlos', email: 'carlos@senai.br', tipo: 'professor' },
    ]);
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'monitor' }]);

    await expect(garantirPerfil(CARLOS)).resolves.toMatchObject({ papel: 'aluno' });
  });
});

describe('localStorage não decide papel nenhum (AC-AUTH-06, AC-SEC-03)', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('escrever tipoUsuario=professor no localStorage não promove ninguém', async () => {
    // O ataque da v0.2.0, inteiro, em uma linha de DevTools.
    localStorage.setItem('tipoUsuario', 'professor');
    localStorage.setItem('usuarioLogado', JSON.stringify({ tipo: 'professor' }));

    await expect(garantirPerfil(ANA_DO_GOOGLE)).resolves.toMatchObject({ papel: 'aluno' });
  });

  it('o documento criado no primeiro acesso também ignora o localStorage', async () => {
    localStorage.setItem('tipoUsuario', 'professor');

    await garantirPerfil(ANA_DO_GOOGLE);

    const [perfil] = await usuariosGravados();
    expect(perfil.tipo).toBe('aluno');
  });
});

describe('conta legada de professor cujo e-mail saiu de autorizados', () => {
  const PROFESSORA_LEGADA = {
    uid: 'uid-marta',
    email: 'marta@senai.br',
    displayName: 'Marta Reis',
    providerData: [{ providerId: 'password' }],
  };

  beforeEach(() => {
    // Documento no formato antigo: sem `criadoEm` e sem `provedor`.
    __semearColecao('usuarios', [
      {
        id: 'uid-marta',
        uid: 'uid-marta',
        nome: 'Marta Reis',
        email: 'marta@senai.br',
        tipo: 'professor',
      },
    ]);
  });

  it('rebaixa para aluno em vez de travar o acesso', async () => {
    await expect(garantirPerfil(PROFESSORA_LEGADA)).resolves.toMatchObject({ papel: 'aluno' });
  });

  it('registra o rebaixamento em log, para o administrador reconciliar', async () => {
    await garantirPerfil(PROFESSORA_LEGADA);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('autorizados'),
      expect.anything()
    );
  });

  it('não regrava nem apaga o documento legado', async () => {
    await garantirPerfil(PROFESSORA_LEGADA);

    expect(await usuariosGravados()).toEqual([
      {
        id: 'uid-marta',
        uid: 'uid-marta',
        nome: 'Marta Reis',
        email: 'marta@senai.br',
        tipo: 'professor',
      },
    ]);
  });

  it('avisa o chamador do rebaixamento, para a interface poder explicar', async () => {
    await expect(garantirPerfil(PROFESSORA_LEGADA)).resolves.toMatchObject({
      rebaixado: true,
    });
  });
});

describe('falha ao ler o Firestore não vira papel (regra 4 do desenho)', () => {
  it('propaga o erro em vez de assumir aluno', async () => {
    const firestore = require('firebase/firestore');
    jest.spyOn(firestore, 'getDoc').mockRejectedValue(new Error('rede caiu'));

    await expect(garantirPerfil(ANA_DO_GOOGLE)).rejects.toThrow('rede caiu');
  });

  it('propaga também quando é a leitura de autorizados que falha', async () => {
    const firestore = require('firebase/firestore');
    __semearColecao('usuarios', [
      { id: 'uid-ana', uid: 'uid-ana', email: 'ana@senai.br', tipo: 'professor' },
    ]);
    const original = firestore.getDoc.bind(firestore);
    jest.spyOn(firestore, 'getDoc').mockImplementation((referencia) => {
      if (referencia.__caminho.startsWith('autorizados/')) {
        return Promise.reject(new Error('rede caiu em autorizados'));
      }
      return original(referencia);
    });

    await expect(garantirPerfil(ANA_DO_GOOGLE)).rejects.toThrow('rede caiu em autorizados');
  });
});
