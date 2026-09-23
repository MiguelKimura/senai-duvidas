// O outro lado do AC-ANIM-09: os tokens são **consumidos**.
//
// `tokens.test.js` prova que `tokens.css` existe, que é importado e que nenhum
// valor ali foi inventado. Isso garantia metade do critério e a metade fácil.
// A outra metade — "usado por todos os estilos" — nunca teve teste, e o
// resultado está à vista: `#ff0000` aparece literalmente em seis folhas,
// `gray` em sete lugares do chat, `white` em quatro grafias diferentes.
//
// Enquanto os literais estiverem espalhados, o arquivo de tokens é decoração:
// mudar `--cor-primaria` não muda um pixel da tela. E é exatamente isso que a
// correção de contraste do AC-ANIM-10 precisa fazer — mudar uma linha e ver o
// app inteiro obedecer. Sem este teste, a correção passaria no teste de
// contraste (que lê os tokens) e deixaria a interface reprovada (que lê o CSS).
//
// A regra é dura de propósito: **nenhuma cor literal fora de `tokens.css`**.
// Não "nenhuma cor repetida" — uma cor usada uma vez só continua sendo uma cor
// que ninguém consegue mudar sem caçá-la. As exceções estão nomeadas abaixo,
// uma a uma, com o motivo; a lista é curta e é para continuar curta.
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..');

/**
 * Cores escritas como literal que **não** são violação, e por quê.
 *
 * `rgba()` fica de fora da varredura inteira: um véu translúcido não é uma
 * cor da identidade, é uma camada de opacidade sobre o que estiver atrás.
 * Tokenizar `rgba(0, 0, 0, 0.5)` do fundo do modal não daria a ninguém o poder
 * de mudar nada — o preto ali não é preto, é sombra.
 */
const EXCECOES = {
  'SeletorDeCor.css':
    'a amostra circular da paleta repete os nove fundos de utils/paleta.js, ' +
    'que é a fonte de verdade deles e roda a conta de contraste sobre cada um ' +
    '(paleta.test.js). Um token por cor de card seria uma segunda fonte.',
};

/** As folhas do projeto, exceto a que declara os tokens. */
function folhas() {
  return fs
    .readdirSync(PASTA)
    .filter((nome) => nome.endsWith('.css') && nome !== 'tokens.css')
    .sort();
}

/**
 * Tira comentários e `rgba()`/`rgb()` antes de procurar literal de cor.
 *
 * Comentário sai porque este arquivo e os outros citam `#ff0000` em prosa para
 * explicar de onde o token veio — e um teste que proíbe falar sobre a cor
 * proíbe documentá-la.
 */
function corpoDe(nome) {
  return fs
    .readFileSync(path.join(PASTA, nome), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/rgba?\([^)]*\)/g, '');
}

/**
 * Os nomes de cor do CSS que o projeto já usou. Não é a lista das 147 — é a
 * lista do que apareceu aqui, porque proibir `rebeccapurple` não protege nada.
 */
const NOMES_DE_COR = ['white', 'black', 'gray', 'grey', 'red', 'green', 'blue', 'silver'];

const LITERAL_DE_COR = new RegExp(
  `(#[0-9a-fA-F]{3,8}\\b|(?<![-\\w])(?:${NOMES_DE_COR.join('|')})(?![-\\w]))`,
  'g'
);

/** Os literais de cor de uma folha, com o número da linha de cada um. */
function literaisDe(nome) {
  const linhas = corpoDe(nome).split('\n');
  const achados = [];

  linhas.forEach((linha, indice) => {
    // Só o lado direito de uma declaração: `white-space` é propriedade, e
    // `.botao-white` seria classe. O que interessa é o **valor**.
    const declaracao = /^[^{}]*:\s*(.+)$/.exec(linha.trim());
    if (!declaracao) return;

    for (const achado of declaracao[1].matchAll(LITERAL_DE_COR)) {
      achados.push(`${nome}:${indice + 1} → ${achado[0]}`);
    }
  });

  return achados;
}

describe('as folhas consomem os tokens (AC-ANIM-09)', () => {
  it('encontra as folhas do projeto — uma varredura vazia não prova nada', () => {
    expect(folhas().length).toBeGreaterThan(10);
  });

  it.each(folhas().filter((nome) => !(nome in EXCECOES)))(
    '%s não escreve nenhuma cor literal',
    (nome) => {
      expect(literaisDe(nome)).toEqual([]);
    }
  );

  it('toda exceção declarada é uma folha que existe e que de fato tem literal', () => {
    for (const nome of Object.keys(EXCECOES)) {
      expect(folhas()).toContain(nome);
      expect(literaisDe(nome).length).toBeGreaterThan(0);
    }
  });

  it('todo token que uma folha invoca existe em tokens.css', () => {
    const tokens = new Set(
      [...fs.readFileSync(path.join(PASTA, 'tokens.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
        ([, nome]) => nome
      )
    );

    const orfaos = [];

    for (const nome of folhas()) {
      for (const [, invocado] of corpoDe(nome).matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
        // O segundo argumento de `var()` é o padrão, e um padrão só faz
        // sentido quando o token pode não existir — o que não é o caso aqui.
        if (!tokens.has(invocado)) orfaos.push(`${nome} invoca ${invocado}`);
      }
    }

    expect(orfaos).toEqual([]);
  });
});
