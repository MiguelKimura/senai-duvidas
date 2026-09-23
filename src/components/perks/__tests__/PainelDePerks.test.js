// O painel de concessão do professor — AC-PERK-01, AC-PERK-07, AC-PERK-10.
//
// A autorização que vale é a da rule, e ela já está escrita e testada em
// `tests/rules/perks.rules.test.js`. O que este painel faz é outra coisa: dar
// ao professor um lugar onde conceder seja um gesto de dez segundos, no meio
// da aula, sem sair da fila que ele está olhando.
//
// Duas decisões aparecem aqui e não são de interface:
//
//   * **o professor não se premia.** Ele não está na lista de alunos. A rule
//     também recusaria — `ehMembro(alunoUid)` passa, mas premiar a si mesmo
//     não faz sentido pedagógico nenhum e o painel não oferece;
//   * **"anunciar para a sala" é uma escolha explícita.** A justificativa é o
//     que dá sentido ao prêmio, mas expor "porque ajudou o colega" para toda
//     a turma também expõe, por omissão, quem não foi premiado.
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __documentosDe,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import PainelDePerks from '../PainelDePerks';
import { renderComProvedores } from '../../../test-utils';

const SALA = 'sala-a';
const MEMBROS_DA_SALA = `salas/${SALA}/membros`;
const PERKS_DA_SALA = `salas/${SALA}/perks`;
const AUDITORIA_DA_SALA = `salas/${SALA}/auditoriaPerks`;

const AGORA = '2026-09-22T12:00:00.000Z';

const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };

function semearTurma() {
  __semearColecao(MEMBROS_DA_SALA, [
    { id: CARLOS.uid, nome: 'Carlos Lima', email: CARLOS.email, papel: 'professor' },
    { id: 'uid-ana', nome: 'Ana Souza', email: 'ana@senai.br', papel: 'aluno' },
    { id: 'uid-bruno', nome: 'Bruno Alves', email: 'bruno@senai.br', papel: 'aluno' },
  ]);
}

function renderizar(props = {}) {
  return renderComProvedores(
    <PainelDePerks salaId={SALA} perks={[]} agoraServidor={new Date(AGORA)} {...props} />
  );
}

/** Espera a turma chegar: `listarMembros` é uma ida ao Firestore. */
async function aTurmaCarregada() {
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: /aluno/i })).toHaveTextContent('Ana Souza')
  );
}

async function conceder({ aluno = 'uid-ana', tipo, nivel, justificativa, validade } = {}) {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /aluno/i }), aluno);

  if (tipo) {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /tipo/i }), tipo);
  }
  if (nivel) {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /nível/i }), nivel);
  }
  if (validade) {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /validade/i }), validade);
  }
  if (justificativa) {
    await userEvent.type(screen.getByRole('textbox', { name: /justificativa/i }), justificativa);
  }

  await userEvent.click(screen.getByRole('button', { name: /conceder/i }));
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(AGORA);
  __definirUsuarioAtual(CARLOS);
  semearTurma();
});

describe('PainelDePerks — quem pode ser premiado (AC-PERK-01)', () => {
  it('oferece os alunos da sala na lista', async () => {
    renderizar();
    await aTurmaCarregada();

    const lista = screen.getByRole('combobox', { name: /aluno/i });

    expect(within(lista).getByRole('option', { name: 'Ana Souza' })).toBeInTheDocument();
    expect(within(lista).getByRole('option', { name: 'Bruno Alves' })).toBeInTheDocument();
  });

  it('não oferece o próprio professor: ele concede, não recebe', async () => {
    renderizar();
    await aTurmaCarregada();

    const lista = screen.getByRole('combobox', { name: /aluno/i });

    expect(within(lista).queryByRole('option', { name: 'Carlos Lima' })).toBeNull();
  });

  it('oferece os quatro tipos de premiação', async () => {
    renderizar();
    await aTurmaCarregada();

    const tipos = screen.getByRole('combobox', { name: /tipo/i });

    expect(within(tipos).getByRole('option', { name: /Prioridade no Atendimento/ })).toBeInTheDocument();
    expect(within(tipos).getByRole('option', { name: /Destaque da Aula/ })).toBeInTheDocument();
    expect(within(tipos).getByRole('option', { name: /Colaborador/ })).toBeInTheDocument();
    expect(within(tipos).getByRole('option', { name: /Resolvedor/ })).toBeInTheDocument();
  });
});

