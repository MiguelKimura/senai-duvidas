// A lista de salas de cada pessoa — AC-SALA-05, AC-SALA-06, AC-SALA-08,
// AC-SALA-09, AC-SALA-10, AC-PERF-03, AC-PERF-04.
//
// É a tela que prova o AC-SALA-06 na prática: quem já entrou uma vez chega
// aqui e clica no nome da sala. O PIN é digitado uma vez em fevereiro e nunca
// mais — a sala vale o ano letivo inteiro.
//
// Para o professor dono, é também o painel da turma: quantos entraram, quantos
// chamados estão abertos, o botão de gerar um PIN novo e o de arquivar a sala
// em dezembro.
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __documentosDe,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import MinhasSalas from '../MinhasSalas';
import { LIMITE_DE_SALAS } from '../../services/salas';
import { renderComProvedores } from '../../test-utils';

const navegacoes = [];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => (destino, opcoes) => navegacoes.push([destino, opcoes]),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };
const HORARIO_DO_SERVIDOR = '2026-02-10T13:45:00.000Z';

function semearProfessorNoAuth() {
  __semearColecao('usuarios', [
    {
      id: CARLOS.uid,
      uid: CARLOS.uid,
      nome: 'Carlos Lima',
      email: CARLOS.email,
      tipo: 'professor',
    },
  ]);
  __semearColecao('autorizados', [{ id: CARLOS.email, Tipo: 'professor' }]);
}

/** A sala de mecânica, com dois membros e dois chamados (um já atendido). */
function semearSalaDeMecanica({ ativa = true } = {}) {
  __semearColecao('salas', [
    {
      id: 'sala-mecanica',
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      professorNome: 'Carlos Lima',
      ativa,
      arquivadaEm: null,
    },
  ]);
  __semearColecao('salas/sala-mecanica/membros', [
    { id: CARLOS.uid, nome: 'Carlos Lima', papel: 'professor' },
    { id: ANA.uid, nome: 'Ana Souza', papel: 'aluno' },
  ]);
  __semearColecao('salas/sala-mecanica/chamados', [
    { id: 'c1', autorNome: 'Ana Souza', descricao: 'O torno travou.', atendido: false },
    { id: 'c2', autorNome: 'Ana Souza', descricao: 'Resolvido.', atendido: true },
  ]);
}

/** O espelho que diz de quais salas a pessoa é membro. */
function semearEspelho(uid, entradas) {
  __semearColecao(
    `usuarios/${uid}/salas`,
    entradas.map(({ salaId, papel }) => ({ id: salaId, salaId, papel }))
  );
}

async function montar() {
  const view = renderComProvedores(<MinhasSalas />, { rota: '/salas' });
  await screen.findByRole('heading', { name: /minhas salas/i });
  return view;
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  navegacoes.length = 0;
});

