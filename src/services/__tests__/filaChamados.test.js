// A ordenação da fila com perks — AC-PERK-09, AC-PERK-02, AC-CHAMADO-03.
//
// Esta é a parte da task 07 que exige mais rigor, e o motivo não é técnico: a
// fila é o que o professor usa na frente de quarenta pessoas. Uma ordenação
// que muda de máquina para máquina — porque dois chamados empataram no
// carimbo, porque um relógio está adiantado — vira briga em sala, e a briga
// não é sobre software.
//
// Por isso `ordenarFila` é função **pura**: recebe os chamados, os perks e o
// instante do servidor, e não lê relógio nenhum. Tudo o que decide a ordem
// entra por parâmetro, e é isso que torna cada regra abaixo verificável.
import { Timestamp } from 'firebase/firestore';
import { agoraDoServidor } from '../tempo';
import {
  indexarPerksPorUid,
  nivelDePrioridade,
  ordenarFila,
  perkEstaAtivo,
  TIPO_PRIORIDADE,
} from '../filaChamados';

const AGORA = new Date('2026-09-22T12:00:00.000Z');

/** Chamado no formato da v0.5.0 em diante: `autorUid` e `horario` do servidor. */
function chamado(id, sobrescritas = {}) {
  return {
    id,
    autorUid: 'uid-ana',
    horario: '2026-09-22T10:00:00.000Z',
    ...sobrescritas,
  };
}

/** Perk de prioridade permanente, do nível pedido. */
function perkDePrioridade(alunoUid, nivel, sobrescritas = {}) {
  return {
    id: `perk-${alunoUid}-${nivel}`,
    alunoUid,
    tipo: TIPO_PRIORIDADE,
    nivel,
    expiraEm: null,
    revogadoEm: null,
    ...sobrescritas,
  };
}

/** Os ids da fila, na ordem em que `ordenarFila` os devolveu. */
function ordem(chamados, perks = [], agora = AGORA) {
  return ordenarFila(chamados, indexarPerksPorUid(perks), agora).map((item) => item.id);
}

// O teste de regressão mais importante da task: uma sala sem perk nenhum —
// que é toda sala da v0.8.0 — tem que produzir EXATAMENTE a ordem de antes.
describe('ordenarFila — sem perk nenhum, a fila da v0.8.0 (AC-CHAMADO-03)', () => {
  it('ordena por horário crescente, o mais antigo primeiro', () => {
    const fila = [
      chamado('c2', { horario: '2026-09-22T10:05:00.000Z' }),
      chamado('c3', { horario: '2026-09-22T10:10:00.000Z' }),
      chamado('c1', { horario: '2026-09-22T10:00:00.000Z' }),
    ];

    expect(ordem(fila)).toEqual(['c1', 'c2', 'c3']);
  });

  it('entende Timestamp do servidor e string ISO da v0.1.0 na mesma fila', () => {
    const fila = [
      chamado('novo', { horario: Timestamp.fromDate(new Date('2026-09-22T10:05:00.000Z')) }),
      chamado('antigo', { horario: '2026-09-22T10:00:00.000Z' }),
    ];

    expect(ordem(fila)).toEqual(['antigo', 'novo']);
  });

  it('não modifica a lista recebida', () => {
    const fila = [chamado('c2', { horario: '2026-09-22T10:05:00.000Z' }), chamado('c1')];
    const copia = [...fila];

    ordenarFila(fila, new Map(), AGORA);

    expect(fila).toEqual(copia);
  });
});

