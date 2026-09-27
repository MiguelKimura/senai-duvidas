// O disparo da premiação — AC-PERK-04.
//
// `AnimacaoDePerk` já sabe aparecer, pular e sair. O que falta é quem decide
// **quando** ela aparece, e essa decisão tem uma exigência dura no meio:
// "a animação nunca repete".
//
// Não é preciosismo. O recibo é um campo no banco (`visualizadoEm`), e sem ele
// cada F5 do aluno reabriria a tela cheia — no meio de uma prova, na frente da
// turma, para sempre. O contrário também precisa valer: se a gravação do
// recibo falhar, o app não pode travar. O pior caso aceito é a premiação
// aparecer de novo no próximo carregamento.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __carimbosPendentes,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __documentosDe,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import PremiacaoDaSala, { premiacoesPendentes } from '../PremiacaoDaSala';
import { renderComProvedores } from '../../../test-utils';

const SALA = 'sala-a';
const PERKS_DA_SALA = `salas/${SALA}/perks`;

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

const NO_FUTURO = Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z'));
const AGORA_ISO = '2026-09-22T12:00:00.000Z';

function perk(sobrescritas = {}) {
  return {
    id: 'perk-1',
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
    visualizadoEm: null,
    ...sobrescritas,
  };
}

function renderizar(perks) {
  return renderComProvedores(<PremiacaoDaSala salaId={SALA} perks={perks} uid={ANA.uid} />);
}

/** A premiação em tela cheia, se ela estiver aberta. */
function premiacao() {
  return screen.queryByRole('dialog');
}

