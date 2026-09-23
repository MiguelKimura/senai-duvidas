// A camada de animação do projeto — AC-ANIM-01, AC-ANIM-05, AC-ANIM-06, AC-ANIM-09.
//
// Até a v0.9.0 cada task entregou a animação mínima do próprio escopo. O
// resultado funciona e é inconsistente: `0.3s` no card, `150ms` no campo de
// anexo, `0.45s` na premiação, três `@media (prefers-reduced-motion)` escritos
// em três arquivos e nenhum deles cobrindo os outros.
//
// Este teste é o contrato da camada única. Ele lê CSS como texto, no mesmo
// espírito de `tokens.test.js` e de `Chat.css.test.js` — jsdom não aplica folha
// de estilo, então não há como afirmar pixel. O que dá para afirmar, e é o que
// os critérios cobram por escrito:
//
//   1. as durações e as curvas canônicas existem, e as de interface cabem na
//      faixa de 150ms a 300ms que o AC-ANIM-01 define;
//   2. existe UM bloco global de `prefers-reduced-motion` que zera tudo, e não
//      um por arquivo que esquece o arquivo seguinte (AC-ANIM-05);
//   3. nenhuma animação anima propriedade que force reflow (AC-ANIM-06);
//   4. nenhuma duração literal sobrou fora de `tokens.css` (AC-ANIM-09).
const fs = require('fs');
const path = require('path');

const PASTA_ESTILOS = path.join(__dirname, '..');
const CAMINHO_TOKENS = path.join(PASTA_ESTILOS, 'tokens.css');
const CAMINHO_ANIMACOES = path.join(PASTA_ESTILOS, 'animacoes.css');
const CAMINHO_INDEX = path.join(PASTA_ESTILOS, '..', 'index.css');

/** Remove comentários para que um valor citado em prosa não conte como regra. */
function semComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function ler(caminho) {
  return semComentarios(fs.readFileSync(caminho, 'utf8'));
}

/** Toda folha de `src/styles`, exceto `tokens.css` — onde os literais moram. */
function folhasDeComponente() {
  return fs
    .readdirSync(PASTA_ESTILOS)
    .filter((nome) => nome.endsWith('.css') && nome !== 'tokens.css')
    .map((nome) => ({ nome, css: ler(path.join(PASTA_ESTILOS, nome)) }));
}

/**
 * O intervalo `{ ... }` aberto por `abertura`, com as chaves balanceadas.
 *
 * Mesma função de `Chat.css.test.js`, pela mesma razão: regex não conta chave,
 * e `@media`/`@keyframes` aninham. Copiada e não importada de propósito — um
 * teste que dependa de outro teste falha junto com ele por motivo errado.
 */
function localizarBloco(css, abertura) {
  const encontrado = abertura.exec(css);

  if (!encontrado) return null;

  const inicio = encontrado.index + encontrado[0].length;
  let profundidade = 1;
  let i = inicio;

  while (i < css.length && profundidade > 0) {
    if (css[i] === '{') profundidade += 1;
    if (css[i] === '}') profundidade -= 1;
    i += 1;
  }

  return { inicio: encontrado.index, fim: i, corpo: css.slice(inicio, i - 1) };
}

/** Os tokens declarados em `tokens.css`, já sem comentário. */
function lerTokens() {
  const tokens = {};

  for (const [, nome, valor] of ler(CAMINHO_TOKENS).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[nome] = valor.replace(/\s+/g, ' ').trim();
  }

  return tokens;
}

/** `150ms` e `0.3s` viram 150 e 300. */
function emMilissegundos(valor) {
  const casado = /^([0-9]*\.?[0-9]+)(ms|s)$/.exec(String(valor).trim());

  if (!casado) return null;

  return casado[2] === 's' ? Number(casado[1]) * 1000 : Number(casado[1]);
}

/**
 * As durações canônicas da interface, na faixa do AC-ANIM-01.
 *
 * Três e não uma: `rapida` é o realce que segue o dedo (hover, foco),
 * `media` é a entrada de um card na lista, `lenta` é a abertura de um modal,
 * que precisa do tempo de o olho achar a caixa nova.
 */
const DURACOES_DE_INTERFACE = ['--dur-rapida', '--dur-media', '--dur-lenta'];

/**
 * As curvas canônicas.
 *
 * `saida` acelera (o elemento vai embora, não interessa mais); `entrada`
 * desacelera (o elemento chega e precisa ser lido); `padrao` é a simétrica das
 * transições de estado, que não têm direção.
 */
const CURVAS = ['--ease-saida', '--ease-entrada', '--ease-padrao'];

/**
 * Durações fora da faixa de interface, cada uma com o motivo declarado.
 *
 * A faixa de 150ms a 300ms do AC-ANIM-01 é sobre **transição de interface**:
 * rota, modal, card. A premiação do AC-PERK-04 não é transição, é a coisa em
 * si — o cliente pediu "tipo o do Call of Duty", e 300ms não entregam isso.
 * Ficar de fora da faixa é a decisão; ficar de fora **sem nome** é o que este
 * teste impede.
 */
const DURACOES_DE_CELEBRACAO = {
  '--dur-celebracao': 'entrada do cartão de premiação (AC-PERK-04)',
  '--dur-brilho': 'o halo que se expande atrás do cartão de premiação',
  '--dur-desfazer': 'a janela de arrependimento da exclusão (AC-CHAMADO-04)',
};