describe('MinhasSalas — o aluno (AC-SALA-06)', () => {
  beforeEach(() => {
    semearSalaDeMecanica();
    semearEspelho(ANA.uid, [{ salaId: 'sala-mecanica', papel: 'aluno' }]);
    __definirUsuarioAtual(ANA);
  });

  it('lista a sala em que o aluno já entrou, com curso e ano letivo', async () => {
    await montar();

    const cartao = await screen.findByRole('listitem');
    expect(
      within(cartao).getByRole('heading', { name: 'Mecânica 2º ano' })
    ).toBeInTheDocument();
    expect(within(cartao).getByText(/Mecânica — Turma B/)).toBeInTheDocument();
    expect(within(cartao).getByText(/2026/)).toBeInTheDocument();
  });

  it('abre a sala sem pedir o PIN de novo — o vínculo já está gravado', async () => {
    await montar();
    const cartao = await screen.findByRole('listitem');

    await userEvent.click(within(cartao).getByRole('button', { name: /abrir sala/i }));

    expect(navegacoes).toContainEqual(['/sala/sala-mecanica', undefined]);
  });

  it('não mostra ao aluno a contagem de membros nem o PIN da sala', async () => {
    await montar();
    await screen.findByRole('listitem');

    expect(screen.queryByText(/membros/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gerar novo pin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arquivar/i })).not.toBeInTheDocument();
  });

  it('oferece entrar em outra sala por PIN', async () => {
    await montar();

    await userEvent.click(await screen.findByRole('button', { name: /entrar com pin/i }));

    expect(navegacoes).toContainEqual(['/salas/entrar', undefined]);
  });

  it('sem sala nenhuma, explica o que fazer em vez de mostrar uma lista vazia', async () => {
    __resetarFirestore();
    __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
    await montar();

    expect(await screen.findByText(/ainda não está em nenhuma sala/i)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});

describe('MinhasSalas — o professor dono (AC-SALA-08)', () => {
  beforeEach(() => {
    semearProfessorNoAuth();
    semearSalaDeMecanica();
    semearEspelho(CARLOS.uid, [{ salaId: 'sala-mecanica', papel: 'professor' }]);
    __definirUsuarioAtual(CARLOS);
  });

  it('mostra a contagem de membros e a de chamados abertos', async () => {
    await montar();

    const cartao = await screen.findByRole('listitem');
    expect(await within(cartao).findByText(/2 membros/i)).toBeInTheDocument();
    // Dois chamados no banco, um deles já atendido.
    expect(within(cartao).getByText(/1 chamado aberto/i)).toBeInTheDocument();
  });

  it('oferece criar uma sala nova', async () => {
    await montar();

    await userEvent.click(await screen.findByRole('button', { name: /criar sala/i }));

    expect(navegacoes).toContainEqual(['/salas/nova', undefined]);
  });

  it('gera um PIN novo e o mostra em destaque (AC-SALA-09)', async () => {
    await montar();
    const cartao = await screen.findByRole('listitem');

    await userEvent.click(within(cartao).getByRole('button', { name: /gerar novo pin/i }));
    __confirmarCarimbos();

    const destaque = await screen.findByTestId('pin-em-destaque');
    expect(destaque).toHaveTextContent(/^\d{6}$/);
    // O número novo não fica em claro no banco, como o da criação.
    const [sala] = __documentosDe('salas');
    expect(JSON.stringify(sala)).not.toContain(destaque.textContent);
  });

  it('arquiva a sala e ela passa a aparecer como arquivada (AC-SALA-10)', async () => {
    await montar();
    const cartao = await screen.findByRole('listitem');

    await userEvent.click(within(cartao).getByRole('button', { name: /arquivar/i }));
    __confirmarCarimbos();

    expect(await screen.findByText(/arquivada/i)).toBeInTheDocument();
    expect(__documentosDe('salas')[0].ativa).toBe(false);
  });

  it('sala arquivada não oferece gerar PIN novo: ninguém mais entra nela', async () => {
    __resetarFirestore();
    __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
    semearProfessorNoAuth();
    semearSalaDeMecanica({ ativa: false });
    semearEspelho(CARLOS.uid, [{ salaId: 'sala-mecanica', papel: 'professor' }]);

    await montar();
    const cartao = await screen.findByRole('listitem');

    expect(
      within(cartao).queryByRole('button', { name: /gerar novo pin/i })
    ).not.toBeInTheDocument();
    expect(within(cartao).queryByRole('button', { name: /arquivar/i })).not.toBeInTheDocument();
  });
});

describe('MinhasSalas — custo e vazamento (AC-PERF-03, AC-PERF-04)', () => {
  beforeEach(() => {
    __definirUsuarioAtual(ANA);
  });

  it('nunca escuta mais do que o teto de salas, mesmo com o espelho inchado', async () => {
    const excedente = LIMITE_DE_SALAS + 3;
    __semearColecao(
      'salas',
      Array.from({ length: excedente }, (_, indice) => ({
        id: `sala-${indice}`,
        nome: `Sala ${indice}`,
        curso: 'Curso',
        anoLetivo: 2026,
        professorUid: CARLOS.uid,
        ativa: true,
      }))
    );
    semearEspelho(
      ANA.uid,
      Array.from({ length: excedente }, (_, indice) => ({
        salaId: `sala-${indice}`,
        papel: 'aluno',
      }))
    );

    await montar();

    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(LIMITE_DE_SALAS);
  });

  it('cancela o listener do espelho ao desmontar', async () => {
    semearSalaDeMecanica();
    semearEspelho(ANA.uid, [{ salaId: 'sala-mecanica', papel: 'aluno' }]);
    const { unmount } = await montar();
    await screen.findByRole('listitem');

    unmount();

    await waitFor(() => expect(__ouvintesAtivos()).toBe(0));
  });
});
