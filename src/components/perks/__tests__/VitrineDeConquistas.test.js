// A vitrine "Minhas conquistas" — AC-PERK-06.
//
// O perk vencido **não some**: a premiação de março continua tendo acontecido
// em novembro. O que muda é a coluna. Apagar o histórico transformaria o
// reconhecimento num aluguel de trinta dias, que é o oposto do que o cliente
// descreveu — e é por isso que revogar é um campo, e nunca um `delete`.
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import VitrineDeConquistas from '../VitrineDeConquistas';

const AGORA = new Date('2026-09-22T12:00:00.000Z');

const NO_FUTURO = Timestamp.fromDate(new Date('2026-10-22T12:00:00.000Z'));
const NO_PASSADO = Timestamp.fromDate(new Date('2026-09-01T12:00:00.000Z'));

function perk(sobrescritas = {}) {
  return {
    id: 'perk-1',
    alunoUid: 'uid-ana',
    alunoNome: 'Ana Souza',
    tipo: 'colaborador',
    nivel: 1,
    justificativa: 'Ajudou o colega a achar o erro de compilação.',
    concedidoPor: 'uid-carlos',
    concedidoPorNome: 'Carlos Lima',
    concedidoEm: Timestamp.fromDate(new Date('2026-09-20T13:00:00.000Z')),
    expiraEm: NO_FUTURO,
    revogadoEm: null,
    ...sobrescritas,
  };
}

function renderizar(perks, props = {}) {
  return render(
    <VitrineDeConquistas perks={perks} uid="uid-ana" agoraServidor={AGORA} {...props} />
  );
}

/** A lista de uma das colunas, pelo nome acessível dela. */
function coluna(nome) {
  return screen.getByRole('list', { name: nome });
}

describe('VitrineDeConquistas — ativos e histórico (AC-PERK-06)', () => {
  it('anuncia a vitrine como "Minhas conquistas"', () => {
    renderizar([perk()]);

    expect(screen.getByRole('heading', { name: 'Minhas conquistas' })).toBeInTheDocument();
  });

  it('põe o perk que vale agora na coluna dos ativos', () => {
    renderizar([perk()]);

    expect(within(coluna('Premiações ativas')).getByText(/Colaborador/)).toBeInTheDocument();
  });

  it('põe o perk vencido no histórico, sem apagá-lo', () => {
    renderizar([perk({ expiraEm: NO_PASSADO })]);

    expect(within(coluna('Histórico')).getByText(/Colaborador/)).toBeInTheDocument();
  });

  it('o perk revogado vai para o histórico, e não some da vitrine', () => {
    renderizar([perk({ revogadoEm: Timestamp.fromDate(new Date('2026-09-21T10:00:00.000Z')) })]);

    expect(within(coluna('Histórico')).getByText(/Colaborador/)).toBeInTheDocument();
  });

  it('separa as duas colunas quando o aluno tem perk em cada estado', () => {
    renderizar([
      perk({ id: 'ativo', tipo: 'prioridade' }),
      perk({ id: 'vencido', tipo: 'resolvedor', expiraEm: NO_PASSADO }),
    ]);

    expect(within(coluna('Premiações ativas')).getAllByRole('listitem')).toHaveLength(1);
    expect(within(coluna('Histórico')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('mostra a justificativa e quem concedeu, que é o que dá sentido ao prêmio', () => {
    renderizar([perk()]);

    expect(
      screen.getByText(/Ajudou o colega a achar o erro de compilação\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/Carlos Lima/)).toBeInTheDocument();
  });

  it('mostra a data da concessão no fuso de Brasília (AC-TEMPO-03)', () => {
    renderizar([perk()]);

    expect(screen.getByText(/20\/09\/2026 10:00/)).toBeInTheDocument();
  });

  it('diz que o perk é permanente quando ele não tem validade', () => {
    renderizar([perk({ expiraEm: null })]);

    expect(screen.getByText(/[Pp]ermanente/)).toBeInTheDocument();
  });

  it('não mostra o perk de outro aluno', () => {
    renderizar([perk({ alunoUid: 'uid-bruno' })]);

    expect(screen.queryByText(/Colaborador/)).toBeNull();
  });

  it('explica a vitrine vazia em vez de mostrar duas listas sem nada', () => {
    renderizar([]);

    expect(screen.getByText(/ainda não recebeu/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('omite a coluna de histórico quando não há nenhum perk vencido', () => {
    renderizar([perk()]);

    expect(screen.queryByRole('list', { name: 'Histórico' })).toBeNull();
  });
});
