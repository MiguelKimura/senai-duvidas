// Caracterização do App — roteamento e decisão de papel.
//
// A task 00 escreveu este arquivo para **fixar** a falha de segurança central
// da v0.1.0: quem decidia se você era professor era o seu próprio navegador. O
// papel saía de `localStorage.getItem('tipoUsuario')`, um valor que qualquer
// aluno edita pelo DevTools em dez segundos.
//
// A task 01 é a que corrige isso, então este é o arquivo que mais muda — e as
// asserções não foram apagadas, foram **invertidas**. Onde antes se lia "o
// ataque funciona", lê-se agora "o ataque não sai do lugar", com o cenário do
// ataque preservado linha por linha. É essa inversão que comprova a correção.
//
// O `App` também deixou de ter lógica de autenticação: virou roteamento
// envolvido pelo `AuthProvider`.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import {
  __definirUsuarioAtual,
  __definirUsuarioDoPopup,
  __resetarAuth,
} from 'firebase/auth';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import App from '../App';
import { __esquecerPersistencia } from '../services/auth';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };

/** Aponta a URL do navegador para `caminho` antes de montar o App. */
function irPara(caminho) {
  window.history.pushState({}, '', caminho);
}

/** Monta o App e espera o "Carregando..." sair da tela. */
async function montarApp() {
  const view = render(<App />);
  await waitFor(() => expect(screen.queryByText('Carregando...')).not.toBeInTheDocument());
  return view;
}