describe('ordenarFila — prioridade do perk (AC-PERK-02)', () => {
  it('põe o chamado de quem tem prioridade nível 1 acima de quem não tem perk', () => {
    const fila = [
      chamado('sem-perk', { autorUid: 'uid-bruno', horario: '2026-09-22T09:00:00.000Z' }),
      chamado('com-perk', { autorUid: 'uid-ana', horario: '2026-09-22T10:00:00.000Z' }),
    ];

    expect(ordem(fila, [perkDePrioridade('uid-ana', 1)])).toEqual(['com-perk', 'sem-perk']);
  });

  it('põe o nível 2 acima do nível 1', () => {
    const fila = [
      chamado('nivel-1', { autorUid: 'uid-ana', horario: '2026-09-22T09:00:00.000Z' }),
      chamado('nivel-2', { autorUid: 'uid-bruno', horario: '2026-09-22T10:00:00.000Z' }),
    ];
    const perks = [perkDePrioridade('uid-ana', 1), perkDePrioridade('uid-bruno', 2)];

    expect(ordem(fila, perks)).toEqual(['nivel-2', 'nivel-1']);
  });

  it('usa o maior nível quando o aluno acumulou mais de um perk de prioridade', () => {
    const fila = [
      chamado('acumulou', { autorUid: 'uid-ana', horario: '2026-09-22T10:00:00.000Z' }),
      chamado('nivel-2', { autorUid: 'uid-bruno', horario: '2026-09-22T09:00:00.000Z' }),
    ];
    const perks = [
      perkDePrioridade('uid-ana', 1),
      perkDePrioridade('uid-ana', 3),
      perkDePrioridade('uid-bruno', 2),
    ];

    expect(ordem(fila, perks)).toEqual(['acumulou', 'nivel-2']);
  });

  // O perk de destaque é reconhecimento, e reconhecimento não fura fila: se
  // qualquer premiação empurrasse o chamado para cima, o professor perderia a
  // única premiação que pode dar sem alterar a ordem de atendimento.
  it('ignora perk que não é de prioridade', () => {
    const fila = [
      chamado('destaque', { autorUid: 'uid-ana', horario: '2026-09-22T10:00:00.000Z' }),
      chamado('ninguem', { autorUid: 'uid-bruno', horario: '2026-09-22T09:00:00.000Z' }),
    ];
    const perks = [perkDePrioridade('uid-ana', 3, { tipo: 'destaque' })];

    expect(ordem(fila, perks)).toEqual(['ninguem', 'destaque']);
  });

  it('dentro da mesma prioridade, o mais antigo vem primeiro', () => {
    const fila = [
      chamado('perk-tarde', { autorUid: 'uid-ana', horario: '2026-09-22T10:00:00.000Z' }),
      chamado('perk-cedo', { autorUid: 'uid-carla', horario: '2026-09-22T09:30:00.000Z' }),
      chamado('sem-perk', { autorUid: 'uid-bruno', horario: '2026-09-22T09:00:00.000Z' }),
    ];
    const perks = [perkDePrioridade('uid-ana', 2), perkDePrioridade('uid-carla', 2)];

    expect(ordem(fila, perks)).toEqual(['perk-cedo', 'perk-tarde', 'sem-perk']);
  });

  it('não dá prioridade a chamado da v0.1.0, que não tem autorUid', () => {
    const fila = [
      { id: 'legado', nome: 'Ana Souza', horario: '2026-09-22T10:00:00.000Z' },
      chamado('novo', { autorUid: 'uid-bruno', horario: '2026-09-22T11:00:00.000Z' }),
    ];

    expect(ordem(fila, [perkDePrioridade('uid-ana', 3)])).toEqual(['legado', 'novo']);
  });
});

describe('ordenarFila — desempate determinístico (AC-PERK-09)', () => {
  // Dois alunos que apertam Enter no mesmo segundo recebem o MESMO carimbo do
  // servidor. Sem um desempate explícito, a ordem passa a ser a que o
  // Firestore devolveu — que não é a mesma na tela do professor e na do aluno.
  it('desempata timestamps iguais pelo id do chamado, em ordem crescente', () => {
    const mesmoInstante = '2026-09-22T10:00:00.000Z';
    const fila = [
      chamado('c-zeta', { horario: mesmoInstante }),
      chamado('c-alfa', { horario: mesmoInstante }),
      chamado('c-meio', { horario: mesmoInstante }),
    ];

    expect(ordem(fila)).toEqual(['c-alfa', 'c-meio', 'c-zeta']);
  });

  it('chega ao mesmo resultado qualquer que seja a ordem de entrada', () => {
    const mesmoInstante = '2026-09-22T10:00:00.000Z';
    const fila = [
      chamado('c-zeta', { horario: mesmoInstante }),
      chamado('c-alfa', { horario: mesmoInstante }),
      chamado('c-meio', { horario: mesmoInstante }),
    ];

    expect(ordem([...fila].reverse())).toEqual(ordem(fila));
  });
});

