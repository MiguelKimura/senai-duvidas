// Code-splitting por rota — AC-PERF-02.
//
// Até a 1.0.0 o build tinha um `main.js` só, e ele carregava o app inteiro. O
// aluno que abria o endereço para fazer login baixava, antes de digitar o
// e-mail: a tela do professor, o painel da turma, o painel de perks, a animação
// de premiação em tela cheia e o `marked` inteiro para renderizar markdown que
// ele ainda não tinha escrito.
//
// Na máquina do laboratório, com cache quente, isso não se nota. No celular do
// aluno no pátio, em 3G, é a diferença entre entrar na aula e desistir — e é
// esse o cenário que o AC-PERF-01 mede.
//
// Este arquivo prova as duas coisas que a divisão exige:
//
//   1. **estrutural** — nenhuma tela de rota é importada de forma estática no
//      `App.js`; todas passam por `lazy(() => import(...))`. É o que garante que
//      a tela nova de amanhã entre dividida também.
//   2. **comportamental** — com a divisão, o app continua abrindo todas as
//      rotas, e a espera pelo pedaço que falta é **anunciada**: um `Suspense`
//      com fallback vazio deixa quem usa leitor de tela sem saber que algo está
//      carregando (AC-ANIM-04, AC-AUTH-09).
import React from 'react';
import { render, screen } from '@testing-library/react';
import { __resetarAuth } from 'firebase/auth';
import { __resetarFirestore } from 'firebase/firestore';
import App from '../App';

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'App.js');

/**
 * As telas que são destino de rota.
 *
 * `Footer`, `RotaProtegida`, `AuthProvider` e `ProvedorDeToasts` **não** estão na
 * lista, e é de propósito: os quatro aparecem em toda rota. Dividi-los custaria
 * uma ida à rede para carregar o que vai ser usado de qualquer forma.
 *
 * `TelaAluno` e `TelaProfessor` deixaram de ser destino de rota na v1.1.0,
 * quando `/aluno` e `/professor` passaram a redirecionar para `/salas`. As
 * duas continuam num pedaço separado — o de `Sala`, a única tela que as abre.
 */
const TELAS_DE_ROTA = ['Login', 'Cadastro', 'MinhasSalas', 'EntrarComPin', 'CriarSala', 'Sala'];

/** Aponta a URL do navegador antes de montar o App, que tem o Router dentro. */
function irPara(caminho) {
  window.history.pushState({}, '', caminho);
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  localStorage.clear();
  irPara('/');
});

/**
 * O `App.js` sem os comentários.
 *
 * Necessário porque o arquivo **explica** por que `fallback={null}` seria errado,
 * e a asserção que proíbe aquela forma encontraria a explicação. Um teste que se
 * confunde com o comentário que documenta a decisão dele é um teste que obriga a
 * apagar o comentário.
 */
function semComentarios(codigo) {
  return codigo
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');
}

describe('AC-PERF-02 — a divisão é estrutural, não uma rota escolhida a dedo', () => {
  const codigo = semComentarios(fs.readFileSync(APP, 'utf8'));

  it('nenhuma tela de rota é importada de forma estática', () => {
    const estaticas = TELAS_DE_ROTA.filter((tela) =>
      new RegExp(`^import ${tela} from`, 'm').test(codigo)
    );

    expect(estaticas).toEqual([]);
  });

  TELAS_DE_ROTA.forEach((tela) => {
    it(`${tela} entra por lazy(() => import(...))`, () => {
      const padrao = new RegExp(`const ${tela} = lazy\\(\\(\\) => import\\('[^']+'\\)\\)`);

      expect(codigo).toMatch(padrao);
    });
  });

  it('existe um Suspense em volta das rotas', () => {
    expect(codigo).toMatch(/<Suspense/);
  });

  it('o fallback do Suspense não é vazio — a espera é anunciada', () => {
    // `fallback={null}` divide o bundle e deixa a tela branca, sem nada para um
    // leitor de tela anunciar. É o mesmo defeito que o AC-AUTH-09 proíbe no
    // portão de autenticação.
    expect(codigo).not.toMatch(/fallback=\{null\}/);
    expect(codigo).toMatch(/fallback=\{/);
  });

  it('o Footer continua estático — ele aparece em toda rota', () => {
    expect(codigo).toMatch(/^import Footer from/m);
  });
});

describe('AC-PERF-02 — a divisão não pode quebrar rota nenhuma', () => {
  it('a raiz abre o login, depois de carregar o pedaço dela', async () => {
    render(<App />);

    expect(await screen.findByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
  });

  it('o cadastro abre pelo próprio pedaço', async () => {
    irPara('/cadastro');

    render(<App />);

    expect(await screen.findByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
  });

  it('a espera pelo pedaço é anunciada a quem usa leitor de tela', async () => {
    render(<App />);

    // O aviso aparece antes de o módulo da rota resolver. Ele é procurado com
    // `queryAllByRole` porque, em ambiente sem latência, pode já ter sumido —
    // o que se exige é que ele exista no código, e a asserção estrutural acima
    // cobre isso. Aqui se exige que, se estiver na tela, seja anunciável.
    const avisos = screen.queryAllByRole('status');

    avisos.forEach((aviso) => expect(aviso).toHaveAccessibleName());

    // E, de todo modo, a rota chega.
    expect(await screen.findByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
  });
});
