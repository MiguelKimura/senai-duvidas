// A tela em que o aluno entra na sala digitando o PIN — AC-SALA-04, AC-SALA-12.
//
// O que esta tela precisa acertar é o que ela **não** conta. PIN inexistente,
// PIN de sala arquivada e PIN de sala que não aceita mais ninguém têm de
// produzir exatamente a mesma frase: qualquer diferença transforma a tela num
// oráculo que responde "este PIN existe em algum lugar?", e com seis dígitos
// isso é um milhão de perguntas — respondíveis num fim de semana.
//
// A contagem de tentativas (AC-SALA-12) é do servidor; aqui se prova que a
// tela obedece à recusa e explica o bloqueio sem culpar o aluno.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __documentosDe,
  __ouvintesAtivos,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import EntrarComPin from '../EntrarComPin';
import { ERRO_DE_LIMITE, ERRO_DE_PIN } from '../../services/pin';
import { renderComProvedores } from '../../test-utils';

const navegacoes = [];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => (destino, opcoes) => navegacoes.push([destino, opcoes]),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const HORARIO_DO_SERVIDOR = '2026-02-10T13:45:00.000Z';
const PIN_DA_TURMA = '481502';

/** A sala do Carlos, já criada, com o PIN dela no índice. */
function semearSalaDoCarlos({ ativa = true } = {}) {
  __semearColecao('salas', [
    {
      id: 'sala-mecanica',
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: 'uid-carlos',
      professorNome: 'Carlos Lima',
      ativa,
      arquivadaEm: null,
    },
  ]);
  __semearColecao('indicePins', [{ id: PIN_DA_TURMA, salaId: 'sala-mecanica', ativo: ativa }]);
}

async function montar() {
  const view = renderComProvedores(<EntrarComPin />, { rota: '/salas/entrar' });
  await screen.findByRole('heading', { name: /entrar (na|em uma) sala/i });
  return view;
}

/** Digita o PIN e envia. */
async function digitarPin(pin) {
  const campo = screen.getByLabelText(/pin/i);
  await userEvent.clear(campo);
  if (pin) await userEvent.type(campo, pin);
  await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
  __confirmarCarimbos();
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
  navegacoes.length = 0;
});

describe('EntrarComPin — entrada válida (AC-SALA-04, AC-SALA-06)', () => {
  it('com o PIN certo, grava o vínculo em salas/{salaId}/membros/{uid}', async () => {
    semearSalaDoCarlos();
    await montar();

    await digitarPin(PIN_DA_TURMA);

    await waitFor(() =>
      expect(__documentosDe('salas/sala-mecanica/membros')).toEqual([
        expect.objectContaining({ id: ANA.uid, papel: 'aluno', nome: 'Ana Souza' }),
      ])
    );
  });

  it('leva o aluno direto para a sala', async () => {
    semearSalaDoCarlos();
    await montar();

    await digitarPin(PIN_DA_TURMA);

    await waitFor(() =>
      expect(navegacoes).toContainEqual(['/sala/sala-mecanica', { replace: true }])
    );
  });

  it('aceita o PIN com espaços, que é como ele chega colado do WhatsApp', async () => {
    semearSalaDoCarlos();
    await montar();

    await digitarPin(' 481 502 ');

    await waitFor(() =>
      expect(navegacoes).toContainEqual(['/sala/sala-mecanica', { replace: true }])
    );
  });

  it('quem já é membro entra de novo sem reiniciar a data de entrada (AC-SALA-06)', async () => {
    semearSalaDoCarlos();
    __semearColecao('salas/sala-mecanica/membros', [
      {
        id: ANA.uid,
        nome: 'Ana Souza',
        email: ANA.email,
        papel: 'aluno',
        entrouEm: 'fevereiro',
      },
    ]);
    await montar();

    await digitarPin(PIN_DA_TURMA);

    await waitFor(() =>
      expect(navegacoes).toContainEqual(['/sala/sala-mecanica', { replace: true }])
    );
    expect(__documentosDe('salas/sala-mecanica/membros')[0].entrouEm).toBe('fevereiro');
  });
});

describe('EntrarComPin — a recusa não conta nada (AC-SALA-04, AC-SEC-05)', () => {
  it('PIN que não existe em sala nenhuma dá o erro genérico', async () => {
    semearSalaDoCarlos();
    await montar();

    await digitarPin('000000');

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRO_DE_PIN);
    expect(navegacoes).toHaveLength(0);
  });

  it('PIN de sala arquivada dá a MESMA frase de PIN inexistente', async () => {
    // Se a tela dissesse "esta sala foi arquivada", ela teria confirmado que
    // aquele número é o PIN de alguém. É o vazamento que o AC-SALA-04 proíbe.
    semearSalaDoCarlos({ ativa: false });
    await montar();

    await digitarPin(PIN_DA_TURMA);

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRO_DE_PIN);
  });

  it('PIN curto nem chega a consultar o banco, e não gasta tentativa', async () => {
    semearSalaDoCarlos();
    await montar();

    await digitarPin('123');

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRO_DE_PIN);
    expect(__documentosDe('tentativasPin')).toHaveLength(0);
  });

  it('não mostra em lugar nenhum da tela o nome da sala de um PIN recusado', async () => {
    semearSalaDoCarlos({ ativa: false });
    await montar();

    await digitarPin(PIN_DA_TURMA);

    await screen.findByRole('alert');
    expect(screen.queryByText(/mecânica/i)).not.toBeInTheDocument();
  });
});

describe('EntrarComPin — força bruta (AC-SALA-12)', () => {
  it('explica o bloqueio quando o servidor recusa a tentativa', async () => {
    semearSalaDoCarlos();
    __semearColecao('tentativasPin', [{ id: ANA.uid, tentativas: 5 }]);
    // As duas escritas que `registrarTentativa` propõe são recusadas: somar
    // mais uma à janela corrente e reiniciar a janela. É assim que o limite
    // chega ao cliente.
    __recusarEscritaEm(`tentativasPin/${ANA.uid}`, 2);
    await montar();

    await digitarPin(PIN_DA_TURMA);

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRO_DE_LIMITE);
    expect(navegacoes).toHaveLength(0);
  });

  it('bloqueado não entra, mesmo com o PIN certo', async () => {
    semearSalaDoCarlos();
    __semearColecao('tentativasPin', [{ id: ANA.uid, tentativas: 5 }]);
    __recusarEscritaEm(`tentativasPin/${ANA.uid}`, 2);
    await montar();

    await digitarPin(PIN_DA_TURMA);

    await screen.findByRole('alert');
    expect(__documentosDe('salas/sala-mecanica/membros')).toHaveLength(0);
  });
});

describe('EntrarComPin — higiene', () => {
  it('não deixa listener para trás ao desmontar (AC-PERF-04)', async () => {
    semearSalaDoCarlos();
    const { unmount } = await montar();

    unmount();

    await waitFor(() => expect(__ouvintesAtivos()).toBe(0));
  });

  it('não dispara duas entradas com dois cliques seguidos', async () => {
    semearSalaDoCarlos();
    await montar();

    const botao = screen.getByRole('button', { name: /entrar/i });
    await userEvent.type(screen.getByLabelText(/pin/i), PIN_DA_TURMA);
    await userEvent.click(botao);
    await userEvent.click(botao);
    __confirmarCarimbos();

    await waitFor(() => expect(navegacoes.length).toBeGreaterThan(0));
    expect(navegacoes).toHaveLength(1);
  });
});
