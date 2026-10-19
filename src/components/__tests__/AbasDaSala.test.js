import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AbasDaSala from '../AbasDaSala';

function montar(abas) {
  return render(<AbasDaSala rotulo="Seções" abas={abas} />);
}

const ABAS = [
  { id: 'um', titulo: 'Chamados', conteudo: <p>fila</p> },
  { id: 'dois', titulo: 'Conquistas', conteudo: <p>vitrine</p> },
  false,
];

describe('AbasDaSala', () => {
  it('abre na primeira aba e ignora as abas falsas', () => {
    montar(ABAS);

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Chamados' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('fila');
    expect(screen.queryByText('vitrine')).toBeNull();
  });

  it('troca de painel no clique', () => {
    montar(ABAS);

    fireEvent.click(screen.getByRole('tab', { name: 'Conquistas' }));

    expect(screen.getByRole('tabpanel')).toHaveTextContent('vitrine');
    expect(screen.queryByText('fila')).toBeNull();
  });

  it('as setas trocam de aba e levam o foco junto', () => {
    montar(ABAS);

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Chamados' }), { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Conquistas' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('vitrine');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Conquistas' }), { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Chamados' })).toHaveFocus();
  });

  it('só a aba ativa entra na ordem de tabulação', () => {
    montar(ABAS);

    expect(screen.getByRole('tab', { name: 'Chamados' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Conquistas' })).toHaveAttribute('tabindex', '-1');
  });
});
