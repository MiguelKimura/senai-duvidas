// Caracterização do login — AC-AUTH-02 [REG], AC-AUTH-03, AC-AUTH-04, AC-AUTH-05.
//
// Este arquivo nasceu na task 00 descrevendo a v0.1.0 como ela era, inclusive
// onde estava errada. A task 01 muda três daquelas coisas **de propósito**, e
// as asserções correspondentes foram reescritas aqui, não apagadas:
//
//   1. o erro de credencial vinha por `alert()`, que bloqueia a aba e some sem
//      deixar rastro; agora é uma mensagem renderizada no formulário;
//   2. o `Login` mantinha um `onAuthStateChanged` próprio, concorrente com o de
//      `App.js` e o de `firebase.js` — a origem da tela que piscava. Agora
//      quem observa a sessão é o `AuthProvider`, e o `Login` só reage ao
//      contexto;
//   3. quem autenticava sem documento em `usuarios/{uid}` ficava preso em
//      "Usuário não encontrado no banco de dados". Agora `garantirPerfil` cria
//      o documento — é o que destrava o primeiro login social.
//
// O que **não** mudou e continua fixado: o papel sai do Firestore, e é ele que
// decide entre `/aluno` e `/professor`.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  __definirUsuarioAtual,
  __definirUsuarioDoPopup,
  __registrarCredencial,
  __resetarAuth,
} from 'firebase/auth';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import Login from '../Login';
import { renderComProvedores, fabricaUsuario } from '../../test-utils';
import { __esquecerPersistencia } from '../../services/auth';

const mockNavegar = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavegar,
}));

let avisos;

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __esquecerPersistencia();
  localStorage.clear();
  mockNavegar.mockClear();
  avisos = jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

function preencherEEnviar({ email, senha }) {
  userEvent.type(screen.getByLabelText('E-mail'), email);
  userEvent.type(screen.getByLabelText('Senha'), senha);
  userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

/** Espera o provider terminar de resolver a sessão inicial. */
async function aguardarFormulario() {
  return screen.findByRole('button', { name: 'Entrar' });
}

describe('Login — formulário', () => {
  it('apresenta os campos de e-mail, senha e o botão Entrar', async () => {
    renderComProvedores(<Login />);
    await aguardarFormulario();

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('oferece o caminho para o cadastro', async () => {
    renderComProvedores(<Login />);
    await aguardarFormulario();

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
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'ana@senai.br', senha: 'senha123' });

    // `{ replace: true }` entrou na task 01: sem ele, o "voltar" do navegador
    // devolve a pessoa à tela de login já autenticada, que redireciona de
    // volta — um vaivém que o AC-AUTH-08 não admite.
    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno', { replace: true }));
  });

  it('redireciona o professor para /professor conforme usuarios/{uid}.tipo', async () => {
    const professor = fabricaUsuario({
      uid: 'uid-prof',
      tipo: 'professor',
      email: 'carlos@senai.br',
    });
    __registrarCredencial('carlos@senai.br', 'senha123', { uid: 'uid-prof' });
    __semearColecao('usuarios', [{ id: 'uid-prof', ...professor }]);
    // A task 01 acrescenta a segunda fonte: sem `autorizados`, o documento
    // sozinho não promove mais ninguém (AC-AUTH-06).
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'carlos@senai.br', senha: 'senha123' });

    await waitFor(() =>
      expect(mockNavegar).toHaveBeenCalledWith('/professor', { replace: true })
    );
  });

  it('o papel que decide a rota vem do Firestore, não do localStorage', async () => {
    // Antes da task 01 este teste afirmava que o `Login` entregava o documento
    // do Firestore ao `App` por `setUsuarioLogado`. A prop deixou de existir:
    // quem guarda a sessão é o `AuthProvider`. O que aquele teste realmente
    // protegia — "o papel sai do banco, não do navegador" — continua aqui, e
    // agora com o ataque do localStorage junto.
    const aluno = fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno' });
    __registrarCredencial('ana@senai.br', 'senha123', { uid: 'uid-aluno' });
    __semearColecao('usuarios', [{ id: 'uid-aluno', ...aluno }]);
    localStorage.setItem('tipoUsuario', 'professor');
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'ana@senai.br', senha: 'senha123' });

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno', { replace: true }));
    expect(mockNavegar).not.toHaveBeenCalledWith('/professor', expect.anything());
  });
});

describe('Login — credencial inválida (AC-AUTH-02, AC-AUTH-05)', () => {
  it('mostra a mensagem no formulário, sem alert, e não navega', async () => {
    // Era `expect(avisos).toHaveBeenCalledWith('Erro ao fazer login...')`. O
    // `alert()` saiu de cena na task 01: ele bloqueia a aba inteira e some sem
    // deixar rastro na tela para quem vai reler o que deu errado.
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'ana@senai.br', senha: 'errada' });

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
    expect(avisos).not.toHaveBeenCalled();
    expect(mockNavegar).not.toHaveBeenCalled();
  });

  it('nunca exibe o código nem o texto cru do Firebase', async () => {
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'ana@senai.br', senha: 'errada' });

    const aviso = await screen.findByRole('alert');
    expect(aviso).not.toHaveTextContent('auth/');
    expect(aviso).not.toHaveTextContent('Firebase');
  });

  it('reabilita o botão depois da falha, para o usuário poder tentar de novo', async () => {
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'ana@senai.br', senha: 'errada' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
  });
});