describe('tokens de movimento (AC-ANIM-01, AC-ANIM-09)', () => {
  it('declara as três durações canônicas da interface', () => {
    const tokens = lerTokens();

    for (const nome of DURACOES_DE_INTERFACE) {
      expect(tokens[nome]).toBeDefined();
    }
  });

  it('mantém as durações de interface dentro da faixa de 150ms a 300ms', () => {
    const tokens = lerTokens();

    for (const nome of DURACOES_DE_INTERFACE) {
      const ms = emMilissegundos(tokens[nome]);

      expect(ms).not.toBeNull();
      expect(ms).toBeGreaterThanOrEqual(150);
      expect(ms).toBeLessThanOrEqual(300);
    }
  });

  it('as três durações são distintas — uma escala de um degrau não é escala', () => {
    const tokens = lerTokens();
    const valores = DURACOES_DE_INTERFACE.map((nome) => emMilissegundos(tokens[nome]));

    expect(new Set(valores).size).toBe(valores.length);
  });

  it('declara as três curvas canônicas', () => {
    const tokens = lerTokens();

    for (const nome of CURVAS) {
      expect(tokens[nome]).toBeDefined();
    }
  });

  it('toda duração fora da faixa tem nome próprio e motivo declarado', () => {
    const tokens = lerTokens();

    const foraDaFaixa = Object.entries(tokens)
      .filter(([, valor]) => emMilissegundos(valor) !== null)
      .filter(([nome]) => !DURACOES_DE_INTERFACE.includes(nome))
      .filter(([nome]) => !(nome in DURACOES_DE_CELEBRACAO))
      .map(([nome, valor]) => `${nome}: ${valor}`);

    expect(foraDaFaixa).toEqual([]);
  });
});

describe('src/styles/animacoes.css (AC-ANIM-05, AC-ANIM-09)', () => {
  it('existe', () => {
    expect(fs.existsSync(CAMINHO_ANIMACOES)).toBe(true);
  });

  it('é importado por index.css, depois dos tokens que ele consome', () => {
    const css = ler(CAMINHO_INDEX);

    const tokens = css.indexOf('tokens.css');
    const animacoes = css.indexOf('animacoes.css');

    expect(tokens).toBeGreaterThanOrEqual(0);
    expect(animacoes).toBeGreaterThan(tokens);
  });

  it('zera duração, atraso e rolagem suave para TODO elemento (AC-ANIM-05)', () => {
    const bloco = localizarBloco(
      ler(CAMINHO_ANIMACOES),
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/
    );

    expect(bloco).not.toBeNull();

    // O seletor universal é o ponto inteiro: um bloco por arquivo esquece o
    // arquivo seguinte, e foi assim que a v0.9.0 chegou com três blocos e
    // nenhum cobrindo a entrada dos cards.
    expect(bloco.corpo).toMatch(/\*/);
    expect(bloco.corpo).toMatch(/animation-duration\s*:\s*0s\s*!important/);
    expect(bloco.corpo).toMatch(/animation-delay\s*:\s*0s\s*!important/);
    expect(bloco.corpo).toMatch(/transition-duration\s*:\s*0s\s*!important/);
    expect(bloco.corpo).toMatch(/transition-delay\s*:\s*0s\s*!important/);
    expect(bloco.corpo).toMatch(/scroll-behavior\s*:\s*auto\s*!important/);
  });
});

describe('a folha inteira do projeto (AC-ANIM-06, AC-ANIM-09)', () => {
  it('não deixa nenhuma duração literal fora de tokens.css', () => {
    const sobras = folhasDeComponente().flatMap(({ nome, css }) =>
      // Só dentro de declarações de tempo: `padding: 5px` não é duração, e
      // `translateY(6px)` muito menos.
      [...css.matchAll(/(transition|animation)(-duration|-delay)?\s*:\s*([^;}]+)/g)]
        .flatMap(([, , , valor]) => valor.split(/[\s,]+/))
        .filter((pedaco) => emMilissegundos(pedaco) !== null)
        .map((pedaco) => `${nome}: ${pedaco}`)
    );

    expect(sobras).toEqual([]);
  });

  it('anima só transform e opacity — nada que force reflow (AC-ANIM-06)', () => {
    // A lista é de propriedades que o navegador resolve na composição, sem
    // recalcular layout. `width`, `top`, `margin` e companhia recalculam a
    // página inteira a cada quadro, e numa fila de 200 cards isso é a diferença
    // entre a lista rolar e a lista travar.
    const COMPOSITAVEIS = ['transform', 'opacity', 'filter', 'visibility'];

    const proibidas = [];

    for (const { nome, css } of folhasDeComponente()) {
      let restante = css;

      for (let bloco = localizarBloco(restante, /@keyframes\s[^{]*\{/); bloco; ) {
        for (const [, propriedade] of bloco.corpo.matchAll(/([a-z-]+)\s*:/g)) {
          if (!COMPOSITAVEIS.includes(propriedade)) {
            proibidas.push(`${nome}: @keyframes anima ${propriedade}`);
          }
        }

        restante = restante.slice(0, bloco.inicio) + restante.slice(bloco.fim);
        bloco = localizarBloco(restante, /@keyframes\s[^{]*\{/);
      }
    }

    expect(proibidas).toEqual([]);
  });

  it('não transiciona `all`, que arrasta layout junto sem ninguém pedir', () => {
    // `transition: all` anima também `width`, `height` e `padding` quando eles
    // mudam por tabela. Era o que `Modal.css` fazia no <textarea>: digitar
    // redimensionava a caixa, e a caixa animava o redimensionamento.
    const vazamentos = folhasDeComponente().flatMap(({ nome, css }) =>
      [...css.matchAll(/transition\s*:\s*([^;}]+)/g)]
        .filter(([, valor]) => /^\s*all\b/.test(valor))
        .map(([, valor]) => `${nome}: transition: ${valor.trim()}`)
    );

    expect(vazamentos).toEqual([]);
  });
});
