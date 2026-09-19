// Quase todo componente desta base depende do react-router (`useNavigate`,
// `<a href>`). Renderizar sem um Router lança "useNavigate() may be used only in
// the context of a <Router>". Este helper centraliza os provedores para que
// nenhum teste precise repetir o boilerplate — e para que a task 01, ao
// introduzir o AuthContext único, tenha um único ponto a alterar.
import React from 'react';
import { screen } from '@testing-library/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { renderComProvedores } from '../index';

function Sonda() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <button type="button" onClick={() => navigate('/professor')}>
      estou em {location.pathname}
    </button>
  );
}

describe('renderComProvedores', () => {
  it('fornece o contexto de rota aos componentes', () => {
    renderComProvedores(<Sonda />);

    expect(screen.getByRole('button')).toHaveTextContent('estou em /');
  });

  it('permite iniciar em uma rota específica', () => {
    renderComProvedores(<Sonda />, { rota: '/aluno' });

    expect(screen.getByRole('button')).toHaveTextContent('estou em /aluno');
  });

  it('devolve o resultado do render do testing-library', () => {
    const resultado = renderComProvedores(<Sonda />);

    expect(typeof resultado.rerender).toBe('function');
    expect(typeof resultado.unmount).toBe('function');
  });
});
