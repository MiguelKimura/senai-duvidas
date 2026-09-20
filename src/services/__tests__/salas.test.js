// A sala do professor — AC-SALA-01, AC-SALA-02, AC-SALA-06, AC-SEC-05.
//
// Este arquivo cobre o lado do cliente. O lado do servidor — quem pode criar,
// quem pode entrar, quem pode ler — é provado contra o emulador em
// `tests/rules/firestore.rules.test.js`, e as duas metades precisam existir:
// uma regra que só o cliente respeita não é regra, e um servidor que o cliente
// não sabe usar não vira tela.
import {
  doc,
  getDoc,
  getFirestore,
  Timestamp,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __recusarEscritaEm,
  __resetarFirestore,
} from 'firebase/firestore';
import { gerarPin, hashDePin } from '../pin';
import {
  COLECAO_DO_INDICE,
  COLECAO_DE_SALAS,
  ErroDeSala,
  TENTATIVAS_DE_PIN_UNICO,
  criarSala,
  validarDadosDaSala,
} from '../salas';

// O sorteio do PIN é um colaborador, não a unidade sob teste: para provar a
// colisão é preciso saber qual número vai sair. O resto do módulo continua
// sendo o de verdade.
jest.mock('../pin', () => {
  const real = jest.requireActual('../pin');

  return { ...real, gerarPin: jest.fn(real.gerarPin) };
});

const { gerarPin: gerarPinReal } = jest.requireActual('../pin');

const db = getFirestore();

const CARLOS = { uid: 'uid-carlos', nome: 'Carlos Lima', email: 'carlos@senai.br' };
const HORARIO_DO_SERVIDOR = '2026-02-10T13:45:00.000Z';

const DADOS = { nome: 'Mecânica 2º ano', curso: 'Mecânica — Turma B', anoLetivo: 2026 };

beforeEach(() => {
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  // `resetMocks` do react-scripts zera a implementação antes de cada teste.
  gerarPin.mockImplementation(gerarPinReal);
});

/** Os dados de um documento, pelo caminho completo. */
async function dadosDe(caminho) {
  return (await getDoc(doc(db, caminho))).data();
}

describe('validarDadosDaSala — AC-SALA-01', () => {
  it('devolve os campos limpos, com o ano letivo como número', () => {
    expect(validarDadosDaSala({ nome: '  Mecânica  ', curso: ' Turma B ', anoLetivo: '2026' })).toEqual(
      { nome: 'Mecânica', curso: 'Turma B', anoLetivo: 2026 }
    );
  });

  it.each([
    ['nome vazio', { ...DADOS, nome: '   ' }],
    ['curso vazio', { ...DADOS, curso: '' }],
    ['ano letivo ausente', { ...DADOS, anoLetivo: '' }],
    ['ano letivo que não é número', { ...DADOS, anoLetivo: 'ano que vem' }],
    ['ano letivo absurdo', { ...DADOS, anoLetivo: 1899 }],
    ['nome longo demais', { ...DADOS, nome: 'x'.repeat(81) }],
  ])('recusa %s', (_rotulo, dados) => {
    expect(() => validarDadosDaSala(dados)).toThrow(ErroDeSala);
  });

  it('explica o que falta, em português, sem código do Firebase', () => {
    expect(() => validarDadosDaSala({ ...DADOS, nome: '' })).toThrow(/nome/i);
    expect(() => validarDadosDaSala({ ...DADOS, anoLetivo: 1899 })).toThrow(/ano letivo/i);
  });
});

describe('criarSala — o documento da sala (AC-SALA-01, AC-SALA-05)', () => {
  it('grava nome, curso e ano letivo informados pelo professor', async () => {
    const { salaId } = await criarSala(DADOS, CARLOS);

    expect(await dadosDe(`${COLECAO_DE_SALAS}/${salaId}`)).toMatchObject({
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
    });
  });

  it('marca o professor como dono, com nome para a tela do aluno', async () => {
    const { salaId } = await criarSala(DADOS, CARLOS);

    expect(await dadosDe(`${COLECAO_DE_SALAS}/${salaId}`)).toMatchObject({
      professorUid: 'uid-carlos',
      professorNome: 'Carlos Lima',
    });
  });

  it('nasce ativa e sem data de arquivamento: vale o ano letivo inteiro', async () => {
    const { salaId } = await criarSala(DADOS, CARLOS);

    const sala = await dadosDe(`${COLECAO_DE_SALAS}/${salaId}`);
    expect(sala.ativa).toBe(true);
    expect(sala.arquivadaEm).toBeNull();
  });

  it('carimba criadaEm com o horário do servidor, não com o da máquina', async () => {
    const { salaId } = await criarSala(DADOS, CARLOS);

    __confirmarCarimbos();

    const sala = await dadosDe(`${COLECAO_DE_SALAS}/${salaId}`);
    expect(sala.criadaEm).toBeInstanceOf(Timestamp);
    expect(sala.criadaEm.toDate().toISOString()).toBe(HORARIO_DO_SERVIDOR);
  });

  it('não grava nada quando os dados não passam na validação', async () => {
    await expect(criarSala({ ...DADOS, nome: '' }, CARLOS)).rejects.toThrow(ErroDeSala);

    expect(gerarPin).not.toHaveBeenCalled();
  });
});

