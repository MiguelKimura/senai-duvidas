// A setinha cinza — AC-COR-01, AC-COR-02, AC-COR-06, AC-COR-09.
//
// O pedido do cliente é sobre o que o painel **não** faz: "o menu de abrir um
// chamado é bem simples... eu queria uma setinha em cinza que, quando aberta,
// mostrasse opções de cor". O aluno com pressa abre o modal, escreve e envia,
// e não deve nem reparar que existem opções. Se o painel abrir por padrão ou
// se a setinha chamar atenção, a feature falhou — por isso o primeiro caso
// deste arquivo é "começa fechado", e não "abre quando clicam nele".
//
// A implementação é `<details>`/`<summary>` nativo. Ele já traz foco, teclado,
// estado e o triângulo; o que se ganha reimplementando isso à mão é a chance
// de errar em algum deles. O `aria-expanded` é declarado por cima do nativo
// porque o AC-COR-06 o exige explicitamente e porque `<summary>` ainda é
// anunciado de formas diferentes pelos leitores de tela em uso.
const fs = require('fs');
const path = require('path');

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PainelAvancado, { ROTULO_DO_PAINEL } from '../PainelAvancado';
import { PALETA } from '../../utils/paleta';

const CSS_DO_PAINEL = fs.readFileSync(
  path.join(__dirname, '..', '..', 'styles', 'PainelAvancado.css'),
  'utf8'
);

const COR_AUTOMATICA_DE_EXEMPLO = 'hsl(210, 70%, 80%)';

function montar(props = {}) {
  const aoMudarCor = jest.fn();
  const utils = render(
    <PainelAvancado
      cor={null}
      corAutomatica={COR_AUTOMATICA_DE_EXEMPLO}
      onCorMudou={aoMudarCor}
      descricao=""
      autor="Ana Souza"
      {...props}
    />
  );

  return { aoMudarCor, ...utils };
}

const detalhes = () => document.querySelector('details.painel-avancado');
const setinha = () => document.querySelector('.painel-avancado summary');

describe('PainelAvancado — fechado por padrão (AC-COR-01)', () => {
  it('não nasce aberto: quem tem pressa não vê opção nenhuma', () => {
    montar();

    expect(detalhes()).not.toHaveAttribute('open');
    expect(setinha()).toHaveAttribute('aria-expanded', 'false');
  });

  it('diz em português o que está escondido ali (AC-COR-06)', () => {
    montar();

    expect(setinha()).toHaveTextContent(ROTULO_DO_PAINEL);
  });

  it('é uma setinha discreta, e não mais um botão vermelho no modal', () => {
    montar();

    // A marca do projeto é o vermelho dos botões de ação. A setinha não é uma
    // ação: ela revela. Se ela virar botão, ela compete com "Concluir".
    expect(setinha().tagName).toBe('SUMMARY');
    expect(CSS_DO_PAINEL).toMatch(/--cor-texto-discreto|gray/);
  });
});

describe('PainelAvancado — abrir e fechar (AC-COR-02, AC-COR-06)', () => {
  it('abre ao clique e atualiza o aria-expanded', () => {
    montar();

    userEvent.click(setinha());

    expect(detalhes()).toHaveAttribute('open');
    expect(setinha()).toHaveAttribute('aria-expanded', 'true');
  });

  it('fecha ao clicar de novo', () => {
    montar();

    userEvent.click(setinha());
    userEvent.click(setinha());

    expect(detalhes()).not.toHaveAttribute('open');
    expect(setinha()).toHaveAttribute('aria-expanded', 'false');
  });

  it('abre com Enter, para quem não usa mouse', () => {
    montar();

    userEvent.type(setinha(), '{enter}');

    expect(setinha()).toHaveAttribute('aria-expanded', 'true');
  });

  it('é alcançável por Tab', () => {
    montar();

    userEvent.tab();

    expect(setinha()).toHaveFocus();
  });
});

describe('PainelAvancado — animação (AC-COR-02)', () => {
  it('anima a abertura com a duração que já é token do projeto', () => {
    // Duração inventada aqui seria uma quarta duração no projeto, e a task 08
    // teria de caçá-la. O token existe exatamente para isso.
    expect(CSS_DO_PAINEL).toMatch(/transition:[^;]*var\(--duracao-transicao\)/);
  });

  it('não anima nada para quem pediu menos movimento', () => {
    expect(CSS_DO_PAINEL).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);

    const [, blocoReduzido] = CSS_DO_PAINEL.split(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(blocoReduzido).toMatch(/transition:\s*none/);
  });
});

describe('PainelAvancado — o que ele esconde (AC-COR-03, AC-COR-04)', () => {
  it('guarda a paleta de cores', () => {
    montar();

    expect(screen.getByRole('radiogroup', { name: /cor do card/i })).toBeInTheDocument();
  });

  it('entrega a cor escolhida a quem guarda o estado do modal', () => {
    const { aoMudarCor } = montar();

    userEvent.click(screen.getByRole('radio', { name: PALETA[4].nome }));

    expect(aoMudarCor).toHaveBeenCalledWith(PALETA[4].fundo);
  });

  it('explica o markdown aceito, em vez de esperar que o aluno adivinhe', () => {
    montar();

    expect(screen.getByText(/\*\*negrito\*\*/)).toBeInTheDocument();
  });
});

describe('PainelAvancado — preview ao vivo (AC-COR-09)', () => {
  const previa = () => screen.getByTestId('previa-do-card');

  it('mostra a descrição com o markdown já aplicado', () => {
    montar({ descricao: 'o **cabo** está solto' });

    // Escopado ao texto: o nome do autor também é um `<strong>` no card.
    expect(previa().querySelector('.texto-markdown strong')).toHaveTextContent('cabo');
  });

  it('pinta a prévia com a cor escolhida', () => {
    montar({ cor: PALETA[5].fundo, descricao: 'teste' });

    expect(previa()).toHaveStyle({ backgroundColor: PALETA[5].fundo });
  });

  it('pinta a prévia com a cor automática enquanto o aluno não escolhe (AC-COR-05)', () => {
    montar({ cor: null, descricao: 'teste' });

    expect(previa().style.backgroundColor).toBe(COR_AUTOMATICA_DE_EXEMPLO);
  });

  it('usa a cor de texto da paleta, que é a que garante o contraste (AC-COR-03)', () => {
    montar({ cor: PALETA[5].fundo, descricao: 'teste' });

    expect(previa()).toHaveStyle({ color: PALETA[5].texto });
  });

  it('mostra o nome do autor, como o card mostra', () => {
    montar({ descricao: 'teste', autor: 'Ana Souza' });

    expect(previa()).toHaveTextContent('Ana Souza');
  });

  it('não rende script nenhum na prévia (AC-COR-08)', () => {
    montar({ descricao: '<img src=x onerror=alert(1)>' });

    expect(previa().querySelector('img')).toBeNull();
  });

  it('avisa que a prévia está vazia em vez de mostrar um card fantasma', () => {
    montar({ descricao: '   ' });

    expect(previa()).toHaveTextContent(/nada escrito ainda/i);
  });
});
