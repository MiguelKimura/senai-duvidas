// A paleta na tela — AC-COR-03, AC-COR-04, AC-COR-05, AC-COR-06.
//
// Nove quadradinhos coloridos parecem o componente mais bobo da task, e são o
// que mais erra em acessibilidade. Um grupo de botões soltos faz o leitor de
// tela anunciar "botão, botão, botão" nove vezes, sem dizer que são
// alternativas da mesma escolha nem qual está valendo, e obriga quem navega
// por teclado a apertar Tab nove vezes para atravessar um controle só.
//
// O padrão certo é o radiogroup: um Tab entra, as setas escolhem, um Tab sai.
// É o que este arquivo exige, caso a caso.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeletorDeCor, { ROTULO_AUTOMATICA } from '../SeletorDeCor';
import { PALETA } from '../../utils/paleta';

function montar(props = {}) {
  const aoEscolher = jest.fn();
  const utils = render(<SeletorDeCor valor={null} onEscolher={aoEscolher} {...props} />);

  return { aoEscolher, ...utils };
}

function opcoes() {
  return screen.getAllByRole('radio');
}

describe('SeletorDeCor — semântica (AC-COR-06)', () => {
  it('é um radiogroup, e não nove botões soltos', () => {
    montar();

    expect(screen.getByRole('radiogroup', { name: /cor do card/i })).toBeInTheDocument();
  });

  it('oferece a cor automática de hoje mais cada cor da paleta', () => {
    montar();

    expect(opcoes()).toHaveLength(PALETA.length + 1);
    expect(screen.getByRole('radio', { name: ROTULO_AUTOMATICA })).toBeInTheDocument();
    PALETA.forEach((cor) => {
      expect(screen.getByRole('radio', { name: cor.nome })).toBeInTheDocument();
    });
  });

  it('dá nome audível a cada cor, em vez de deixar o leitor de tela mudo', () => {
    montar();

    opcoes().forEach((opcao) => expect(opcao).toHaveAccessibleName());
  });

  it('marca a automática quando o aluno ainda não escolheu nada (AC-COR-05)', () => {
    montar({ valor: null });

    expect(screen.getByRole('radio', { name: ROTULO_AUTOMATICA })).toBeChecked();
  });

  it('marca a cor escolhida, e só ela', () => {
    const escolhida = PALETA[3];
    montar({ valor: escolhida.fundo });

    expect(screen.getByRole('radio', { name: escolhida.nome })).toBeChecked();
    expect(opcoes().filter((opcao) => opcao.getAttribute('aria-checked') === 'true')).toHaveLength(
      1
    );
  });

  it('pinta cada opção com a cor que ela representa (AC-COR-03)', () => {
    montar();

    PALETA.forEach((cor) => {
      expect(screen.getByRole('radio', { name: cor.nome })).toHaveStyle({
        backgroundColor: cor.fundo,
      });
    });
  });
});

describe('SeletorDeCor — escolha (AC-COR-04)', () => {
  it('avisa quem escolheu com o valor que vai para o banco', () => {
    const { aoEscolher } = montar();
    const escolhida = PALETA[2];

    userEvent.click(screen.getByRole('radio', { name: escolhida.nome }));

    expect(aoEscolher).toHaveBeenCalledWith(escolhida.fundo);
  });

  it('avisa com null quando o aluno volta para a automática (AC-COR-05)', () => {
    const { aoEscolher } = montar({ valor: PALETA[2].fundo });

    userEvent.click(screen.getByRole('radio', { name: ROTULO_AUTOMATICA }));

    expect(aoEscolher).toHaveBeenCalledWith(null);
  });
});

describe('SeletorDeCor — teclado (AC-COR-06)', () => {
  // Tabindex rotativo: o grupo inteiro é uma parada de Tab só. Sem isto, quem
  // usa teclado aperta Tab dez vezes para atravessar um controle.
  it('deixa só a opção marcada alcançável por Tab', () => {
    montar({ valor: PALETA[1].fundo });

    const alcancaveis = opcoes().filter((opcao) => opcao.getAttribute('tabindex') === '0');
    expect(alcancaveis).toHaveLength(1);
    expect(alcancaveis[0]).toHaveAccessibleName(PALETA[1].nome);
  });

  it('a seta para a direita anda para a opção seguinte e a escolhe', () => {
    const { aoEscolher } = montar({ valor: null });

    fireEvent.keyDown(screen.getByRole('radio', { name: ROTULO_AUTOMATICA }), {
      key: 'ArrowRight',
    });

    expect(aoEscolher).toHaveBeenCalledWith(PALETA[0].fundo);
    expect(screen.getByRole('radio', { name: PALETA[0].nome })).toHaveFocus();
  });

  it('a seta para baixo anda igual à da direita', () => {
    const { aoEscolher } = montar({ valor: null });

    fireEvent.keyDown(screen.getByRole('radio', { name: ROTULO_AUTOMATICA }), {
      key: 'ArrowDown',
    });

    expect(aoEscolher).toHaveBeenCalledWith(PALETA[0].fundo);
  });

  it('a seta para a esquerda volta uma opção', () => {
    const { aoEscolher } = montar({ valor: PALETA[1].fundo });

    fireEvent.keyDown(screen.getByRole('radio', { name: PALETA[1].nome }), { key: 'ArrowLeft' });

    expect(aoEscolher).toHaveBeenCalledWith(PALETA[0].fundo);
  });

  it('dá a volta ao chegar ao fim, como manda o padrão do radiogroup', () => {
    const ultima = PALETA[PALETA.length - 1];
    const { aoEscolher } = montar({ valor: ultima.fundo });

    fireEvent.keyDown(screen.getByRole('radio', { name: ultima.nome }), { key: 'ArrowRight' });

    expect(aoEscolher).toHaveBeenCalledWith(null);
  });

  it('dá a volta para trás ao chegar ao começo', () => {
    const ultima = PALETA[PALETA.length - 1];
    const { aoEscolher } = montar({ valor: null });

    fireEvent.keyDown(screen.getByRole('radio', { name: ROTULO_AUTOMATICA }), {
      key: 'ArrowLeft',
    });

    expect(aoEscolher).toHaveBeenCalledWith(ultima.fundo);
  });

  it('Home vai para a primeira opção e End para a última', () => {
    const { aoEscolher } = montar({ valor: PALETA[3].fundo });
    const opcao = screen.getByRole('radio', { name: PALETA[3].nome });

    fireEvent.keyDown(opcao, { key: 'Home' });
    expect(aoEscolher).toHaveBeenLastCalledWith(null);

    fireEvent.keyDown(opcao, { key: 'End' });
    expect(aoEscolher).toHaveBeenLastCalledWith(PALETA[PALETA.length - 1].fundo);
  });

  it('não sequestra teclas que não são dele', () => {
    const { aoEscolher } = montar({ valor: null });

    fireEvent.keyDown(screen.getByRole('radio', { name: ROTULO_AUTOMATICA }), { key: 'Tab' });

    expect(aoEscolher).not.toHaveBeenCalled();
  });
});
