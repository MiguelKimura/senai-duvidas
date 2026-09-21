// As rotas de sala — AC-SALA-01, AC-SALA-04, AC-SALA-06, AC-SALA-07.
//
// O mapa de rotas desta versão acrescenta quatro endereços e **não remove**
// nenhum: `/aluno` e `/professor` continuam existindo, lendo as coleções
// globais da v0.4.0. É o mesmo fallback de leitura das telas, agora no nível da
// navegação: um link antigo, um favorito ou uma aba aberta desde antes do
// deploy continuam abrindo uma tela útil (compatibilidade retroativa, seção 4
// do protocolo).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  __definirRelogioDoServidor,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import App from '../App';
import { __esquecerPersistencia } from '../services/auth';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };
const HORARIO_DO_SERVIDOR = '2026-03-10T13:45:00.000Z';

function irPara(caminho) {
  window.history.pushState({}, '', caminho);
}

async function montarApp() {
  const view = render(<App />);
  await waitFor(() => expect(screen.queryByText('Carregando...')).not.toBeInTheDocument());
  return view;
}

function semearProfessor() {
  __semearColecao('usuarios', [
    { id: CARLOS.uid, uid: CARLOS.uid, nome: 'Carlos Lima', email: CARLOS.email, tipo: 'professor' },
  ]);
  __semearColecao('autorizados', [{ id: CARLOS.email, Tipo: 'professor' }]);
}

function semearSalaComAna() {
  __semearColecao('salas', [
    {
      id: 'sala-mecanica',
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      professorNome: 'Carlos Lima',
      ativa: true,
      arquivadaEm: null,
    },
  ]);
  __semearColecao('salas/sala-mecanica/membros', [
    { id: ANA.uid, nome: 'Ana Souza', email: ANA.email, papel: 'aluno' },
  ]);
  __semearColecao(`usuarios/${ANA.uid}/salas`, [
    { id: 'sala-mecanica', salaId: 'sala-mecanica', papel: 'aluno' },
  ]);
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __esquecerPersistencia();
  localStorage.clear();
  irPara('/');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('Rotas de sala — quem está autenticado (AC-SALA-06)', () => {
  it('/salas abre a lista de salas do aluno', async () => {
    semearSalaComAna();
    __definirUsuarioAtual(ANA);
    irPara('/salas');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /minhas salas/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Mecânica 2º ano' })).toBeInTheDocument();
  });

  it('/salas/entrar abre a tela de PIN', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/salas/entrar');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /entrar na sala/i })).toBeInTheDocument();
  });

  it('/sala/:salaId abre a sala de quem é membro', async () => {
    semearSalaComAna();
    __semearColecao('salas/sala-mecanica/chamados', [
      {
        id: 'c1',
        autorNome: 'Ana Souza',
        nome: 'Ana Souza',
        email: ANA.email,
        descricao: 'O torno travou.',
        horario: '2026-03-10T13:00:00.000Z',
        horarioIso: '2026-03-10T13:00:00.000Z',
        atendido: false,
      },
    ]);
    __definirUsuarioAtual(ANA);
    irPara('/sala/sala-mecanica');

    await montarApp();

    expect(await screen.findByText('O torno travou.')).toBeInTheDocument();
  });
});

describe('Rotas de sala — quem cria (AC-SALA-01)', () => {
  it('/salas/nova abre para o professor', async () => {
    semearProfessor();
    __definirUsuarioAtual(CARLOS);
    irPara('/salas/nova');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /nova sala/i })).toBeInTheDocument();
  });

  it('/salas/nova não abre para o aluno: criar sala é do professor', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/salas/nova');

    await montarApp();

    expect(screen.queryByRole('heading', { name: /nova sala/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });
});

describe('Rotas de sala — sem sessão nenhuma', () => {
  it.each(['/salas', '/salas/entrar', '/salas/nova', '/sala/sala-mecanica'])(
    '%s cai no login',
    async (caminho) => {
      irPara(caminho);

      await montarApp();

      expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
    }
  );
});

describe('Rotas antigas continuam abrindo (compatibilidade retroativa)', () => {
  it('/aluno ainda abre a tela do aluno, lendo a coleção global', async () => {
    __semearColecao('chamados', [
      {
        id: 'legado',
        nome: 'Ana Souza',
        email: ANA.email,
        descricao: 'Chamado da coleção global.',
        horario: '2026-03-09T13:00:00.000Z',
        horarioIso: '2026-03-09T13:00:00.000Z',
      },
    ]);
    __definirUsuarioAtual(ANA);
    irPara('/aluno');

    await montarApp();

    expect(await screen.findByText('Chamado da coleção global.')).toBeInTheDocument();
  });

  it('/professor ainda abre a fila global para o professor', async () => {
    semearProfessor();
    __semearColecao('chamados', [
      {
        id: 'legado',
        nome: 'Ana Souza',
        email: ANA.email,
        descricao: 'Chamado da coleção global.',
        horario: '2026-03-09T13:00:00.000Z',
        horarioIso: '2026-03-09T13:00:00.000Z',
      },
    ]);
    __definirUsuarioAtual(CARLOS);
    irPara('/professor');

    await montarApp();

    expect(await screen.findByText('Chamado da coleção global.')).toBeInTheDocument();
  });
});
