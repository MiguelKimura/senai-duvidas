// A tela em que o professor cria a sala — AC-SALA-01, AC-SALA-02, AC-SALA-03.
//
// O serviço `services/salas.js` já é provado em `services/__tests__`. O que
// este arquivo cobre é o que só existe na tela: o formulário validado antes de
// qualquer escrita, o PIN aparecendo **uma vez** em destaque, e a cópia com um
// clique — porque o professor vai ditar esse número para quarenta alunos e
// errar um dígito ao copiar à mão é o modo de falha mais provável de todos.
//
// O AC-SEC-05 também é verificado daqui: depois de a tela mostrar o PIN, o
// documento da sala no banco não pode conter aquele número em lugar nenhum.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
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
import CriarSala from '../CriarSala';
import { renderComProvedores } from '../../test-utils';

const navegacoes = [];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => (destino, opcoes) => navegacoes.push([destino, opcoes]),
}));

const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };
const HORARIO_DO_SERVIDOR = '2026-02-10T13:45:00.000Z';

/** Carlos é professor nas duas fontes que o `AuthContext` consulta. */
function semearProfessor() {
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

/** Monta a tela já com a sessão do professor resolvida. */
async function montar() {
  const view = renderComProvedores(<CriarSala />, { rota: '/salas/nova' });
  await screen.findByRole('heading', { name: /nova sala/i });
  return view;
}

/** Preenche o formulário e envia. */
async function criarSala({
  nome = 'Mecânica 2º ano',
  curso = 'Mecânica — Turma B',
  ano = '2026',
} = {}) {
  await userEvent.clear(screen.getByLabelText(/nome da sala/i));
  if (nome) await userEvent.type(screen.getByLabelText(/nome da sala/i), nome);

  await userEvent.clear(screen.getByLabelText(/curso/i));
  if (curso) await userEvent.type(screen.getByLabelText(/curso/i), curso);

  await userEvent.clear(screen.getByLabelText(/ano letivo/i));
  if (ano) await userEvent.type(screen.getByLabelText(/ano letivo/i), ano);

  await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
  __confirmarCarimbos();
}

let copiados = [];

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  semearProfessor();
  __definirUsuarioAtual(CARLOS);
  navegacoes.length = 0;
  copiados = [];

  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn((texto) => copiados.push(texto) && Promise.resolve()) },
  });
});

describe('CriarSala — o formulário (AC-SALA-01)', () => {
  it('pede nome, curso/turma e ano letivo', async () => {
    await montar();

    expect(screen.getByLabelText(/nome da sala/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/curso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ano letivo/i)).toBeInTheDocument();
  });

  it('já vem com o ano letivo corrente preenchido, que é o certo em 99% das vezes', async () => {
    await montar();

    expect(screen.getByLabelText(/ano letivo/i)).toHaveValue(String(new Date().getFullYear()));
  });

  it('recusa nome vazio com mensagem em português e não escreve nada no banco', async () => {
    await montar();

    await criarSala({ nome: '' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/informe o nome da sala/i);
    expect(__documentosDe('salas')).toHaveLength(0);
  });

  it('grava nome, curso, ano letivo e o dono da sala (AC-SALA-05)', async () => {
    await montar();

    await criarSala();

    await screen.findByText(/sala criada/i);
    const [sala] = __documentosDe('salas');
    expect(sala).toMatchObject({
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      ativa: true,
      arquivadaEm: null,
    });
  });
});

describe('CriarSala — o PIN (AC-SALA-02, AC-SALA-03, AC-SEC-05)', () => {
  it('mostra o PIN de 6 dígitos em destaque depois de criar', async () => {
    await montar();

    await criarSala();

    const destaque = await screen.findByTestId('pin-em-destaque');
    expect(destaque).toHaveTextContent(/^\d{6}$/);
  });

  it('copia o PIN com um clique', async () => {
    await montar();
    await criarSala();
    const pin = (await screen.findByTestId('pin-em-destaque')).textContent;

    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));

    expect(copiados).toEqual([pin]);
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument();
  });

  it('o PIN que a tela mostra NÃO está em claro no documento da sala', async () => {
    await montar();
    await criarSala();
    const pin = (await screen.findByTestId('pin-em-destaque')).textContent;

    const [sala] = __documentosDe('salas');

    expect(JSON.stringify(sala)).not.toContain(pin);
    expect(Object.keys(sala)).not.toContain('pin');
  });

  it('avisa que o PIN aparece uma vez só, porque ninguém o recupera depois', async () => {
    await montar();

    await criarSala();

    expect(await screen.findByText(/anote agora|uma única vez|só aparece/i)).toBeInTheDocument();
  });

  it('leva o professor para a sala recém-criada quando ele termina', async () => {
    await montar();
    await criarSala();
    await screen.findByTestId('pin-em-destaque');

    await userEvent.click(screen.getByRole('button', { name: /ir para a sala/i }));

    const [sala] = __documentosDe('salas');
    expect(navegacoes).toContainEqual([`/sala/${sala.id}`, { replace: true }]);
  });
});

describe('CriarSala — falhas e vazamentos', () => {
  it('não deixa listener nenhum para trás ao desmontar (AC-PERF-04)', async () => {
    const { unmount } = await montar();
    await criarSala();
    await screen.findByTestId('pin-em-destaque');

    unmount();

    await waitFor(() => expect(__ouvintesAtivos()).toBe(0));
  });

  it('não envia duas vezes enquanto a primeira criação está em voo', async () => {
    await montar();

    const botao = screen.getByRole('button', { name: /criar sala/i });
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Mecânica 2º ano');
    await userEvent.type(screen.getByLabelText(/curso/i), 'Mecânica — Turma B');
    await userEvent.click(botao);
    await userEvent.click(botao);
    __confirmarCarimbos();

    await screen.findByTestId('pin-em-destaque');
    expect(__documentosDe('salas')).toHaveLength(1);
  });
});
