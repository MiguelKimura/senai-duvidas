// `RotaProtegida` — o fim da tela de login que pisca (AC-AUTH-09).
//
// Na v0.2.0 a rota protegida era um ternário dentro do `App`:
// `usuarioLogado?.tipo === 'aluno' ? <TelaAluno/> : <Login/>`. Como o papel
// vinha do localStorage, ele existia antes do Firebase responder — e quando o
// papel passa a depender de uma ida ao Firestore, esse mesmo ternário renderiza
// `<Login>` por um instante para quem já está autenticado. É a piscada.
//
// Aqui o estado "ainda não sei" é explícito e tem tela própria.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import RotaProtegida from '../RotaProtegida';
import { AuthProvider } from '../../contexts/AuthContext';

const ANA = {
  uid: 'uid-ana',
  email: 'ana@senai.br',
  displayName: 'Ana Souza',
  providerData: [{ providerId: 'google.com' }],
};

const CARLOS = {
  uid: 'uid-carlos',
  email: 'carlos@senai.br',
  displayName: 'Carlos Lima',
  providerData: [{ providerId: 'password' }],
};

function semearProfessor() {
  __semearColecao('usuarios', [
    { id: 'uid-carlos', uid: 'uid-carlos', email: 'carlos@senai.br', tipo: 'professor' },
  ]);
  __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);
}

/** Monta um roteador mínimo com as três rotas que a aplicação tem. */
function montar(rota = '/aluno') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<h1>Login</h1>} />
          <Route
            path="/aluno"
            element={
              <RotaProtegida papel="aluno">
                <h1>Tela do aluno</h1>
              </RotaProtegida>
            }
          />
          <Route
            path="/professor"
            element={
              <RotaProtegida papel="professor">
                <h1>Tela do professor</h1>
              </RotaProtegida>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  localStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('enquanto o papel não está resolvido (AC-AUTH-09)', () => {
  it('mostra carregamento em vez da tela protegida', () => {
    __definirUsuarioAtual(ANA);

    montar('/aluno');

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('Tela do aluno')).not.toBeInTheDocument();
  });

  it('NÃO renderiza a tela de login para quem já está autenticado', async () => {
    // O teste da piscada. Antes de qualquer `await`, no exato instante em que
    // o ternário da v0.2.0 mostrava `<Login>`.
    __definirUsuarioAtual(ANA);

    montar('/aluno');

    expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();

    // E, terminado o carregamento, a tela certa aparece sem ter passado pelo login.
    expect(await screen.findByText('Tela do aluno')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('o carregamento é anunciado para leitor de tela', () => {
    __definirUsuarioAtual(ANA);

    montar('/aluno');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando...');
  });
});

describe('papel resolvido', () => {
  it('abre a tela do aluno para quem é aluno', async () => {
    __definirUsuarioAtual(ANA);

    montar('/aluno');

    expect(await screen.findByText('Tela do aluno')).toBeInTheDocument();
  });

  it('abre a tela do professor para quem é professor', async () => {
    semearProfessor();
    __definirUsuarioAtual(CARLOS);

    montar('/professor');

    expect(await screen.findByText('Tela do professor')).toBeInTheDocument();
  });

  it('manda o aluno de volta para /aluno quando ele tenta /professor', async () => {
    __definirUsuarioAtual(ANA);

    montar('/professor');

    expect(await screen.findByText('Tela do aluno')).toBeInTheDocument();
    expect(screen.queryByText('Tela do professor')).not.toBeInTheDocument();
  });

  it('manda o professor de volta para /professor quando ele tenta /aluno', async () => {
    semearProfessor();
    __definirUsuarioAtual(CARLOS);

    montar('/aluno');

    expect(await screen.findByText('Tela do professor')).toBeInTheDocument();
  });

  it('localStorage dizendo professor não abre a tela do professor', async () => {
    // AC-SEC-03 visto pela rota: o ataque da v0.2.0 não sai do lugar.
    localStorage.setItem('tipoUsuario', 'professor');
    localStorage.setItem('usuarioLogado', JSON.stringify({ tipo: 'professor' }));
    __definirUsuarioAtual(ANA);

    montar('/professor');

    expect(await screen.findByText('Tela do aluno')).toBeInTheDocument();
    expect(screen.queryByText('Tela do professor')).not.toBeInTheDocument();
  });
});

describe('sem sessão (AC-AUTH-08)', () => {
  it('redireciona para a raiz, onde está o login', async () => {
    montar('/aluno');

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('substitui a entrada no histórico, para o voltar não reabrir a rota protegida', async () => {
    // Sem `replace`, o botão "voltar" traria a pessoa de volta à URL protegida
    // logo depois do logout — o cenário exato que o AC-AUTH-08 proíbe.
    montar('/aluno');
    await screen.findByRole('heading', { name: 'Login' });

    window.history.back();

    await waitFor(() => expect(screen.queryByText('Tela do aluno')).not.toBeInTheDocument());
  });
});

describe('falha ao resolver o papel', () => {
  it('mostra o erro e oferece tentar novamente, sem abrir a tela', async () => {
    const firestore = require('firebase/firestore');
    jest.spyOn(firestore, 'getDoc').mockRejectedValue(new Error('rede caiu'));
    __definirUsuarioAtual(ANA);

    montar('/aluno');

    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar seu acesso'
    );
    expect(screen.queryByText('Tela do aluno')).not.toBeInTheDocument();
  });

  it('o botão tentar novamente refaz a resolução e abre a tela quando a rede volta', async () => {
    const firestore = require('firebase/firestore');
    const original = firestore.getDoc.bind(firestore);
    const leitura = jest
      .spyOn(firestore, 'getDoc')
      .mockRejectedValueOnce(new Error('rede caiu'))
      .mockImplementation(original);
    __definirUsuarioAtual(ANA);

    montar('/aluno');
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Tela do aluno')).toBeInTheDocument();
    expect(leitura).toHaveBeenCalled();
  });
});
