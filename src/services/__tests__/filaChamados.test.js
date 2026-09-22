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
import { ordenarFila, indexarPerksPorUid, TIPO_PRIORIDADE } from '../filaChamados';

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
