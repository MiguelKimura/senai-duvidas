// A insígnia onde ela precisa aparecer — AC-PERK-05.
//
// O critério nomeia dois lugares, e os dois importam por motivos diferentes:
//
//   * **no card do chamado**, porque é ali que o professor olha para decidir
//     quem atender, e é ali que a prioridade precisa ter uma explicação
//     visível — um chamado que furou a fila sem dizer por quê gera briga;
//   * **no chat**, porque é onde a turma conversa, e é onde o reconhecimento
//     público do cliente ("uma premiação que o professor pode dar a um aluno")
//     de fato acontece.
//
// O ponto de extensão do chat já existia desde a task 06 (`insignias` em
// `Mensagem.jsx`, `insigniasDe` em `ListaMensagens`). O que este arquivo
// cobra é que alguém finalmente o preencha, e sem abrir uma segunda consulta
// de perks para isso (AC-PERF-03).
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __consultasAtivas,
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
const CHAT_DA_SALA = `salas/${SALA}/chat`;
const PERKS_DA_SALA = `salas/${SALA}/perks`;

const HORARIO_DO_SERVIDOR = '2026-09-22T12:00:00.000Z';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

const NO_FUTURO = Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z'));
const NO_PASSADO = Timestamp.fromDate(new Date('2020-01-01T00:00:00.000Z'));

/** Um chamado de cada autor: a premiada e alguém sem perk. */
function semearChamados() {
  __semearColecao(CHAMADOS_DA_SALA, [
    {
      id: 'c1',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      email: ANA.email,
      descricao: 'chamado da Ana',
      horario: Timestamp.fromDate(new Date('2026-09-22T10:00:00.000Z')),
      atendido: false,
    },
    {
      id: 'c2',
      autorUid: 'uid-bruno',
      autorNome: 'Bruno Alves',
      email: 'bruno@senai.br',
      descricao: 'chamado do Bruno',
      horario: Timestamp.fromDate(new Date('2026-09-22T10:05:00.000Z')),
      atendido: false,
    },
  ]);
}

function semearPerkDaAna(sobrescritas = {}) {
  __semearColecao(PERKS_DA_SALA, [
    {
      id: 'perk-ana',
      alunoUid: ANA.uid,
      alunoNome: 'Ana Souza',
      tipo: 'colaborador',
      nivel: 1,
      justificativa: null,
      anunciarParaSala: false,
      concedidoPor: 'uid-carlos',
      concedidoPorNome: 'Carlos Lima',
      concedidoEm: Timestamp.fromDate(new Date('2026-09-22T09:00:00.000Z')),
      expiraEm: NO_FUTURO,
      revogadoEm: null,
      // Já visto: a premiação em tela cheia cobriria o que este teste lê.
      visualizadoEm: Timestamp.fromDate(new Date('2026-09-22T09:01:00.000Z')),
      ...sobrescritas,
    },
  ]);
}

/** O card de um chamado, achado pela descrição. */
function cartaoDe(descricao) {
  return screen.getByText(descricao).closest('.problema-card');
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
  semearChamados();
});

describe.each([
  ['TelaAluno', TelaAluno],
  ['TelaProfessor', TelaProfessor],
])('%s — a insígnia no card do chamado (AC-PERK-05)', (_nome, Tela) => {
  it('mostra a insígnia no card de quem tem perk ativo', () => {
    semearPerkDaAna();

    renderComProvedores(<Tela salaId={SALA} />);

    expect(within(cartaoDe('chamado da Ana')).getByText(/Colaborador/)).toBeInTheDocument();
  });

  it('não mostra insígnia no card de quem não tem perk', () => {
    semearPerkDaAna();

    renderComProvedores(<Tela salaId={SALA} />);

    expect(cartaoDe('chamado do Bruno').querySelector('.perk-insignia')).toBeNull();
  });

  it('o perk vencido não deixa insígnia no card (AC-PERK-03)', () => {
    semearPerkDaAna({ expiraEm: NO_PASSADO });

    renderComProvedores(<Tela salaId={SALA} />);

    expect(document.querySelector('.perk-insignia')).toBeNull();
  });

  it('sala sem perk nenhum não desenha insígnia alguma — a tela da v0.8.0', () => {
    renderComProvedores(<Tela salaId={SALA} />);

    expect(document.querySelector('.perk-insignias')).toBeNull();
  });
});

describe('a insígnia ao lado do nome no chat (AC-PERK-05)', () => {
  beforeEach(() => {
    semearPerkDaAna();

    __semearColecao(CHAT_DA_SALA, [
      {
        id: 'm1',
        texto: 'alguém conseguiu rodar?',
        autorUid: ANA.uid,
        autorNome: 'Ana Souza',
        autorPapel: 'aluno',
        horario: Timestamp.fromDate(new Date('2026-09-22T11:00:00.000Z')),
      },
      {
        id: 'm2',
        texto: 'ainda não',
        autorUid: 'uid-bruno',
        autorNome: 'Bruno Alves',
        autorPapel: 'aluno',
        horario: Timestamp.fromDate(new Date('2026-09-22T11:01:00.000Z')),
      },
    ]);
  });

  /**
   * Abre o painel do chat e espera a conversa chegar.
   *
   * O painel fechado não escuta nada (task 06): o listener só nasce no clique,
   * e a primeira página chega depois dele.
   */
  async function abrirOChat() {
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o chat' }));
    await waitFor(() => expect(screen.getByText('alguém conseguiu rodar?')).toBeVisible());
  }

  it('põe a insígnia no cabeçalho da mensagem de quem tem perk', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);
    await abrirOChat();

    const balao = screen.getByText('alguém conseguiu rodar?').closest('.mensagem');

    expect(within(balao).getByText(/Colaborador/)).toBeInTheDocument();
  });

  it('não põe insígnia na mensagem de quem não tem perk', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);
    await abrirOChat();

    const balao = screen.getByText('ainda não').closest('.mensagem');

    expect(balao.querySelector('.perk-insignia')).toBeNull();
  });

  it('não abre uma segunda consulta de perks para o chat (AC-PERF-03)', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);
    await abrirOChat();

    const dePerks = __consultasAtivas().filter(
      (consulta) => consulta.caminho === PERKS_DA_SALA
    );

    expect(dePerks).toHaveLength(1);
  });
});
