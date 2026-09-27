// A rolagem da conversa — AC-CHAT-05.
//
// O chat da v0.7.0 não rolava. Mensagem nova entrava embaixo da dobra e ficava
// lá: quem estava conversando precisava arrastar a barra a cada resposta.
//
// A correção ingênua — "rolar para o fim sempre que chegar mensagem" — é pior
// do que o problema. Quem subiu para reler o que o professor explicou é
// arrancado dali toda vez que alguém digita. Por isso a regra tem duas metades,
// e as duas estão aqui: rola sozinho **se** a pessoa já estava no fim; se não
// estava, avisa que há mensagem nova e deixa a rolagem onde ela está.
//
// jsdom não faz layout: `scrollHeight` e `clientHeight` nascem zerados e nada
// os move. As dimensões abaixo são fixadas à mão, que é a única forma de
// perguntar "a pessoa está no fim?" num ambiente sem altura.
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRolagemAutomatica } from '../useRolagemAutomatica';

const ALTURA_VISIVEL = 400;
const ALTURA_TOTAL = 2000;

/** Dá altura a um elemento que o jsdom insiste em tratar como vazio. */
function darDimensoes(elemento, { total = ALTURA_TOTAL, visivel = ALTURA_VISIVEL } = {}) {
  Object.defineProperty(elemento, 'scrollHeight', { value: total, configurable: true });
  Object.defineProperty(elemento, 'clientHeight', { value: visivel, configurable: true });
}

/**
 * Uma conversa de mentira, com o hook ligado no painel rolável.
 *
 * As alturas são dadas no **callback de ref**, e não depois do `render`, porque
 * é aí que o navegador de verdade já teria feito o layout: a ordem é anexar o
 * nó, rodar os callbacks de ref, rodar os efeitos de layout. Fixá-las depois
 * faria a conversa abrir num painel de altura zero, que é uma situação que não
 * existe em nenhum navegador.
 */
function Painel({ chave }) {
  const { referencia, temNovas, irParaOFim } = useRolagemAutomatica(chave);

  const ligar = (elemento) => {
    if (elemento && elemento.scrollHeight === 0) darDimensoes(elemento);
    referencia.current = elemento;
  };

  return (
    <div>
      <div data-testid="painel" ref={ligar} />
      {temNovas && (
        <button type="button" onClick={irParaOFim}>
          novas mensagens
        </button>
      )}
    </div>
  );
}

function painel() {
  return screen.getByTestId('painel');
}

/** Põe a rolagem no fim e avisa o hook, como o navegador faria. */
function rolarAteOFim() {
  const elemento = painel();
  elemento.scrollTop = ALTURA_TOTAL - ALTURA_VISIVEL;
  fireEvent.scroll(elemento);
}

/** Sobe a rolagem para reler o que passou. */
function rolarParaCima() {
  const elemento = painel();
  elemento.scrollTop = 200;
  fireEvent.scroll(elemento);
}

function botaoDeNovas() {
  return screen.queryByRole('button', { name: /novas mensagens/i });
}

describe('useRolagemAutomatica — a pessoa está no fim', () => {
  it('rola para a última mensagem quando a conversa abre', () => {
    render(<Painel chave="m1" />);

    expect(painel().scrollTop).toBe(ALTURA_TOTAL);
  });

  it('acompanha a mensagem nova sem pedir nada a ninguém', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarAteOFim();

    rerender(<Painel chave="m2" />);

    expect(painel().scrollTop).toBe(ALTURA_TOTAL);
  });

  it('não mostra o botão de novas mensagens para quem já está vendo', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarAteOFim();

    rerender(<Painel chave="m2" />);

    expect(botaoDeNovas()).toBeNull();
  });
});

describe('useRolagemAutomatica — a pessoa subiu para reler (AC-CHAT-05)', () => {
  it('NÃO arranca a rolagem de quem está lendo o que passou', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarParaCima();

    rerender(<Painel chave="m2" />);

    expect(painel().scrollTop).toBe(200);
  });

  it('avisa que chegou mensagem nova', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarParaCima();

    rerender(<Painel chave="m2" />);

    expect(botaoDeNovas()).toBeInTheDocument();
  });

  it('o aviso leva ao fim da conversa quando a pessoa aceita', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarParaCima();
    rerender(<Painel chave="m2" />);

    fireEvent.click(botaoDeNovas());

    expect(painel().scrollTop).toBe(ALTURA_TOTAL);
    expect(botaoDeNovas()).toBeNull();
  });

  it('o aviso some sozinho quando a pessoa rola até o fim por conta própria', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarParaCima();
    rerender(<Painel chave="m2" />);
    expect(botaoDeNovas()).toBeInTheDocument();

    act(() => rolarAteOFim());

    expect(botaoDeNovas()).toBeNull();
  });

  it('continua avisando enquanto chegam mensagens e a pessoa segue lendo acima', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarParaCima();

    rerender(<Painel chave="m2" />);
    rerender(<Painel chave="m3" />);

    expect(botaoDeNovas()).toBeInTheDocument();
    expect(painel().scrollTop).toBe(200);
  });
});

describe('useRolagemAutomatica — a tolerância do "está no fim"', () => {
  it('trata "quase no fim" como no fim: um pixel de sobra não conta', () => {
    const { rerender } = render(<Painel chave="m1" />);
    painel().scrollTop = ALTURA_TOTAL - ALTURA_VISIVEL - 8;
    fireEvent.scroll(painel());

    rerender(<Painel chave="m2" />);

    expect(botaoDeNovas()).toBeNull();
  });

  it('meia tela acima já é "subiu para reler"', () => {
    const { rerender } = render(<Painel chave="m1" />);
    painel().scrollTop = ALTURA_TOTAL - ALTURA_VISIVEL - 200;
    fireEvent.scroll(painel());

    rerender(<Painel chave="m2" />);

    expect(botaoDeNovas()).toBeInTheDocument();
  });
});

describe('useRolagemAutomatica — robustez', () => {
  it('não quebra antes de o painel existir no DOM', () => {
    expect(() => render(<Painel chave={null} />)).not.toThrow();
  });

  it('a mesma chave duas vezes não conta como mensagem nova', () => {
    const { rerender } = render(<Painel chave="m1" />);
    rolarParaCima();

    rerender(<Painel chave="m1" />);

    expect(botaoDeNovas()).toBeNull();
  });
});