/** O recibo gravado no perk. */
function visualizadoEmDe(id) {
  return __documentosDe(PERKS_DA_SALA).find((documento) => documento.id === id).visualizadoEm;
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(AGORA_ISO);
  __definirUsuarioAtual(ANA);

  // O jsdom não traz `matchMedia`, e o hook de movimento reduzido o consulta.
  window.matchMedia = jest.fn().mockImplementation((consulta) => ({
    matches: false,
    media: consulta,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});

describe('PremiacaoDaSala — quando a premiação aparece (AC-PERK-04)', () => {
  it('abre a tela cheia para o perk que o aluno ainda não viu', () => {
    const perks = [perk()];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    expect(premiacao()).toBeInTheDocument();
    expect(screen.getByText('Resolvedor')).toBeInTheDocument();
  });

  it('mostra a justificativa e quem concedeu, que é o conteúdo do prêmio', () => {
    const perks = [perk()];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    expect(screen.getByText('Resolveu sozinha o erro de driver.')).toBeInTheDocument();
    expect(screen.getByText(/Carlos Lima/)).toBeInTheDocument();
  });

  it('não abre nada para o perk que o aluno já viu', () => {
    const perks = [
      perk({ visualizadoEm: Timestamp.fromDate(new Date('2026-09-20T13:05:00Z')) }),
    ];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    expect(premiacao()).toBeNull();
  });

  it('não abre a premiação de outro aluno', () => {
    const perks = [perk({ alunoUid: 'uid-bruno', alunoNome: 'Bruno Alves' })];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    expect(premiacao()).toBeNull();
  });

  it('não comemora um perk que o professor já revogou', () => {
    const perks = [perk({ revogadoEm: Timestamp.fromDate(new Date('2026-09-20T14:00:00Z')) })];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    expect(premiacao()).toBeNull();
  });

  it('não abre nada numa sala sem perk nenhum — a sala da v0.8.0', () => {
    renderizar([]);

    expect(premiacao()).toBeNull();
  });

  it('mostra uma premiação por vez, começando pela mais antiga', () => {
    const perks = [
      perk({
        id: 'novo',
        tipo: 'destaque',
        concedidoEm: Timestamp.fromDate(new Date('2026-09-21T13:00:00Z')),
      }),
      perk({ id: 'antigo', tipo: 'colaborador' }),
    ];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Colaborador')).toBeInTheDocument();
  });
});

describe('PremiacaoDaSala — o recibo que impede a repetição (AC-PERK-04)', () => {
  it('grava visualizadoEm ao pular a premiação', async () => {
    const perks = [perk()];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    await userEvent.click(screen.getByRole('button', { name: 'Pular' }));

    // O recibo sai como `serverTimestamp()`: o campo chega vazio e o carimbo
    // vem na resposta do servidor, como todo horário deste app (AC-TEMPO-01).
    await waitFor(() => expect(__carimbosPendentes()).toBeGreaterThan(0));
    __confirmarCarimbos();

    expect(visualizadoEmDe('perk-1').toDate().toISOString()).toBe('2026-09-22T12:00:00.000Z');
  });

  it('não reabre a premiação depois de fechada, mesmo com o perk ainda sem recibo', async () => {
    const perks = [perk()];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    await userEvent.click(screen.getByRole('button', { name: 'Pular' }));

    // O snapshot da sala ainda traz `visualizadoEm: null` — o servidor não
    // respondeu. Reabrir aqui é exatamente o defeito que o AC proíbe.
    await waitFor(() => expect(premiacao()).toBeNull());
  });

  it('a recusa do recibo não trava o app: a premiação fecha do mesmo jeito', async () => {
    const perks = [perk()];
    __semearColecao(PERKS_DA_SALA, perks);
    __recusarEscritaEm(`${PERKS_DA_SALA}/perk-1`);

    renderizar(perks);

    await userEvent.click(screen.getByRole('button', { name: 'Pular' }));

    await waitFor(() => expect(premiacao()).toBeNull());
  });

  it('passa para a premiação seguinte depois de fechar a primeira', async () => {
    const perks = [
      perk({ id: 'antigo', tipo: 'colaborador' }),
      perk({
        id: 'novo',
        tipo: 'destaque',
        concedidoEm: Timestamp.fromDate(new Date('2026-09-21T13:00:00Z')),
      }),
    ];
    __semearColecao(PERKS_DA_SALA, perks);

    renderizar(perks);

    await userEvent.click(screen.getByRole('button', { name: 'Pular' }));

    expect(await screen.findByText('Destaque da Aula')).toBeInTheDocument();
  });
});

// A ordem em que as premiações entram na fila — AC-PERK-09.
//
// Duas premiações concedidas no mesmo lote saem do servidor com o MESMO
// carimbo, e as duas chegam sem carimbo nenhum enquanto a escrita está em voo.
// Sem um desempate estável, a ordem em que o aluno as vê dependeria da ordem
// em que o snapshot as entregou — que não é garantida e muda entre
// dispositivos. É a mesma regra da fila de chamados, pelo mesmo motivo.
describe('premiacoesPendentes — a ordem é sempre a mesma (AC-PERK-09)', () => {
  it('põe a mais antiga primeiro', () => {
    const antiga = perk({
      id: 'a',
      concedidoEm: Timestamp.fromDate(new Date('2026-09-20T13:00:00Z')),
    });
    const nova = perk({
      id: 'b',
      concedidoEm: Timestamp.fromDate(new Date('2026-09-21T13:00:00Z')),
    });

    expect(premiacoesPendentes([nova, antiga], ANA.uid).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('manda para o fim quem ainda não tem carimbo do servidor', () => {
    const carimbada = perk({ id: 'carimbada' });
    const emVoo = perk({ id: 'emVoo', concedidoEm: null });

    expect(premiacoesPendentes([emVoo, carimbada], ANA.uid).map((p) => p.id)).toEqual([
      'carimbada',
      'emVoo',
    ]);
  });

  it('desempata duas premiações sem carimbo pelo id, em qualquer ordem de entrada', () => {
    const primeira = perk({ id: 'aaa', concedidoEm: null });
    const segunda = perk({ id: 'bbb', concedidoEm: null });

    expect(premiacoesPendentes([segunda, primeira], ANA.uid).map((p) => p.id)).toEqual([
      'aaa',
      'bbb',
    ]);
    expect(premiacoesPendentes([primeira, segunda], ANA.uid).map((p) => p.id)).toEqual([
      'aaa',
      'bbb',
    ]);
  });

  it('não devolve premiação de outro aluno nem já vista', () => {
    const deOutro = perk({ id: 'outro', alunoUid: 'uid-bruno' });
    const vista = perk({ id: 'vista', visualizadoEm: Timestamp.fromDate(new Date(AGORA_ISO)) });

    expect(premiacoesPendentes([deOutro, vista], ANA.uid)).toEqual([]);
  });
});
