// A entrada escalonada e a saída dos cards — AC-ANIM-02, AC-ANIM-05.
//
// O movimento dos cards é a única animação do projeto que depende de uma
// **ponte**: o CSS sabe escalonar, mas só a partir de um número que o React
// escreve inline (`--indice-na-lista`). Os dois lados já tinham teste em
// separado — `animacoes.test.js` prova que a classe existe e que ela lê a
// variável, e `exclusaoDeChamado.test.js` prova que a exclusão espera a
// duração da saída antes de gravar —, e nenhum dos dois prova que a ponte está
// de pé.
//
// É o tipo de coisa que quebra em silêncio e sem sintoma de teste: basta
// alguém renomear a prop `indice`, ou a tela parar de passá-la, para que todo
// card receba atraso zero. A fila continua funcionando, os 1600 testes
// continuam verdes, e o que se perde é justamente o que o cliente pediu —
// "melhorar as animações do site (em geral)".
import React from 'react';
import { render, screen } from '@testing-library/react';
import CardDoChamado from '../CardDoChamado';
import { classesDoCard } from '../../utils/cardDoChamado';

const CHAMADO = {
  id: 'chamado-1',
  autorUid: 'uid-ana',
  autorNome: 'Ana Souza',
  descricao: 'O Visual Studio não abre no computador 12.',
  horario: new Date('2026-09-23T11:50:00.000Z'),
  cor: '#d8e5ff',
};

/** O card na tela, achado pelo texto que ele mostra. */
function card() {
  return screen.getByText(CHAMADO.descricao).closest('.problema-card');
}

describe('classesDoCard (AC-ANIM-02)', () => {
  it('todo card entra com a classe de entrada da camada compartilhada', () => {
    expect(classesDoCard()).toContain('entra-na-lista');
  });

  it('o card que está saindo ganha a de saída, sem perder a de entrada', () => {
    // As duas juntas, e não uma trocada pela outra: a de entrada é quem
    // declara o `animation-fill-mode: both`, e tirá-la faria o card voltar ao
    // estado inicial por um quadro antes de sair — um pisca-pisca.
    expect(classesDoCard({ saindo: true })).toContain('sai-da-lista');
    expect(classesDoCard({ saindo: true })).toContain('entra-na-lista');
  });

  it('as classes vêm de animacoes.css, e não de uma folha por componente', () => {
    // Um `@keyframes` declarado na folha do card escaparia do bloco global de
    // `prefers-reduced-motion` — e a preferência da pessoa deixaria de valer
    // exatamente na parte da tela que mais se mexe (AC-ANIM-05).
    const animacoes = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'styles', 'animacoes.css'),
      'utf8'
    );

    expect(animacoes).toMatch(/\.entra-na-lista\s*\{/);
    expect(animacoes).toMatch(/\.sai-da-lista\s*\{/);
  });
});

describe('a ponte entre a lista e o CSS (AC-ANIM-02)', () => {
  it('o card escreve a própria posição na variável que o CSS escalona', () => {
    render(<CardDoChamado chamado={CHAMADO} indice={4} />);

    expect(card()).toHaveStyle({ '--indice-na-lista': '4' });
  });

  it('o primeiro card da fila entra sem atraso nenhum', () => {
    render(<CardDoChamado chamado={CHAMADO} indice={0} />);

    expect(card()).toHaveStyle({ '--indice-na-lista': '0' });
  });

  it('o card em saída leva as duas classes até o DOM', () => {
    render(<CardDoChamado chamado={CHAMADO} indice={1} saindo />);

    expect(card()).toHaveClass('entra-na-lista');
    expect(card()).toHaveClass('sai-da-lista');
  });

  it('o card em repouso não leva a de saída', () => {
    render(<CardDoChamado chamado={CHAMADO} indice={1} />);

    expect(card()).not.toHaveClass('sai-da-lista');
  });

  // O teto do escalonamento vive no CSS, e é o que impede o card 200 de
  // esperar 200 × 40ms — quase oito segundos de tela quase vazia. O olho
  // deixa de distinguir os degraus por volta do sexto; do sétimo em diante o
  // escalonamento só atrasa.
  it('o CSS limita o degrau, para que a fila de 200 não espere oito segundos', () => {
    const animacoes = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'styles', 'animacoes.css'),
      'utf8'
    );

    expect(animacoes).toMatch(/animation-delay:\s*calc\(\s*min\(var\(--indice-na-lista/);
  });
});
