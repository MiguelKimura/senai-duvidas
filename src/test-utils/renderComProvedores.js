import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

// Ponto único de montagem dos provedores nos testes.
//
// A task 00 deixou este arquivo com um TODO explícito: quando a task 01
// unificasse as três implementações de autenticação num provider só, ele
// deveria ser montado aqui — assim nenhum teste de caracterização precisaria
// mudar de forma para continuar valendo. É o que este import faz.
//
// A ordem importa: o `AuthProvider` fica **dentro** do roteador, porque quem
// consome o contexto também navega, e `useNavigate` exige um Router acima.

/**
 * Renderiza `elemento` dentro dos provedores da aplicação.
 *
 * @param {React.ReactElement} elemento componente sob teste.
 * @param {{rota?: string}} opcoes `rota` define a URL inicial do MemoryRouter.
 * @returns o resultado de `render` do @testing-library/react.
 */
export function renderComProvedores(elemento, { rota = '/', ...opcoesRender } = {}) {
  function Provedores({ children }) {
    return (
      <MemoryRouter initialEntries={[rota]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );
  }

  return render(elemento, { wrapper: Provedores, ...opcoesRender });
}
