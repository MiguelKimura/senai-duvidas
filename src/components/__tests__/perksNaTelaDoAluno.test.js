// O que o aluno premiado vê na sala — AC-PERK-06.
//
// A vitrine é do aluno, e mora na tela dele. O professor tem a dele — o painel
// de concessão —, e misturar os dois daria ao professor uma vitrine de
// premiações que ele nunca vai receber.
import React from 'react';
import { screen, within } from '@testing-library/react';
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
const PERKS_DA_SALA = `salas/${SALA}/perks`;

const HORARIO_DO_SERVIDOR = '2026-09-22T12:00:00.000Z';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

const NO_FUTURO = Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z'));
const NO_PASSADO = Timestamp.fromDate(new Date('2020-01-01T00:00:00.000Z'));

function semearPerk(sobrescritas = {}) {
  __semearColecao(PERKS_DA_SALA, [
    {
      id: 'perk-ana',
      alunoUid: ANA.uid,
      alunoNome: 'Ana Souza',
      tipo: 'resolvedor',
      nivel: 2,
      justificativa: 'Resolveu sozinha o erro de driver.',
      anunciarParaSala: false,
      concedidoPor: 'uid-carlos',
      concedidoPorNome: 'Carlos Lima',
      concedidoEm: Timestamp.fromDate(new Date('2026-09-20T13:00:00.000Z')),
      expiraEm: NO_FUTURO,
      revogadoEm: null,
      // Já visto: a premiação em tela cheia cobriria a vitrine que o teste lê.
      visualizadoEm: Timestamp.fromDate(new Date('2026-09-20T13:01:00.000Z')),
      ...sobrescritas,
    },
  ]);
}

function vitrine() {
  return screen.queryByRole('region', { name: 'Minhas conquistas' });
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();

  // O jsdom não traz `matchMedia`, e o hook de movimento reduzido o consulta.
  window.matchMedia = jest.fn().mockImplementation((consulta) => ({
    matches: false,
    media: consulta,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
});

describe('TelaAluno — a vitrine "Minhas conquistas" (AC-PERK-06)', () => {
  it('mostra a vitrine com o perk ativo do aluno', () => {
    semearPerk();

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(within(vitrine()).getByText(/Resolvedor/)).toBeInTheDocument();
  });

  it('mostra o perk vencido no histórico da vitrine, sem apagá-lo', () => {
    semearPerk({ expiraEm: NO_PASSADO });

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(
      within(vitrine()).getByRole('list', { name: 'Histórico' })
    ).toBeInTheDocument();
  });

  it('explica a vitrine vazia para quem ainda não foi premiado', () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(within(vitrine()).getByText(/ainda não recebeu/i)).toBeInTheDocument();
  });

  it('não mostra na vitrine o perk que é de outro aluno', () => {
    semearPerk({ alunoUid: 'uid-bruno', alunoNome: 'Bruno Alves' });

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(within(vitrine()).queryByText(/Resolvedor/)).toBeNull();
  });
});

describe('TelaAluno — a premiação em tela cheia (AC-PERK-04)', () => {
  it('dispara a premiação quando o aluno entra na sala com perk não visto', () => {
    semearPerk({ visualizadoEm: null });

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(screen.getByRole('dialog')).toHaveTextContent('Resolvedor');
  });

  it('não dispara nada quando o perk já foi visto', () => {
    semearPerk();

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('não dispara a premiação de outro aluno', () => {
    semearPerk({ alunoUid: 'uid-bruno', alunoNome: 'Bruno Alves', visualizadoEm: null });

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('o professor não recebe premiação em tela cheia', () => {
    semearPerk({ visualizadoEm: null });

    renderComProvedores(<TelaProfessor salaId={SALA} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TelaAluno — onde o aluno desliga a animação (AC-PERK-08)', () => {
  it('oferece as preferências de premiação na própria sala', () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(screen.getByRole('checkbox', { name: /animação/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /som/i })).toBeInTheDocument();
  });

  it('o som nasce desligado, e a animação ligada', () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(screen.getByRole('checkbox', { name: /som/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /animação/i })).toBeChecked();
  });
});

describe('TelaProfessor — a vitrine é do aluno, não dele', () => {
  it('não mostra "Minhas conquistas" na tela do professor', () => {
    semearPerk();

    renderComProvedores(<TelaProfessor salaId={SALA} />);

    expect(vitrine()).toBeNull();
  });
});
