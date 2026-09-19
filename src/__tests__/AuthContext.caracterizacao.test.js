// Caracterização do `src/AuthContext.js` — o contexto que ninguém usa.
//
// Existem TRÊS implementações de autenticação convivendo na v0.1.0:
//   1. `App.js`    — `onAuthStateChanged` + papel lido do localStorage;
//   2. `Login.js`  — `auth.onAuthStateChanged` próprio, com navegação;
//   3. este arquivo — um `AuthProvider`/`useAuth` completo e **órfão**.
//
// O terceiro não é importado por nenhum componente. Está aqui porque alguém
// começou a unificação e parou no meio. A task 01 vai ficar com um único
// contexto; o teste registra o que já existe pronto para ser aproveitado, e
// prova que hoje ele está fora do caminho de execução da aplicação.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import { AuthProvider, useAuth } from '../AuthContext';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** Componente sonda: mostra o que o contexto entrega. */
function Sonda() {
  const { user, loading, logout } = useAuth();

  return (
    <div>
      <p data-testid="carregando">{String(loading)}</p>
      <p data-testid="email">{user ? user.email : 'sem sessão'}</p>
      <button onClick={logout}>Sair</button>
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
});

describe('AuthContext — comportamento do provedor órfão', () => {
  it('entrega o usuário autenticado para quem consome o contexto', async () => {
    __definirUsuarioAtual(ANA);

    montarComProvedor();

    await waitFor(() =>
      expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br')
    );
  });

  it('entrega null quando não há sessão', async () => {
    montarComProvedor();

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('sem sessão'));
  });

  it('sai do estado de carregamento assim que o auth responde', async () => {
    montarComProvedor();

    await waitFor(() => expect(screen.getByTestId('carregando')).toHaveTextContent('false'));
  });

  it('o logout encerra a sessão e limpa o usuário do contexto', async () => {
    __definirUsuarioAtual(ANA);
    montarComProvedor();
    await waitFor(() =>
      expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br')
    );

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
    jest.restoreAllMocks();
  });
});

describe('AuthContext — está fora do caminho de execução', () => {
  it('nenhum componente da aplicação importa este módulo', () => {
    const fs = require('fs');
    const path = require('path');

    const raiz = path.join(__dirname, '..');
    const fontes = [];

    (function varrer(diretorio) {
      fs.readdirSync(diretorio, { withFileTypes: true }).forEach((entrada) => {
        const caminho = path.join(diretorio, entrada.name);

        // Os próprios testes importam o módulo de propósito; não contam.
        if (entrada.isDirectory()) {
          if (!['__tests__', '__mocks__', 'test-utils'].includes(entrada.name)) {
            varrer(caminho);
          }
          return;
        }

        if (/\.jsx?$/.test(entrada.name) && entrada.name !== 'AuthContext.js') {
          fontes.push(caminho);
        }
      });
    })(raiz);

    const importadores = fontes.filter((caminho) =>
      /from\s+['"][^'"]*AuthContext['"]/.test(fs.readFileSync(caminho, 'utf8'))
    );

    expect(importadores).toEqual([]);
  });
});