/** Carlos é professor de verdade: as duas fontes do Firestore concordam. */
function semearProfessorDeVerdade() {
  __semearColecao('usuarios', [
    { id: 'uid-carlos', uid: 'uid-carlos', nome: 'Carlos Lima', email: 'carlos@senai.br', tipo: 'professor' },
  ]);
  __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __esquecerPersistencia();
  localStorage.clear();
  irPara('/');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('App — carregamento inicial', () => {
  it('segura a tela atrás de um portão de carregamento até o papel ser resolvido', async () => {
    // Na v0.2.0 o portão esperava só o `onAuthStateChanged` responder, porque o
    // papel já estava no localStorage. Agora ele espera também a ida ao
    // Firestore que resolve o papel — é o que impede tratar alguém como aluno
    // antes de saber (AC-AUTH-09).
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

  it('o App não faz autenticação nenhuma: só roteamento', () => {
    // As três implementações concorrentes de auth saíram de cena. A que vivia
    // aqui — `onAuthStateChanged` + `signInWithPopup` + leitura do localStorage
    // — foi para o `AuthProvider` e para `services/auth.js`.
    const fonte = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'App.js'),
      'utf8'
    );

    expect(fonte).not.toMatch(/onAuthStateChanged/);
    expect(fonte).not.toMatch(/signInWithPopup/);
    expect(fonte).not.toMatch(/localStorage/);
  });
});

describe('App — o papel NÃO vem mais do localStorage (AC-AUTH-06, AC-SEC-03)', () => {
  it('não grava a sessão no localStorage', async () => {
    // Era: `expect(JSON.parse(localStorage.getItem('usuarioLogado'))).toEqual({...})`.
    // Espelhar a sessão no navegador é o que dava ao navegador uma opinião
    // sobre quem é professor. Agora não há espelho nenhum.
    localStorage.setItem('tipoUsuario', 'aluno');
    __definirUsuarioAtual(ANA);

    await montarApp();

    expect(localStorage.getItem('usuarioLogado')).toBeNull();
  });

  it('o papel de quem só existe no Auth é aluno, vindo do documento criado no Firestore', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/aluno');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });

  it('NINGUÉM vira professor escrevendo no localStorage — o ataque da v0.1.0', async () => {
    // Este era o ataque inteiro: uma linha no console do navegador. O cenário
    // está preservado; o que mudou é o desfecho.
    localStorage.setItem('tipoUsuario', 'professor');
    __definirUsuarioAtual(ANA);
    irPara('/professor');

    await montarApp();

    // Ana é aluna. A tela do professor não abre; ela é mandada para a dela.
    expect(
      screen.queryByRole('heading', { name: 'Chamados dos Alunos' })
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });

  it('nem escrevendo a sessão inteira em usuarioLogado', async () => {
    localStorage.setItem(
      'usuarioLogado',
      JSON.stringify({ nome: 'Ana Souza', tipo: 'professor', email: 'ana@senai.br' })
    );
    __definirUsuarioAtual(ANA);
    irPara('/professor');

    await montarApp();

    expect(
      screen.queryByRole('heading', { name: 'Chamados dos Alunos' })
    ).not.toBeInTheDocument();
  });

  it('nem escrevendo tipo professor direto em usuarios/{uid} pelo cliente', async () => {
    // As rules da v0.2.0 ainda deixam o cliente gravar o próprio `tipo`. A
    // segunda fonte (`autorizados`) é o que desarma isso do lado do app; a
    // task 03 fecha o lado do servidor.
    __semearColecao('usuarios', [
      { id: 'uid-ana', uid: 'uid-ana', nome: 'Ana Souza', email: 'ana@senai.br', tipo: 'professor' },
    ]);
    __definirUsuarioAtual(ANA);
    irPara('/professor');

    await montarApp();

    expect(
      screen.queryByRole('heading', { name: 'Chamados dos Alunos' })
    ).not.toBeInTheDocument();
  });

  it('limpa resquícios da sessão antiga quando não há usuário autenticado', async () => {
    localStorage.setItem('usuarioLogado', JSON.stringify({ nome: 'Ana', tipo: 'aluno' }));

    await montarApp();

    // Nenhuma rota protegida abre com base nesse resquício.
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });
});

describe('App — proteção de rota por papel (AC-AUTH-09)', () => {
  it('/aluno abre a tela do aluno para quem é aluno', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/aluno');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });

  it('/professor abre a tela do professor para quem é professor nas duas fontes', async () => {
    semearProfessorDeVerdade();
    __definirUsuarioAtual(CARLOS);
    irPara('/professor');

    await montarApp();

    expect(
      await screen.findByRole('heading', { name: 'Chamados dos Alunos' })
    ).toBeInTheDocument();
  });

  it('/aluno manda o professor para a tela dele, em vez de cair no login', async () => {
    // Era: caía no Login. Cair no login para quem está autenticado é
    // exatamente a piscada que o AC-AUTH-09 proíbe.
    semearProfessorDeVerdade();
    __definirUsuarioAtual(CARLOS);
    irPara('/aluno');

    await montarApp();

    expect(
      await screen.findByRole('heading', { name: 'Chamados dos Alunos' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^login$/i })).not.toBeInTheDocument();
  });

  it('/professor manda o aluno para a tela dele, em vez de cair no login', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/professor');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^login$/i })).not.toBeInTheDocument();
  });

  it('/aluno sem sessão nenhuma volta para a raiz, no login', async () => {
    irPara('/aluno');

    await montarApp();

    expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
  });

  it('/cadastro abre a tela de cadastro', async () => {
    irPara('/cadastro');

    await montarApp();

    expect(screen.getByRole('heading', { name: /cadastro/i })).toBeInTheDocument();
  });
});

describe('App — login social agora existe na interface (AC-AUTH-03, AC-AUTH-04)', () => {
  // A task 00 fixou aqui que o OAuth da v0.1.0 era código morto: o `App`
  // montava os provedores e passava `handleLoginGoogle`/`handleLoginGithub`
  // como props, e o `Login` ignorava as duas — não havia botão em lugar
  // nenhum da interface. Era a razão de o AC-AUTH-03 e o AC-AUTH-04
  // continuarem em aberto. Cada um daqueles testes está abaixo, invertido.

  it('existe botão de login com Google na tela de login', async () => {
    await montarApp();

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });

  it('existe botão de login com GitHub na tela de login', async () => {
    await montarApp();

    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
  });

  it('a tela de login tem três entradas: e-mail e senha, Google e GitHub', async () => {
    await montarApp();

    const botoes = screen.getAllByRole('button');
    expect(botoes).toHaveLength(3);
    expect(botoes[0]).toHaveAttribute('type', 'submit');
  });

  it('com o popup pronto para responder, o clique leva a uma sessão de verdade', async () => {
    // Era: "nada na tela o aciona; o caminho não existe".
    __definirUsuarioDoPopup(ANA);
    irPara('/');

    await montarApp();
    screen.getByRole('button', { name: /google/i }).click();

    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });
});

describe('App — sair de ponta a ponta (AC-AUTH-08, AC-SESSAO-05)', () => {
  it('o botão Sair devolve a pessoa para a raiz, no login', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/aluno');
    await montarApp();
    await screen.findByRole('heading', { name: /bem-vindo/i });

    screen.getByRole('button', { name: 'Sair' }).click();

    expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /bem-vindo/i })).not.toBeInTheDocument();
  });

  it('depois de sair, voltar pelo histórico não reabre a tela autenticada', async () => {
    __definirUsuarioAtual(ANA);
    irPara('/aluno');
    await montarApp();
    await screen.findByRole('heading', { name: /bem-vindo/i });

    screen.getByRole('button', { name: 'Sair' }).click();
    await screen.findByRole('heading', { name: /login/i });
    window.history.back();

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /bem-vindo/i })).not.toBeInTheDocument()
    );
  });
});