describe('Login — usuário autenticado sem documento no Firestore', () => {
  it('cria o perfil e segue para /aluno, em vez de travar a pessoa na tela', async () => {
    // Era: `expect(avisos).toHaveBeenCalledWith('Usuário não encontrado no
    // banco de dados.')` e nenhuma navegação. Aquele beco sem saída é
    // exatamente o que impedia o primeiro login social de funcionar: o
    // Firebase autenticava, o documento não existia, e a pessoa ficava presa.
    __registrarCredencial('fantasma@senai.br', 'senha123', { uid: 'uid-fantasma' });
    renderComProvedores(<Login />);
    await aguardarFormulario();

    preencherEEnviar({ email: 'fantasma@senai.br', senha: 'senha123' });

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno', { replace: true }));
    expect(avisos).not.toHaveBeenCalled();
  });
});

describe('Login — sessão observada pelo provider, não pelo componente', () => {
  it('redireciona sozinho quando já existe sessão ativa, sem passar pelo formulário', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-aluno', ...fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno' }) },
    ]);
    renderComProvedores(<Login />);

    __definirUsuarioAtual({ uid: 'uid-aluno', email: 'ana@senai.br' });

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno', { replace: true }));
  });

  it('não observa o auth por conta própria — o listener é um só', () => {
    // Antes, `Login` chamava `auth.onAuthStateChanged` e competia com os
    // outros dois listeners da aplicação. Agora o único assinante é o
    // `AuthProvider`.
    const fonte = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'Login.js'),
      'utf8'
    );

    expect(fonte).not.toMatch(/onAuthStateChanged/);
  });

  it('cancela a inscrição ao desmontar, sem vazar listener (AC-PERF-04)', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-aluno', ...fabricaUsuario({ uid: 'uid-aluno', tipo: 'aluno' }) },
    ]);
    const { unmount } = renderComProvedores(<Login />);

    unmount();
    __definirUsuarioAtual({ uid: 'uid-aluno', email: 'ana@senai.br' });

    await waitFor(() => expect(mockNavegar).not.toHaveBeenCalled());
  });
});

describe('Login — entrar com Google (AC-AUTH-03)', () => {
  const ANA_DO_GOOGLE = {
    uid: 'uid-ana',
    email: 'ana@senai.br',
    displayName: 'Ana Souza',
    providerData: [{ providerId: 'google.com' }],
  };

  it('existe um botão "Entrar com Google" na tela', async () => {
    renderComProvedores(<Login />);
    await aguardarFormulario();

    expect(screen.getByRole('button', { name: /entrar com google/i })).toBeInTheDocument();
  });

  it('autentica e leva para /aluno no primeiro acesso', async () => {
    __definirUsuarioDoPopup(ANA_DO_GOOGLE);
    renderComProvedores(<Login />);
    await aguardarFormulario();

    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno', { replace: true }));
  });

  it('a janela fechada vira mensagem no formulário, sem alert', async () => {
    __definirUsuarioDoPopup(null);
    renderComProvedores(<Login />);
    await aguardarFormulario();

    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A janela de login foi fechada');
    expect(avisos).not.toHaveBeenCalled();
  });
});

describe('Login — entrar com GitHub (AC-AUTH-04)', () => {
  it('existe um botão "Entrar com GitHub" na tela', async () => {
    renderComProvedores(<Login />);
    await aguardarFormulario();

    expect(screen.getByRole('button', { name: /entrar com github/i })).toBeInTheDocument();
  });

  it('autentica e leva para /aluno no primeiro acesso', async () => {
    __definirUsuarioDoPopup({
      uid: 'uid-bruno',
      email: 'bruno@senai.br',
      displayName: null,
      providerData: [{ providerId: 'github.com' }],
    });
    renderComProvedores(<Login />);
    await aguardarFormulario();

    await userEvent.click(screen.getByRole('button', { name: /entrar com github/i }));

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno', { replace: true }));
  });
});

describe('Login — e-mail já vinculado a outro método (AC-AUTH-05)', () => {
  it('explica como vincular a conta, em português e sem código do Firebase', async () => {
    const firebaseAuth = require('firebase/auth');
    const conflito = new Error(
      'Firebase: Error (auth/account-exists-with-different-credential).'
    );
    conflito.code = 'auth/account-exists-with-different-credential';
    jest.spyOn(firebaseAuth, 'signInWithPopup').mockRejectedValue(conflito);
    renderComProvedores(<Login />);
    await aguardarFormulario();

    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Este e-mail já está cadastrado por outro método');
    expect(aviso).not.toHaveTextContent('auth/');
    expect(avisos).not.toHaveBeenCalled();
  });
});
