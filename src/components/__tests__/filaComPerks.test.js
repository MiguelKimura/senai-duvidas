// A fila das duas telas, agora composta com os perks — AC-PERK-02, AC-PERK-09,
// AC-CHAMADO-03 [REG], AC-PERF-03.
//
// `ordenarFila` já é provada exaustivamente em
// `src/services/__tests__/filaChamados.test.js`. O que este arquivo prova é
// outra coisa, e é a que quebra em produção: que as telas **usam** aquela
// função, com os perks da sala e com o instante do servidor — e não com o
// `sort` por horário que elas faziam até a v0.8.0.
//
// O teste de regressão mais importante da task está aqui: sala sem perk nenhum
// — que é toda sala da v0.8.0 — precisa produzir exatamente a mesma ordem de
// antes.
import React from 'react';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __definirRelogioDoServidor,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import TelaAluno from '../TelaAluno';
import TelaProfessor from '../TelaProfessor';
import { renderComProvedores } from '../../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const SALA = 'sala-a';
const CHAMADOS_DA_SALA = `salas/${SALA}/chamados`;
const PERKS_DA_SALA = `salas/${SALA}/perks`;

const HORARIO_DO_SERVIDOR = '2025-03-10T13:45:00.000Z';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** Bem no futuro e bem no passado, para não depender do relógio da máquina. */
const VALIDADE_NO_FUTURO = Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z'));
const VALIDADE_VENCIDA = Timestamp.fromDate(new Date('2020-01-01T00:00:00.000Z'));

/** Três chamados, um por minuto, dois autores. `c2` é o do meio. */
function semearFila() {
  __semearColecao(CHAMADOS_DA_SALA, [
    {
      id: 'c1',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      email: ANA.email,
      descricao: 'primeira',
      horario: '2025-03-10T10:00:00.000Z',
      atendido: false,
    },
    {
      id: 'c2',
      autorUid: 'uid-bruno',
      autorNome: 'Bruno Alves',
      email: 'bruno@senai.br',
      descricao: 'segunda',
      horario: '2025-03-10T10:05:00.000Z',
      atendido: false,
    },
    {
      id: 'c3',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      email: ANA.email,
      descricao: 'terceira',
      horario: '2025-03-10T10:10:00.000Z',
      atendido: false,
    },
  ]);
}

/** Um perk de prioridade para Bruno, o autor do chamado do meio. */
function perkDePrioridade(sobrescritas = {}) {
  return {
    id: 'perk-bruno',
    alunoUid: 'uid-bruno',
    alunoNome: 'Bruno Alves',
    tipo: 'prioridade',
    nivel: 2,
    justificativa: null,
    anunciarParaSala: false,
    concedidoPor: 'uid-carlos',
    concedidoPorNome: 'Carlos Lima',
    concedidoEm: Timestamp.fromDate(new Date('2025-03-10T09:00:00.000Z')),
    expiraEm: VALIDADE_NO_FUTURO,
    revogadoEm: null,
    // Já visto: senão a premiação em tela cheia cobriria a fila que o teste lê.
    visualizadoEm: Timestamp.fromDate(new Date('2025-03-10T09:01:00.000Z')),
    ...sobrescritas,
  };
}

/** A fila como ela aparece na tela, de cima para baixo. */
function ordemNaTela() {
  return [...document.querySelectorAll('.problema-card .texto-markdown')].map(
    (elemento) => elemento.textContent
  );
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
  semearFila();
});

describe.each([
  ['TelaAluno', TelaAluno],
  ['TelaProfessor', TelaProfessor],
])('%s — a fila composta com os perks da sala', (_nome, Tela) => {
  it('sem perk nenhum, mantém a ordem por horário crescente da v0.8.0 (AC-CHAMADO-03)', () => {
    renderComProvedores(<Tela salaId={SALA} />);

    expect(ordemNaTela()).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('põe o chamado de quem tem prioridade ativa no topo da fila (AC-PERK-02)', () => {
    __semearColecao(PERKS_DA_SALA, [perkDePrioridade()]);

    renderComProvedores(<Tela salaId={SALA} />);

    expect(ordemNaTela()).toEqual(['segunda', 'primeira', 'terceira']);
  });

  it('perk vencido não fura a fila (AC-PERK-03)', () => {
    __semearColecao(PERKS_DA_SALA, [perkDePrioridade({ expiraEm: VALIDADE_VENCIDA })]);

    renderComProvedores(<Tela salaId={SALA} />);

    expect(ordemNaTela()).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('perk revogado deixa de furar a fila (AC-PERK-07)', () => {
    __semearColecao(PERKS_DA_SALA, [
      perkDePrioridade({
        revogadoEm: Timestamp.fromDate(new Date('2025-03-10T09:30:00.000Z')),
      }),
    ]);

    renderComProvedores(<Tela salaId={SALA} />);

    expect(ordemNaTela()).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('perk que não é de prioridade não mexe na fila (AC-PERK-02)', () => {
    __semearColecao(PERKS_DA_SALA, [perkDePrioridade({ tipo: 'colaborador' })]);

    renderComProvedores(<Tela salaId={SALA} />);

    expect(ordemNaTela()).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('carrega os perks numa consulta só, com teto — nunca uma por card (AC-PERF-03)', () => {
    __semearColecao(PERKS_DA_SALA, [perkDePrioridade()]);

    const { __consultasAtivas } = jest.requireMock('firebase/firestore');

    renderComProvedores(<Tela salaId={SALA} />);

    const dePerks = __consultasAtivas().filter(
      (consulta) => consulta.caminho === PERKS_DA_SALA
    );

    expect(dePerks).toHaveLength(1);
    expect(dePerks[0].quantidade).toBeGreaterThan(0);
  });
});
