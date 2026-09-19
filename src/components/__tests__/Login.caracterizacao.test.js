// Caracterização do login por e-mail/senha — AC-AUTH-02 [REG].
//
// Estes testes descrevem o comportamento da v0.1.0 COMO ELE É, inclusive onde
// ele está errado. Eles não são um elogio ao desenho atual: são o contrato que
// a task 01 vai mudar de forma consciente, vendo exatamente o que quebra.
//
// O que fica fixado aqui, e que a task 01 deve mudar de propósito:
//   * o erro de credencial chega ao usuário por `alert()`, não por um
//     componente de aviso (AC-ANIM-07 vai substituir isso);
//   * o `Login` mantém um `onAuthStateChanged` próprio, concorrente com o de
//     App.js e o de firebase.js — a origem da tela de login que "pisca";
//   * o papel vem de `usuarios/{uid}.tipo` lido no Firestore, e qualquer valor
//     diferente de "aluno" leva para /professor.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  __definirUsuarioAtual,
  __registrarCredencial,
  __resetarAuth,
} from 'firebase/auth';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import Login from '../Login';
import { renderComProvedores, fabricaUsuario } from '../../test-utils';

const mockNavegar = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavegar,
}));

let avisos;

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  mockNavegar.mockClear();
  avisos = jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  avisos.mockRestore();
});

function preencherEEnviar({ email, senha }) {
  userEvent.type(screen.getByLabelText('E-mail'), email);
  userEvent.type(screen.getByLabelText('Senha'), senha);
  userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Login — formulário', () => {
  it('apresenta os campos de e-mail, senha e o botão Entrar', () => {
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('oferece o caminho para o cadastro', () => {
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    expect(screen.getByRole('link', { name: 'Cadastre-se' })).toHaveAttribute(
      'href',
      '/cadastro'
    );
  });
});

describe('Login — credencial válida (AC-AUTH-02)', () => {
  it('redireciona o aluno para /aluno conforme usuarios/{uid}.tipo', async () => {
    const aluno = fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno' });
    __registrarCredencial('ana@senai.br', 'senha123', { uid: 'uid-aluno' });
    __semearColecao('usuarios', [{ id: 'uid-aluno', ...aluno }]);
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    preencherEEnviar({ email: 'ana@senai.br', senha: 'senha123' });

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno'));
  });

  it('redireciona o professor para /professor conforme usuarios/{uid}.tipo', async () => {
    const professor = fabricaUsuario({ uid: 'uid-prof', tipo: 'professor' });
    __registrarCredencial('carlos@senai.br', 'senha123', { uid: 'uid-prof' });
    __semearColecao('usuarios', [{ id: 'uid-prof', ...professor }]);
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    preencherEEnviar({ email: 'carlos@senai.br', senha: 'senha123' });

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/professor'));
  });

  it('entrega ao App o documento do Firestore, não o usuário do Auth', async () => {
    const aluno = fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno', nome: 'Ana Souza' });
    __registrarCredencial('ana@senai.br', 'senha123', { uid: 'uid-aluno' });
    __semearColecao('usuarios', [{ id: 'uid-aluno', ...aluno }]);
    const setUsuarioLogado = jest.fn();
    renderComProvedores(<Login setUsuarioLogado={setUsuarioLogado} />);

    preencherEEnviar({ email: 'ana@senai.br', senha: 'senha123' });

    await waitFor(() =>
      expect(setUsuarioLogado).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Ana Souza', tipo: 'aluno' })
      )
    );
  });
});

describe('Login — credencial inválida (AC-AUTH-02)', () => {
  it('avisa o usuário e não navega', async () => {
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    preencherEEnviar({ email: 'ana@senai.br', senha: 'errada' });

    await waitFor(() =>
      expect(avisos).toHaveBeenCalledWith('Erro ao fazer login. Verifique suas credenciais.')
    );
    expect(mockNavegar).not.toHaveBeenCalled();
  });

  it('reabilita o botão depois da falha, para o usuário poder tentar de novo', async () => {
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    preencherEEnviar({ email: 'ana@senai.br', senha: 'errada' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
  });
});

describe('Login — usuário autenticado sem documento no Firestore', () => {
  it('avisa que o usuário não está no banco e não navega', async () => {
    __registrarCredencial('fantasma@senai.br', 'senha123', { uid: 'uid-fantasma' });
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    preencherEEnviar({ email: 'fantasma@senai.br', senha: 'senha123' });

    await waitFor(() =>
      expect(avisos).toHaveBeenCalledWith('Usuário não encontrado no banco de dados.')
    );
    expect(mockNavegar).not.toHaveBeenCalled();
  });
});

describe('Login — listener próprio de sessão (comportamento a unificar na task 01)', () => {
  it('redireciona sozinho quando já existe sessão ativa, sem passar pelo formulário', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-aluno', ...fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno' }) },
    ]);
    renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    __definirUsuarioAtual({ uid: 'uid-aluno', email: 'ana@senai.br' });

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno'));
  });

  it('cancela a inscrição ao desmontar, sem vazar listener (AC-PERF-04)', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-aluno', ...fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno' }) },
    ]);
    const { unmount } = renderComProvedores(<Login setUsuarioLogado={jest.fn()} />);

    unmount();
    __definirUsuarioAtual({ uid: 'uid-aluno', email: 'ana@senai.br' });

    await waitFor(() => expect(mockNavegar).not.toHaveBeenCalled());
  });
});
