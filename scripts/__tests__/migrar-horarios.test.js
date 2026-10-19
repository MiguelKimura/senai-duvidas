// Migração de `horarioIso` — a rede de segurança da compatibilidade futura.
//
// A v0.4.0 passa a gravar `horario` como `Timestamp` do servidor. Um cliente
// que ainda não atualizou faz `new Date(chamado.horario)` nesse valor e recebe
// `Invalid Date`. A mitigação é o campo aditivo `horarioIso`, gravado ao lado.
//
// Em uso normal quem preenche esse campo é o próprio cliente do autor, na
// confirmação do carimbo (`completarHorariosIso`). Sobram os documentos de
// quem não entrar mais no sistema — turma que terminou o curso, aluno que
// trocou de conta. É para esses que este script existe.
//
// O que o script toca em produção é dado real de fila, então as exigências
// são duras e estão todas testadas aqui: idempotência, `--dry-run` de
// verdade, e `horario` jamais tocado. A parte que fala com o Firestore fica
// isolada na casca do arquivo; o que se testa aqui é a decisão.
const {
  planejar,
  migrar,
  formatarRelatorio,
  paraDataDoDocumento,
  lerOpcoes,
} = require('../migrar-horarios');
const { paraData } = require('../../src/services/tempo');
const { Timestamp } = require('firebase/firestore');

/** Um documento como o script o recebe do Firestore: id mais os dados. */
function documento(id, dados) {
  return { id, dados };
}

const INSTANTE = '2026-03-10T17:45:00.000Z';
const CARIMBO = Timestamp.fromDate(new Date(INSTANTE));

describe('paraDataDoDocumento — a mesma leitura dupla do app', () => {
  // O script roda em Node contra o Admin SDK e não pode importar o módulo do
  // app, que é ESM e depende do `firebase/firestore` do navegador. A conversão
  // é, por isso, duplicada — e a duplicação fica presa por este teste: se
  // `services/tempo.js` aprender um formato novo e o script não, aqui quebra.
  it.each([
    ['Timestamp do servidor', CARIMBO],
    ['string ISO da v0.1.0', INSTANTE],
    ['Timestamp serializado como objeto puro', { seconds: 1773164700, nanoseconds: 0 }],
    ['Date', new Date(INSTANTE)],
    ['null, o carimbo que o servidor ainda não resolveu', null],
    ['campo ausente', undefined],
    ['string que não é data', 'ontem à tarde'],
  ])('concorda com paraData para %s', (_nome, valor) => {
    const doScript = paraDataDoDocumento(valor);
    const doApp = paraData(valor);

    expect(doScript && doScript.getTime()).toEqual(doApp && doApp.getTime());
  });
});

describe('planejar — quem precisa de horarioIso', () => {
  it('inclui o documento com Timestamp e sem horarioIso', () => {
    const plano = planejar([documento('a', { horario: CARIMBO })]);

    expect(plano.paraGravar).toEqual([{ id: 'a', horarioIso: INSTANTE }]);
  });

  it('inclui o documento da v0.1.0, com horario em string ISO', () => {
    const plano = planejar([documento('velho', { horario: INSTANTE })]);

    expect(plano.paraGravar).toEqual([{ id: 'velho', horarioIso: INSTANTE }]);
  });

  it('deixa em paz quem já tem horarioIso', () => {
    const plano = planejar([documento('a', { horario: CARIMBO, horarioIso: INSTANTE })]);

    expect(plano.paraGravar).toEqual([]);
    expect(plano.jaTinham).toBe(1);
  });

  it('não regrava horarioIso divergente: o que está lá pode ter razão de estar', () => {
    const plano = planejar([
      documento('a', { horario: CARIMBO, horarioIso: '2020-01-01T00:00:00.000Z' }),
    ]);

    expect(plano.paraGravar).toEqual([]);
  });

  it('pula o documento cujo horario o servidor ainda não carimbou', () => {
    const plano = planejar([documento('emVoo', { horario: null })]);

    expect(plano.paraGravar).toEqual([]);
    expect(plano.semHorarioLegivel).toBe(1);
  });

  it('pula o documento sem horario nenhum, em vez de inventar um', () => {
    const plano = planejar([documento('semCampo', { descricao: 'oi' })]);

    expect(plano.paraGravar).toEqual([]);
    expect(plano.semHorarioLegivel).toBe(1);
  });

  it('nunca inclui o campo horario no que vai ser gravado', () => {
    const plano = planejar([documento('a', { horario: CARIMBO })]);

    plano.paraGravar.forEach((escrita) => {
      expect(Object.keys(escrita)).toEqual(['id', 'horarioIso']);
    });
  });

  it('conta os três destinos de uma coleção mista', () => {
    const plano = planejar([
      documento('novo', { horario: CARIMBO }),
      documento('velho', { horario: INSTANTE }),
      documento('pronto', { horario: CARIMBO, horarioIso: INSTANTE }),
      documento('emVoo', { horario: null }),
    ]);

    expect(plano).toMatchObject({
      total: 4,
      jaTinham: 1,
      semHorarioLegivel: 1,
    });
    expect(plano.paraGravar.map((escrita) => escrita.id)).toEqual(['novo', 'velho']);
  });
});

