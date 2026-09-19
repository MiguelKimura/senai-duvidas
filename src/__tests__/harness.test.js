// Teste de fumaça do harness. Existe para provar que o Jest do react-scripts, o
// JSDOM e os matchers do jest-dom estão carregados — é o degrau mínimo que
// permite escrever, a partir daqui, todos os outros testes em red-green-refactor.
import React from 'react';
import { render, screen } from '@testing-library/react';

describe('harness de testes', () => {
  it('renderiza um componente React em JSDOM', () => {
    render(<p>fundação</p>);

    expect(screen.getByText('fundação')).toBeInTheDocument();
  });

  it('carrega os matchers do @testing-library/jest-dom', () => {
    expect(typeof expect(document.body).toBeInTheDocument).toBe('function');
  });
});
