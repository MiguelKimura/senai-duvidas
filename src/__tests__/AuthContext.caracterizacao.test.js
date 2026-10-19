// Caracterização do contexto de autenticação — da versão órfã à única.
//
// A task 00 registrou aqui que existiam TRÊS implementações de autenticação
// convivendo na v0.1.0:
//   1. `App.js`    — `onAuthStateChanged` + papel lido do localStorage;
//   2. `Login.js`  — `auth.onAuthStateChanged` próprio, com navegação;
//   3. `src/AuthContext.js` — um `AuthProvider`/`useAuth` completo e **órfão**,
//      que nenhum componente importava.
//
// A task 01 ficou com uma só, em `src/contexts/AuthContext.jsx`. Este arquivo
// continua valendo: os mesmos comportamentos que o provider órfão já entregava
// são cobrados do provider novo, e o teste que provava que o órfão estava fora
// do caminho de execução virou o teste que prova que o órfão **não existe
// mais** e que o novo está no caminho de todo mundo.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import { __resetarFirestore } from 'firebase/firestore';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const ANA = {
  uid: 'uid-ana',
  email: 'ana@senai.br',
  displayName: 'Ana Souza',
  providerData: [{ providerId: 'google.com' }],
};

/** Componente sonda: mostra o que o contexto entrega. */
function Sonda() {
  const { usuario, carregando, sair } = useAuth();

  return (
    <div>
      <p data-testid="carregando">{String(carregando)}</p>
      <p data-testid="email">{usuario ? usuario.email : 'sem sessão'}</p>
      <button onClick={sair}>Sair</button>
    </div>
  );
}

function montarComProvedor() {
  return render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>
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

describe('AuthContext — comportamento que o provider órfão já entregava', () => {
  it('entrega o usuário autenticado para quem consome o contexto', async () => {
    __definirUsuarioAtual(ANA);

    montarComProvedor();

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br'));
  });

  it('entrega null quando não há sessão', async () => {
    montarComProvedor();

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('sem sessão'));
  });

  it('sai do estado de carregamento assim que o papel está resolvido', async () => {
    // Mudou de propósito: o órfão saía do carregamento quando o **auth**
    // respondia. O provider novo espera também o papel, porque sair antes
    // disso é o que permitia tratar alguém como aluno antes de saber
    // (AC-AUTH-09).
    __definirUsuarioAtual(ANA);

    montarComProvedor();

    await waitFor(() => expect(screen.getByTestId('carregando')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br');
  });

  it('o logout encerra a sessão e limpa o usuário do contexto', async () => {
    __definirUsuarioAtual(ANA);
    montarComProvedor();
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br'));

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('sem sessão'));
  });

  it('cancela o listener ao desmontar', async () => {
    const auth = require('firebase/auth');
    const cancelar = jest.fn();
    jest.spyOn(auth, 'onAuthStateChanged').mockReturnValue(cancelar);

    const { unmount } = montarComProvedor();
    unmount();

    expect(cancelar).toHaveBeenCalled();
  });
});

describe('AuthContext — de órfão a único caminho de execução', () => {
  const fs = require('fs');
  const path = require('path');
  const raiz = path.join(__dirname, '..');

  /** Todos os módulos de produção de `src/` (sem testes, mocks e helpers). */
  function fontesDeProducao() {
    const fontes = [];

    (function varrer(diretorio) {
      fs.readdirSync(diretorio, { withFileTypes: true }).forEach((entrada) => {
        const caminho = path.join(diretorio, entrada.name);

        if (entrada.isDirectory()) {
          if (!['__tests__', '__mocks__', 'test-utils'].includes(entrada.name)) {
            varrer(caminho);
          }
          return;
        }

        if (/\.jsx?$/.test(entrada.name)) fontes.push(caminho);
      });
    })(raiz);

    return fontes;
  }

  it('o provider órfão de src/AuthContext.js não existe mais', () => {
    // Era: "nenhum componente da aplicação importa este módulo". Manter um
    // provider completo fora do caminho de execução é convite a alguém
    // importar o errado.
    expect(fs.existsSync(path.join(raiz, 'AuthContext.js'))).toBe(false);
  });

  it('ninguém importa o caminho antigo', () => {
    const importadores = fontesDeProducao().filter((caminho) =>
      /from\s+['"][^'"]*\.\.?\/AuthContext['"]/.test(fs.readFileSync(caminho, 'utf8'))
    );

    expect(importadores).toEqual([]);
  });

  it('o provider novo está no caminho de execução: o App o monta', () => {
    const app = fs.readFileSync(path.join(raiz, 'App.js'), 'utf8');

    expect(app).toMatch(/contexts\/AuthContext/);
    expect(app).toMatch(/<AuthProvider>/);
  });
});
