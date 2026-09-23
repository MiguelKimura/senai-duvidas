// A insígnia do perk — AC-PERK-05.
//
// A premiação em tela cheia acontece uma vez e acaba. A insígnia é o que
// sobra: é ela que faz o reconhecimento ser público, que é exatamente o valor
// que o cliente descreveu ("funcionaria como uma premiação que o professor
// pode dar a um aluno"). Sem ela, quem não estava olhando a tela do premiado
// nunca fica sabendo.
//
// Componente sem banco e sem relógio: recebe o índice de perks já carregado
// pela sala e o instante do servidor. É o que permite usá-lo tanto no card do
// chamado quanto no balão do chat sem uma segunda consulta (AC-PERF-03).
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import InsigniasDoAluno from '../InsigniasDoAluno';
import { indexarPerksPorUid } from '../../../services/filaChamados';

const AGORA = new Date('2026-09-22T12:00:00.000Z');

const NO_FUTURO = Timestamp.fromDate(new Date('2026-10-22T12:00:00.000Z'));
const NO_PASSADO = Timestamp.fromDate(new Date('2026-09-01T12:00:00.000Z'));

function perk(sobrescritas = {}) {
  return {
    id: 'perk-1',
    alunoUid: 'uid-ana',
    alunoNome: 'Ana Souza',
    tipo: 'prioridade',
    nivel: 2,
    justificativa: 'Ajudou o colega.',
    concedidoPorNome: 'Carlos Lima',
    expiraEm: NO_FUTURO,
    revogadoEm: null,
    ...sobrescritas,
  };
}

function renderizar(perks, props = {}) {
  return render(
    <InsigniasDoAluno
      perks={indexarPerksPorUid(perks)}
      uid="uid-ana"
      agoraServidor={AGORA}
      {...props}
    />
  );
}

describe('InsigniasDoAluno — o reconhecimento que fica (AC-PERK-05)', () => {
  it('mostra a insígnia do perk ativo, com o nome do tipo', () => {
    renderizar([perk()]);

    expect(screen.getByText(/Prioridade no Atendimento/)).toBeInTheDocument();
  });

  it('anuncia o nível junto do tipo, para quem lê por leitor de tela', () => {
    renderizar([perk({ nivel: 3 })]);

    expect(
      screen.getByTitle('Prioridade no Atendimento — nível 3')
    ).toBeInTheDocument();
  });

  it('mostra uma insígnia por perk ativo do aluno', () => {
    renderizar([perk(), perk({ id: 'perk-2', tipo: 'colaborador', nivel: 1 })]);

    expect(document.querySelectorAll('.perk-insignia')).toHaveLength(2);
  });

  it('não mostra o perk vencido pelo horário do servidor (AC-PERK-03)', () => {
    renderizar([perk({ expiraEm: NO_PASSADO })]);

    expect(document.querySelector('.perk-insignia')).toBeNull();
  });

  it('não mostra o perk revogado (AC-PERK-07)', () => {
    renderizar([perk({ revogadoEm: Timestamp.fromDate(AGORA) })]);

    expect(document.querySelector('.perk-insignia')).toBeNull();
  });

  it('não mostra o perk de outro aluno', () => {
    renderizar([perk({ alunoUid: 'uid-bruno' })]);

    expect(document.querySelector('.perk-insignia')).toBeNull();
  });

  it('não desenha nada quando o aluno não tem perk — nem o invólucro vazio', () => {
    const { container } = renderizar([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('não desenha nada para um chamado da v0.1.0, que não tem autorUid', () => {
    const { container } = renderizar([perk()], { uid: undefined });

    expect(container).toBeEmptyDOMElement();
  });

  it('sem instante do servidor, não exibe perk com validade — na dúvida, não premia', () => {
    renderizar([perk()], { agoraServidor: null });

    expect(document.querySelector('.perk-insignia')).toBeNull();
  });

  it('o perk permanente aparece mesmo sem instante do servidor', () => {
    renderizar([perk({ expiraEm: null })], { agoraServidor: null });

    expect(screen.getByText(/Prioridade no Atendimento/)).toBeInTheDocument();
  });
});
