// Regressão do rodapé. É o único elemento presente em todas as rotas, então
// serve de âncora para os testes de layout das tasks seguintes.
import React from 'react';
import { screen } from '@testing-library/react';
import Footer from '../Footer';
import { renderComProvedores } from '../../test-utils';

describe('Footer', () => {
  it('exibe o crédito do desenvolvedor', () => {
    renderComProvedores(<Footer />);

    expect(screen.getByText('Desenvolvido por Miguel Kimura Brito')).toBeInTheDocument();
  });

  it('usa a marcação semântica de rodapé', () => {
    renderComProvedores(<Footer />);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
