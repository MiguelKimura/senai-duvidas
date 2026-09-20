import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Ponto único de montagem dos provedores nos testes.
//
// Hoje só o react-router é necessário. A task 01 vai introduzir um AuthContext
// único (substituindo as três implementações concorrentes de autenticação) e
// deve envolvê-lo aqui — assim nenhum teste de caracterização precisa mudar
// para continuar valendo.

/**
 * Renderiza `elemento` dentro dos provedores da aplicação.
 *
 * @param {React.ReactElement} elemento componente sob teste.
 * @param {{rota?: string}} opcoes `rota` define a URL inicial do MemoryRouter.
 * @returns o resultado de `render` do @testing-library/react.
 */
export function renderComProvedores(elemento, { rota = '/', ...opcoesRender } = {}) {
  function Provedores({ children }) {
    return <MemoryRouter initialEntries={[rota]}>{children}</MemoryRouter>;
  }

  return render(elemento, { wrapper: Provedores, ...opcoesRender });
}