describe('ordenarFila — atendidos e pendentes (AC-CHAMADO-03, AC-TEMPO-06)', () => {
  it('manda o chamado atendido para depois de todos os não atendidos', () => {
    const fila = [
      chamado('atendido', { horario: '2026-09-22T08:00:00.000Z', atendido: true }),
      chamado('aberto', { horario: '2026-09-22T11:00:00.000Z', atendido: false }),
    ];

    expect(ordem(fila)).toEqual(['aberto', 'atendido']);
  });

  // Atender primeiro é o ponto do perk. Depois de atendido, ele deixa de
  // valer: manter o chamado resolvido no topo empurraria para baixo quem
  // ainda está esperando, que é o contrário do que o professor quis.
  it('o perk de prioridade não resgata um chamado já atendido', () => {
    const fila = [
      chamado('atendido-com-perk', { autorUid: 'uid-ana', atendido: true }),
      chamado('aberto-sem-perk', { autorUid: 'uid-bruno', atendido: false }),
    ];

    expect(ordem(fila, [perkDePrioridade('uid-ana', 3)])).toEqual([
      'aberto-sem-perk',
      'atendido-com-perk',
    ]);
  });

  it('trata chamado da v0.1.0, que não tem o campo atendido, como não atendido', () => {
    const fila = [
      chamado('atendido', { horario: '2026-09-22T08:00:00.000Z', atendido: true }),
      { id: 'legado', nome: 'Ana Souza', horario: '2026-09-22T11:00:00.000Z' },
    ];

    expect(ordem(fila)).toEqual(['legado', 'atendido']);
  });

  // Enquanto o `serverTimestamp()` não volta, o card não tem posição: jogá-lo
  // no meio da fila com um horário inventado é exatamente o que a task 02
  // proibiu. Ele espera no fim da própria faixa até o carimbo chegar.
  it('joga o chamado sem carimbo confirmado para o fim da faixa dele', () => {
    const fila = [
      chamado('pendente', { horario: null }),
      chamado('confirmado', { horario: '2026-09-22T11:00:00.000Z' }),
    ];

    expect(ordem(fila)).toEqual(['confirmado', 'pendente']);
  });

  it('o pendente de quem tem perk continua na faixa do perk, e não no fim da fila', () => {
    const fila = [
      chamado('pendente-com-perk', { autorUid: 'uid-ana', horario: null }),
      chamado('confirmado-sem-perk', {
        autorUid: 'uid-bruno',
        horario: '2026-09-22T09:00:00.000Z',
      }),
    ];

    expect(ordem(fila, [perkDePrioridade('uid-ana', 2)])).toEqual([
      'pendente-com-perk',
      'confirmado-sem-perk',
    ]);
  });

  it('desempata dois pendentes da mesma faixa pelo id, como faz com os confirmados', () => {
    const fila = [
      chamado('p-zeta', { horario: null }),
      chamado('p-alfa', { horario: null }),
    ];

    expect(ordem(fila)).toEqual(['p-alfa', 'p-zeta']);
  });
});

// A propriedade que o AC-PERK-09 realmente pede: não é "a ordem está certa
// neste exemplo", é "a ordem não depende da ordem de chegada". O Firestore não
// promete entregar os documentos sempre na mesma sequência, e o professor e o
// aluno recebem o mesmo snapshot por caminhos diferentes.
describe('ordenarFila — propriedade: a ordem não depende da entrada (AC-PERK-09)', () => {
  /**
   * Gerador pseudoaleatório com semente fixa (xorshift32).
   *
   * `Math.random()` tornaria a falha irreprodutível: o teste quebraria uma vez
   * a cada tantas execuções e ninguém conseguiria reencenar o caso. Com
   * semente, a lista embaralhada número 837 é sempre a mesma.
   */
  function sorteador(semente) {
    let estado = semente;

    return () => {
      estado ^= estado << 13;
      estado ^= estado >>> 17;
      estado ^= estado << 5;
      estado >>>= 0;

      return estado / 0x100000000;
    };
  }

  function embaralhar(lista, sortear) {
    const copia = [...lista];

    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = Math.floor(sortear() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }

    return copia;
  }

  it('1000 embaralhamentos da mesma fila produzem exatamente a mesma saída', () => {
    const sortear = sorteador(20260922);
    const autores = ['uid-ana', 'uid-bruno', 'uid-carla', 'uid-diego'];

    // Carimbos repetidos de propósito: o empate é o caso em que uma ordenação
    // sem desempate explícito revela a não determinação.
    const instantes = [
      '2026-09-22T10:00:00.000Z',
      '2026-09-22T10:00:00.000Z',
      '2026-09-22T10:05:00.000Z',
      null,
    ];

    const fila = Array.from({ length: 40 }, (_, indice) => ({
      id: `chamado-${String(indice).padStart(2, '0')}`,
      autorUid: autores[indice % autores.length],
      horario: instantes[indice % instantes.length],
      atendido: indice % 5 === 0,
    }));

    const perks = [
      perkDePrioridade('uid-ana', 1),
      perkDePrioridade('uid-bruno', 3),
      perkDePrioridade('uid-carla', 2, { expiraEm: '2026-09-21T12:00:00.000Z' }),
    ];

    const esperado = ordem(fila, perks);

    for (let tentativa = 0; tentativa < 1000; tentativa += 1) {
      expect(ordem(embaralhar(fila, sortear), perks)).toEqual(esperado);
    }
  });

  it('a saída embaralhada respeita as faixas: nenhum atendido antes de um aberto', () => {
    const sortear = sorteador(7);
    const fila = Array.from({ length: 30 }, (_, indice) => ({
      id: `chamado-${String(indice).padStart(2, '0')}`,
      autorUid: 'uid-ana',
      horario: '2026-09-22T10:00:00.000Z',
      atendido: indice % 3 === 0,
    }));

    const resultado = ordenarFila(embaralhar(fila, sortear), new Map(), AGORA);
    const primeiroAtendido = resultado.findIndex((item) => item.atendido === true);
    const ultimoAberto = resultado.map((item) => item.atendido === true).lastIndexOf(false);

    expect(primeiroAtendido).toBeGreaterThan(ultimoAberto);
  });
});

