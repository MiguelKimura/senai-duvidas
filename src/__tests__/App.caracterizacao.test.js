// Caracterização do App — roteamento e decisão de papel.
//
// Este arquivo fixa a falha de segurança central da v0.1.0: **quem decide se
// você é professor é o seu próprio navegador**. O papel sai de
// `localStorage.getItem('tipoUsuario')`, um valor que qualquer aluno edita pelo
// DevTools em dez segundos. O Firebase autentica *quem* é a pessoa; nada
// autentica *o que* ela pode. A task 01 move essa decisão para um custom claim
// e para as rules.
//
// Os testes abaixo não julgam esse comportamento: eles o travam, para que a
// task 01 prove que mudou — e para que ninguém o reintroduza depois.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  __definirUsuarioAtual,
  __definirUsuarioDoPopup,
  __resetarAuth,
} from 'firebase/auth';
import { __resetarFirestore } from 'firebase/firestore';
import App from '../App';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** Aponta a URL do navegador para `caminho` antes de montar o App. */
function irPara(caminho) {
  window.history.pushState({}, '', caminho);
}

/** Monta o App e espera o "Carregando..." sair da tela. */
async function montarApp() {
  const resultado = render(<App />);
  await waitFor(() => expect(screen.queryByText('Carregando...')).not.toBeInTheDocument());
  return resultado;
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  localStorage.clear();
  irPara('/');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App — carregamento inicial', () => {
  it('segura a tela atrás de um portão de carregamento até o auth responder', async () => {
    // O App renderiza `<p>Carregando...</p>` enquanto `onAuthStateChanged` nao
    // respondeu. Contra o SDK real isso dura uma ida a rede e o usuario ve o
    // texto; contra o fake em memoria a resposta e sincrona, entao o portao ja
    // abriu quando `render` retorna. O que da para afirmar — e o que importa —
    // e que a tela so aparece depois que o auth respondeu.
    await montarApp();

    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });

  it('mostra o rodapé em todas as rotas depois de carregar', async () => {
    await montarApp();

    expect(screen.getByText('Desenvolvido por Miguel Kimura Brito')).toBeInTheDocument();
  });

  it('sem sessão, a rota raiz cai no Login', async () => {
    await montarApp();

    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });
});

describe('App — o papel vem do localStorage (falha que a task 01 corrige)', () => {
  it('grava o usuário autenticado no localStorage, com o tipo lido do próprio localStorage', async () => {
    localStorage.setItem('tipoUsuario', 'aluno');
    __definirUsuarioAtual(ANA);

    await montarApp();

    expect(JSON.parse(localStorage.getItem('usuarioLogado'))).toEqual({
      nome: 'Ana Souza',
      tipo: 'aluno',
      email: 'ana@senai.br',
    });
  });

  it('assume "aluno" quando não há tipoUsuario gravado', async () => {
    __definirUsuarioAtual(ANA);

    await montarApp();

    expect(JSON.parse(localStorage.getItem('usuarioLogado')).tipo).toBe('aluno');
  });

  it('QUALQUER pessoa vira professor escrevendo no localStorage — sem passar pelo servidor', async () => {
    // Este é o ataque inteiro: uma linha no console do navegador.
    localStorage.setItem('tipoUsuario', 'professor');
    __definirUsuarioAtual(ANA);
    irPara('/professor');

    await montarApp();

    // Ana é aluna. Mesmo assim, a tela do professor abre.
    expect(screen.getByRole('heading', { name: 'Chamados dos Alunos' })).toBeInTheDocument();
  });

  it('limpa a sessão do localStorage quando o usuário desloga', async () => {
    localStorage.setItem('usuarioLogado', JSON.stringify({ nome: 'Ana', tipo: 'aluno' }));

    await montarApp();

    expect(localStorage.getItem('usuarioLogado')).toBeNull();
  });
});

describe('App — proteção de rota por tipo (AC-AUTH-01)', () => {
  it('/aluno abre a tela do aluno quando o tipo é aluno', async () => {
    localStorage.setItem('tipoUsuario', 'aluno');
    __definirUsuarioAtual(ANA);
    irPara('/aluno');

    await montarApp();

    expect(screen.getByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });

  it('/aluno cai no Login quando o tipo é professor', async () => {
    localStorage.setItem('tipoUsuario', 'professor');
    __definirUsuarioAtual(ANA);
    irPara('/aluno');

    await montarApp();

    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });

  it('/professor cai no Login quando o tipo é aluno', async () => {
    localStorage.setItem('tipoUsuario', 'aluno');
    __definirUsuarioAtual(ANA);
    irPara('/professor');

    await montarApp();

    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });

  it('/cadastro abre a tela de cadastro', async () => {
    irPara('/cadastro');

    await montarApp();

    expect(screen.getByRole('heading', { name: /cadastro/i })).toBeInTheDocument();
  });
});

describe('App — login social ainda NAO existe na interface (AC-AUTH-02)', () => {
  // O `App` constroi `providerGoogle`/`providerGithub` e define
  // `handleLoginGoogle`/`handleLoginGithub`, e passa os dois como props para o
  // `Login`. O `Login` simplesmente ignora essas props: nao existe botao de
  // Google nem de GitHub em lugar nenhum da interface.
  //
  // Ou seja, o OAuth da v0.1.0 e codigo morto — esboçado e nunca ligado. Isso
  // importa por dois motivos: e a razao de o AC-AUTH-02 continuar em aberto, e
  // explica o buraco de cobertura em `App.js`, que nenhum teste de interface
  // consegue fechar porque nao ha caminho ate la. A task 01 implementa o login
  // social de verdade; ate la, estes testes impedem que alguem conclua que ele
  // ja funciona.

  it('nao existe botao de login com Google na tela de login', async () => {
    await montarApp();

    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
  });

  it('nao existe botao de login com GitHub na tela de login', async () => {
    await montarApp();

    expect(screen.queryByRole('button', { name: /github/i })).not.toBeInTheDocument();
  });

  it('o unico botao da tela de login e o de entrar por e-mail e senha', async () => {
    await montarApp();

    const botoes = screen.getAllByRole('button');
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).toHaveAttribute('type', 'submit');
  });

  it('mesmo com um popup pronto para responder, nada na tela o aciona', async () => {
    __definirUsuarioDoPopup(ANA);

    await montarApp();

    // Nenhum clique possivel leva a uma sessao: o caminho nao existe.
    expect(localStorage.getItem('usuarioLogado')).toBeNull();
  });
});