describe('PainelDePerks — a concessão (AC-PERK-01, AC-PERK-03, AC-PERK-10)', () => {
  it('grava o perk com o aluno, o tipo, o nível e quem concedeu', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'colaborador', nivel: '2', justificativa: 'Ajudou o colega.' });

    await waitFor(() => expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(1));
    __confirmarCarimbos();

    expect(__documentosDe(PERKS_DA_SALA)[0]).toMatchObject({
      alunoUid: 'uid-ana',
      alunoNome: 'Ana Souza',
      tipo: 'colaborador',
      nivel: 2,
      justificativa: 'Ajudou o colega.',
      concedidoPor: CARLOS.uid,
      concedidoPorNome: 'Carlos Lima',
      revogadoEm: null,
      visualizadoEm: null,
    });
  });

  it('grava o evento de auditoria junto com a premiação (AC-PERK-10)', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'resolvedor' });

    await waitFor(() => expect(__documentosDe(AUDITORIA_DA_SALA)).toHaveLength(1));

    expect(__documentosDe(AUDITORIA_DA_SALA)[0]).toMatchObject({
      acao: 'conceder',
      alunoUid: 'uid-ana',
      atorUid: CARLOS.uid,
    });
  });

  it('calcula a validade a partir do instante do servidor (AC-PERK-03)', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'prioridade', validade: '7' });

    await waitFor(() => expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(1));

    expect(__documentosDe(PERKS_DA_SALA)[0].expiraEm.toDate().toISOString()).toBe(
      '2026-09-29T12:00:00.000Z'
    );
  });

  it('grava perk permanente quando o professor escolhe "sem validade"', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'destaque', validade: '' });

    await waitFor(() => expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(1));

    expect(__documentosDe(PERKS_DA_SALA)[0].expiraEm).toBeNull();
  });

  it('não anuncia para a sala sem o professor marcar a caixa', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'colaborador' });

    await waitFor(() => expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(1));

    expect(__documentosDe(PERKS_DA_SALA)[0].anunciarParaSala).toBe(false);
  });

  it('confirma a concessão na tela, para o professor saber que foi', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'colaborador' });

    expect(await screen.findByRole('status')).toHaveTextContent(/Ana Souza/);
  });

  it('recusa a justificativa longa demais, em português, sem tocar no banco', async () => {
    renderizar();
    await aTurmaCarregada();

    await conceder({ tipo: 'colaborador', justificativa: 'x'.repeat(281) });

    expect(await screen.findByRole('alert')).toHaveTextContent(/280 caracteres/);
    expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(0);
  });
});

describe('PainelDePerks — a revogação (AC-PERK-07, AC-PERK-10)', () => {
  const PERK_ATIVO = {
    id: 'perk-1',
    alunoUid: 'uid-ana',
    alunoNome: 'Ana Souza',
    tipo: 'prioridade',
    nivel: 2,
    justificativa: null,
    anunciarParaSala: false,
    concedidoPor: CARLOS.uid,
    concedidoPorNome: 'Carlos Lima',
    concedidoEm: Timestamp.fromDate(new Date('2026-09-21T12:00:00.000Z')),
    expiraEm: Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z')),
    revogadoEm: null,
    visualizadoEm: null,
  };

  it('lista as premiações ativas da sala com o nome de quem as recebeu', () => {
    renderizar({ perks: [PERK_ATIVO] });

    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
  });

  it('revoga o perk e registra o evento, em vez de apagar a linha', async () => {
    __semearColecao(PERKS_DA_SALA, [PERK_ATIVO]);

    renderizar({ perks: [PERK_ATIVO] });

    await userEvent.click(screen.getByRole('button', { name: /revogar/i }));

    await waitFor(() => expect(__documentosDe(AUDITORIA_DA_SALA)).toHaveLength(1));
    __confirmarCarimbos();

    expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(1);
    expect(__documentosDe(PERKS_DA_SALA)[0].revogadoEm).not.toBeNull();
    expect(__documentosDe(AUDITORIA_DA_SALA)[0]).toMatchObject({
      acao: 'revogar',
      perkId: 'perk-1',
      alunoUid: 'uid-ana',
      atorUid: CARLOS.uid,
    });
  });

  it('não oferece revogar o perk que já foi revogado', () => {
    renderizar({
      perks: [{ ...PERK_ATIVO, revogadoEm: Timestamp.fromDate(new Date(AGORA)) }],
    });

    expect(screen.queryByRole('button', { name: /revogar/i })).toBeNull();
  });
});

describe('PainelDePerks — a sala arquivada (AC-SALA-10)', () => {
  it('não oferece conceder numa sala somente leitura', async () => {
    renderizar({ somenteLeitura: true });

    expect(screen.queryByRole('button', { name: /conceder/i })).toBeNull();
  });
});