describe('perkEstaAtivo — a validade conferida pelo servidor (AC-PERK-03)', () => {
  it('o perk permanente, sem data de validade, vale sempre', () => {
    expect(perkEstaAtivo(perkDePrioridade('uid-ana', 1), AGORA)).toBe(true);
  });

  it('o perk com validade no futuro vale', () => {
    const perk = perkDePrioridade('uid-ana', 1, { expiraEm: '2026-09-29T12:00:00.000Z' });

    expect(perkEstaAtivo(perk, AGORA)).toBe(true);
  });

  it('o perk com validade no passado não vale mais', () => {
    const perk = perkDePrioridade('uid-ana', 1, { expiraEm: '2026-09-21T12:00:00.000Z' });

    expect(perkEstaAtivo(perk, AGORA)).toBe(false);
  });

  it('o perk revogado não vale, mesmo com validade no futuro', () => {
    const perk = perkDePrioridade('uid-ana', 1, {
      expiraEm: '2026-09-29T12:00:00.000Z',
      revogadoEm: '2026-09-22T09:00:00.000Z',
    });

    expect(perkEstaAtivo(perk, AGORA)).toBe(false);
  });

  // Conservador de propósito: sem instante confiável, o sistema não concede
  // privilégio. O perk permanente não depende de relógio nenhum e continua.
  it('sem instante de referência, o perk com validade não conta', () => {
    const comValidade = perkDePrioridade('uid-ana', 1, { expiraEm: '2026-09-29T12:00:00.000Z' });

    expect(perkEstaAtivo(comValidade, null)).toBe(false);
    expect(perkEstaAtivo(perkDePrioridade('uid-ana', 1), null)).toBe(true);
  });

  it('nivelDePrioridade desconsidera o perk expirado e cai para a faixa 0', () => {
    const perks = [perkDePrioridade('uid-ana', 3, { expiraEm: '2026-09-21T12:00:00.000Z' })];

    expect(nivelDePrioridade(perks, AGORA)).toBe(0);
  });
});

describe('ordenarFila — expiração pelo horário do servidor (AC-PERK-03, AC-SEC-03)', () => {
  const EXPIRADO = '2026-09-21T12:00:00.000Z';

  function filaDeDois() {
    return [
      chamado('com-perk-vencido', { autorUid: 'uid-ana', horario: '2026-09-22T10:00:00.000Z' }),
      chamado('sem-perk', { autorUid: 'uid-bruno', horario: '2026-09-22T09:00:00.000Z' }),
    ];
  }

  it('o perk vencido deixa de furar a fila', () => {
    const perks = [perkDePrioridade('uid-ana', 3, { expiraEm: EXPIRADO })];

    expect(ordem(filaDeDois(), perks)).toEqual(['sem-perk', 'com-perk-vencido']);
  });

  it('o perk revogado deixa de furar a fila na mesma hora', () => {
    const perks = [
      perkDePrioridade('uid-ana', 3, { revogadoEm: '2026-09-22T11:00:00.000Z' }),
    ];

    expect(ordem(filaDeDois(), perks)).toEqual(['sem-perk', 'com-perk-vencido']);
  });

  // O ataque: a aluna atrasa o relógio do Windows em dois dias para que o perk
  // vencido volte a valer. O `agoraServidor` que a tela passa tem piso no
  // carimbo que o próprio Firestore gravou nos chamados da sala, e o piso
  // vence o relógio adulterado.
  it('atrasar o relógio da máquina não revive o perk vencido', () => {
    const fila = filaDeDois();
    const relogioAdulterado = new Date('2026-09-20T12:00:00.000Z');
    const carimbosDaSala = fila.map((item) => item.horario);

    const agora = agoraDoServidor(carimbosDaSala, relogioAdulterado);
    const perks = [perkDePrioridade('uid-ana', 3, { expiraEm: EXPIRADO })];

    expect(ordem(fila, perks, agora)).toEqual(['sem-perk', 'com-perk-vencido']);
  });

  it('adiantar o relógio da máquina não estende perk nenhum — só encurta o próprio', () => {
    const fila = filaDeDois();
    const relogioAdiantado = new Date('2026-10-22T12:00:00.000Z');
    const agora = agoraDoServidor(
      fila.map((item) => item.horario),
      relogioAdiantado
    );
    const perks = [perkDePrioridade('uid-ana', 3, { expiraEm: '2026-09-29T12:00:00.000Z' })];

    expect(ordem(fila, perks, agora)).toEqual(['sem-perk', 'com-perk-vencido']);
  });
});
