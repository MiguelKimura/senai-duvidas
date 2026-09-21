// O visualizador de anexo — AC-IMG-10.
//
// O que ele substitui é `window.open(url, '_blank')`. Nos laboratórios do
// SENAI o bloqueador de pop-up vem ligado por política de imagem do Windows:
// o aluno clicava no olho e **nada acontecia** — sem aviso, sem janela, sem
// erro. O professor pedia o print de novo e a aula parava ali.
//
// Um diálogo dentro da própria página não depende de permissão de pop-up, e
// por isso funciona em qualquer máquina. O preço é que ele precisa ser um
// diálogo de verdade: fechar no Esc, prender o foco enquanto está aberto e
// devolvê-lo a quem o abriu — senão quem usa teclado ou leitor de tela fica
// preso atrás dele.
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Lightbox from '../Lightbox';

const URL_DO_PRINT = 'https://fake.storage/salas/s1/chamados/c1/erro.png';

describe('Lightbox — o diálogo', () => {
  it('exibe a imagem pedida, com texto alternativo', () => {
    render(<Lightbox url={URL_DO_PRINT} descricao="O VS Code não abre" onFechar={jest.fn()} />);

    const imagem = screen.getByRole('img', { name: /O VS Code não abre/ });
    expect(imagem).toHaveAttribute('src', URL_DO_PRINT);
  });

  it('é anunciado como diálogo modal', () => {
    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={jest.fn()} />);

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
  });

  it('NÃO usa window.open — é isso que o bloqueador de pop-up impedia', () => {
    const abrirJanela = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={jest.fn()} />);

    expect(abrirJanela).not.toHaveBeenCalled();
    abrirJanela.mockRestore();
  });
});

describe('Lightbox — como se fecha', () => {
  it('fecha no Esc', () => {
    const fechar = jest.fn();
    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={fechar} />);

    userEvent.type(screen.getByRole('dialog'), '{esc}');

    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('fecha no clique fora da imagem', () => {
    const fechar = jest.fn();
    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={fechar} />);

    userEvent.click(screen.getByRole('dialog'));

    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('NÃO fecha no clique sobre a própria imagem', () => {
    const fechar = jest.fn();
    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={fechar} />);

    userEvent.click(screen.getByRole('img'));

    expect(fechar).not.toHaveBeenCalled();
  });

  it('fecha pelo botão, que tem nome acessível', () => {
    const fechar = jest.fn();
    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={fechar} />);

    userEvent.click(screen.getByRole('button', { name: /fechar/i }));

    expect(fechar).toHaveBeenCalledTimes(1);
  });
});

describe('Lightbox — o foco (AC-IMG-10)', () => {
  it('leva o foco para dentro do diálogo ao abrir', () => {
    render(<Lightbox url={URL_DO_PRINT} descricao="print" onFechar={jest.fn()} />);

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement);
  });

  it('o Tab não escapa do diálogo', () => {
    render(
      <div>
        <button type="button">Atrás do diálogo</button>
        <Lightbox url={URL_DO_PRINT} descricao="print" onFechar={jest.fn()} />
      </div>
    );

    userEvent.tab();
    userEvent.tab();

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement);
  });

  it('devolve o foco ao botão que o abriu', () => {
    function Card() {
      const [aberto, setAberto] = useState(false);

      return (
        <div>
          <button type="button" onClick={() => setAberto(true)}>
            Ver imagem
          </button>
          {aberto && (
            <Lightbox url={URL_DO_PRINT} descricao="print" onFechar={() => setAberto(false)} />
          )}
        </div>
      );
    }

    render(<Card />);
    const gatilho = screen.getByRole('button', { name: 'Ver imagem' });

    userEvent.click(gatilho);
    userEvent.click(screen.getByRole('button', { name: /fechar/i }));

    expect(document.activeElement).toBe(gatilho);
  });
});

describe('Lightbox — a imagem que não carrega (AC-IMG-12)', () => {
  it('troca o ícone quebrado do navegador por uma explicação', () => {
    render(
      <Lightbox url="https://fora-do-ar.br/erro.png" descricao="print" onFechar={jest.fn()} />
    );

    screen.getByRole('img').dispatchEvent(new Event('error'));

    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