describe('migrar — a execução', () => {
  it('grava horarioIso em quem precisa', async () => {
    const gravadas = [];

    const relatorio = await migrar({
      documentos: [documento('a', { horario: CARIMBO })],
      gravar: async (id, campos) => gravadas.push([id, campos]),
    });

    expect(gravadas).toEqual([['a', { horarioIso: INSTANTE }]]);
    expect(relatorio.atualizados).toBe(1);
  });

  it('com --dry-run não grava nada, mas relata o que gravaria', async () => {
    const gravar = jest.fn();

    const relatorio = await migrar({
      documentos: [documento('a', { horario: CARIMBO })],
      gravar,
      simulacao: true,
    });

    expect(gravar).not.toHaveBeenCalled();
    expect(relatorio).toMatchObject({ simulacao: true, atualizados: 1 });
  });

  it('é idempotente: a segunda passada não grava nada', async () => {
    const banco = [documento('a', { horario: CARIMBO })];
    const gravar = jest.fn(async (id, campos) => {
      const alvo = banco.find((item) => item.id === id);
      alvo.dados = { ...alvo.dados, ...campos };
    });

    await migrar({ documentos: banco, gravar });
    gravar.mockClear();

    const segunda = await migrar({ documentos: banco, gravar });

    expect(gravar).not.toHaveBeenCalled();
    expect(segunda.atualizados).toBe(0);
    expect(segunda.jaTinham).toBe(1);
  });

  it('preserva o horario original intacto', async () => {
    const alvo = documento('a', { horario: CARIMBO });
    const gravar = async (id, campos) => {
      alvo.dados = { ...alvo.dados, ...campos };
    };

    await migrar({ documentos: [alvo], gravar });

    expect(alvo.dados.horario).toBe(CARIMBO);
  });

  it('segue em frente quando uma escrita falha, e relata a falha', async () => {
    const gravar = jest.fn(async (id) => {
      if (id === 'quebrado') throw new Error('permissão negada');
    });

    const relatorio = await migrar({
      documentos: [
        documento('quebrado', { horario: CARIMBO }),
        documento('ok', { horario: CARIMBO }),
      ],
      gravar,
    });

    expect(relatorio.atualizados).toBe(1);
    expect(relatorio.falhas).toEqual([{ id: 'quebrado', erro: 'permissão negada' }]);
  });
});

describe('lerOpcoes — a linha de comando', () => {
  it('sem argumento nenhum, NÃO é simulação — mas exige --confirmar', () => {
    expect(lerOpcoes([])).toMatchObject({ simulacao: false, confirmado: false });
  });

  it('reconhece --dry-run', () => {
    expect(lerOpcoes(['--dry-run'])).toMatchObject({ simulacao: true });
  });

  it('reconhece --confirmar, que é o que libera a escrita', () => {
    expect(lerOpcoes(['--confirmar'])).toMatchObject({ confirmado: true });
  });

  it('lê as coleções a migrar, com chamados e chat por padrão', () => {
    expect(lerOpcoes([]).colecoes).toEqual(['chamados', 'chat']);
    expect(lerOpcoes(['--colecao', 'chat']).colecoes).toEqual(['chat']);
  });
});

describe('formatarRelatorio', () => {
  const RELATORIO = {
    colecao: 'chamados',
    total: 4,
    atualizados: 2,
    jaTinham: 1,
    semHorarioLegivel: 1,
    falhas: [],
    simulacao: false,
  };

  it('diz quantos documentos foram atualizados', () => {
    expect(formatarRelatorio(RELATORIO)).toContain('2');
    expect(formatarRelatorio(RELATORIO)).toContain('chamados');
  });

  it('avisa, em alto e bom som, quando foi só simulação', () => {
    expect(formatarRelatorio({ ...RELATORIO, simulacao: true })).toMatch(/simula|dry-run/i);
  });

  it('lista as falhas quando há falhas', () => {
    const texto = formatarRelatorio({
      ...RELATORIO,
      falhas: [{ id: 'quebrado', erro: 'permissão negada' }],
    });

    expect(texto).toContain('quebrado');
    expect(texto).toContain('permissão negada');
  });
});