describe('criarSala — o PIN (AC-SALA-02, AC-SEC-05)', () => {
  it('devolve um PIN de seis dígitos para o professor ver uma vez', async () => {
    const { pin } = await criarSala(DADOS, CARLOS);

    expect(pin).toMatch(/^[0-9]{6}$/);
  });

  it('NÃO grava o PIN em claro no documento da sala', async () => {
    const { salaId, pin } = await criarSala(DADOS, CARLOS);

    const sala = await dadosDe(`${COLECAO_DE_SALAS}/${salaId}`);

    expect(JSON.stringify(sala)).not.toContain(pin);
    expect(sala.pin).toBeUndefined();
    expect(sala.pinHash).toBeUndefined();
  });

  it('guarda o resumo num documento separado, fora do alcance do aluno', async () => {
    const { salaId, pin } = await criarSala(DADOS, CARLOS);

    const segredo = await dadosDe(`${COLECAO_DE_SALAS}/${salaId}/segredo/pin`);

    expect(segredo.hash).toBe(await hashDePin(pin, segredo.sal));
    expect(segredo.sal).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(segredo)).not.toContain(pin);
  });

  it('indexa o PIN para que o aluno consiga achar a sala', async () => {
    const { salaId, pin } = await criarSala(DADOS, CARLOS);

    expect(await dadosDe(`${COLECAO_DO_INDICE}/${pin}`)).toMatchObject({ salaId, ativo: true });
  });

  it('o índice não carrega resumo nem sal: quem o lê não ganha nada de outra sala', async () => {
    const { pin } = await criarSala(DADOS, CARLOS);

    const indice = await dadosDe(`${COLECAO_DO_INDICE}/${pin}`);

    expect(indice.hash).toBeUndefined();
    expect(indice.sal).toBeUndefined();
  });
});

describe('criarSala — PIN único entre salas ativas (AC-SALA-02)', () => {
  it('sorteia outro número quando o servidor recusa o PIN já usado', async () => {
    gerarPin.mockReturnValueOnce('111111').mockReturnValueOnce('222222');
    // A recusa é o que o Firestore devolve quando o documento do índice já
    // existe: a rule só permite `create`, então a segunda escrita no mesmo PIN
    // nunca passa — nem para o professor que é dono da outra sala.
    __recusarEscritaEm(`${COLECAO_DO_INDICE}/111111`);

    const { salaId, pin } = await criarSala(DADOS, CARLOS);

    expect(pin).toBe('222222');
    expect(await dadosDe(`${COLECAO_DO_INDICE}/222222`)).toMatchObject({ salaId });
  });

  it('o resumo gravado é o do PIN que sobreviveu à colisão', async () => {
    gerarPin.mockReturnValueOnce('111111').mockReturnValueOnce('222222');
    __recusarEscritaEm(`${COLECAO_DO_INDICE}/111111`);

    const { salaId, pin } = await criarSala(DADOS, CARLOS);

    const segredo = await dadosDe(`${COLECAO_DE_SALAS}/${salaId}/segredo/pin`);
    expect(segredo.hash).toBe(await hashDePin(pin, segredo.sal));
    expect(segredo.hash).not.toBe(await hashDePin('111111', segredo.sal));
  });

  it('desiste depois de muitas colisões, em vez de tentar para sempre', async () => {
    gerarPin.mockReturnValue('111111');
    for (let tentativa = 0; tentativa <= TENTATIVAS_DE_PIN_UNICO; tentativa += 1) {
      __recusarEscritaEm(`${COLECAO_DO_INDICE}/111111`);
    }

    await expect(criarSala(DADOS, CARLOS)).rejects.toThrow(ErroDeSala);
    expect(gerarPin).toHaveBeenCalledTimes(TENTATIVAS_DE_PIN_UNICO);
  });

  it('não engole erro que não seja recusa do servidor', async () => {
    gerarPin.mockImplementation(() => {
      throw new Error('Web Crypto indisponível');
    });

    await expect(criarSala(DADOS, CARLOS)).rejects.toThrow('Web Crypto indisponível');
  });
});

describe('criarSala — o professor já entra na própria sala (AC-SALA-06)', () => {
  it('cria o vínculo em salas/{salaId}/membros/{uid} com papel de professor', async () => {
    const { salaId } = await criarSala(DADOS, CARLOS);

    __confirmarCarimbos();

    const membro = await dadosDe(`${COLECAO_DE_SALAS}/${salaId}/membros/uid-carlos`);
    expect(membro).toMatchObject({
      nome: 'Carlos Lima',
      email: 'carlos@senai.br',
      papel: 'professor',
    });
    expect(membro.entrouEm).toBeInstanceOf(Timestamp);
  });

  it('espelha a sala em usuarios/{uid}/salas, que é por onde a lista é montada', async () => {
    const { salaId } = await criarSala(DADOS, CARLOS);

    expect(await dadosDe(`usuarios/uid-carlos/salas/${salaId}`)).toMatchObject({
      salaId,
      papel: 'professor',
    });
  });

  it('o espelho não guarda PIN nenhum', async () => {
    const { salaId, pin } = await criarSala(DADOS, CARLOS);

    const espelho = await dadosDe(`usuarios/uid-carlos/salas/${salaId}`);

    expect(JSON.stringify(espelho)).not.toContain(pin);
  });
});
