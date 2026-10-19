// O card de tamanho padrão da v1.1.0: data antes do texto, descrição longa
// recolhida com "Ler mais", e o olho no lugar da miniatura.
import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import CardDoChamado from '../CardDoChamado';
import { renderComProvedores, fabricaChamado } from '../../test-utils';
import { LIMITE_DO_RESUMO, descricaoEhLonga } from '../../utils/cardDoChamado';

beforeEach(() => __resetarFirestore());

function renderizarCard(sobrescritas = {}) {
  return renderComProvedores(
    <CardDoChamado chamado={fabricaChamado(sobrescritas)} indice={0} />
  );
}

describe('descricaoEhLonga', () => {
  it('é longa acima do limite de caracteres', () => {
    expect(descricaoEhLonga('a'.repeat(LIMITE_DO_RESUMO))).toBe(false);
    expect(descricaoEhLonga('a'.repeat(LIMITE_DO_RESUMO + 1))).toBe(true);
  });

  it('é longa com muitas linhas, mesmo curtas', () => {
    expect(descricaoEhLonga('1\n2\n3\n4')).toBe(false);
    expect(descricaoEhLonga('1\n2\n3\n4\n5')).toBe(true);
  });

  it('não quebra com descrição ausente', () => {
    expect(descricaoEhLonga(undefined)).toBe(false);
  });
});

describe('o card de um chamado (v1.1.0)', () => {
  it('mostra data e hora abaixo do nome, antes do texto', () => {
    renderizarCard({ descricao: 'O torno travou.' });

    const nome = document.querySelector('.user-name');
    const horario = document.querySelector('.card-horario');
    const texto = screen.getByText('O torno travou.');

    // eslint-disable-next-line no-bitwise
    expect(
      nome.compareDocumentPosition(horario) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // eslint-disable-next-line no-bitwise
    expect(
      horario.compareDocumentPosition(texto) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(horario).toHaveTextContent(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('descrição curta não tem "Ler mais"', () => {
    renderizarCard({ descricao: 'Curta.' });

    expect(screen.queryByRole('button', { name: 'Ler mais' })).toBeNull();
  });

  it('descrição longa entra recolhida, e "Ler mais" a abre', () => {
    renderizarCard({ descricao: 'x'.repeat(LIMITE_DO_RESUMO + 50) });
    const botao = screen.getByRole('button', { name: 'Ler mais' });

    expect(document.querySelector('.card-descricao--recolhida')).not.toBeNull();
    expect(botao).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(botao);

    expect(document.querySelector('.card-descricao--recolhida')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ler menos' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('com anexo, mostra o olho e não a imagem', () => {
    renderizarCard({ imagem: 'https://exemplo.br/print.png' });

    expect(screen.getByTitle('Ver imagem')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('o olho do anexo abre um pop-up no centro da tela (v1.1.0)', () => {
  it('o visualizador sai do card e vai direto para o <body>', () => {
    renderComProvedores(
      <CardDoChamado
        chamado={fabricaChamado({ imagem: 'https://exemplo.br/print.png' })}
        indice={0}
      />
    );

    fireEvent.click(screen.getByTitle('Ver imagem'));

    // Dentro do card, o `transform` da animação de entrada prendia o
    // `position: fixed` ao card, e o "pop-up" abria espremido nele.
    expect(screen.getByRole('dialog').parentElement).toBe(document.body);
  });

  it('a imagem guardada no banco só é lida no clique, e aparece no visualizador', async () => {
    __semearColecao('salas/sala-3b/imagens', [
      { id: 'c9', dados: 'data:image/png;base64,QUJD' },
    ]);

    renderComProvedores(
      <CardDoChamado
        salaId="sala-3b"
        chamado={fabricaChamado({ id: 'c9', anexo: { origem: 'banco', id: 'c9' } })}
        indice={0}
      />
    );

    expect(screen.queryByRole('img')).toBeNull();

    fireEvent.click(screen.getByTitle('Ver imagem'));

    expect(await within(screen.getByRole('dialog')).findByRole('img')).toHaveAttribute(
      'src',
      'data:image/png;base64,QUJD'
    );
  });
});
