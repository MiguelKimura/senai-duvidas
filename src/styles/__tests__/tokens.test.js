// Tokens de design — AC-ANIM-09.
//
// Este teste não olha para pixels: ele prova que `tokens.css` é uma
// **extração** dos CSS que já existem, e não um repaginamento disfarçado de
// refatoração. A regra desta task é "nenhuma mudança visível para o usuário",
// e a forma de garanti-la é exigir que todo valor declarado como token apareça
// literalmente em algum CSS legado. Um token novo, inventado, reprova aqui.
//
// As tasks seguintes vão trocar os valores crus pelos `var(--token)` nos
// arquivos de componente. Enquanto isso não acontece, os dois convivem — e é
// justamente por isso que a igualdade de valores precisa ser verificada.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_TOKENS = path.join(RAIZ, 'styles', 'tokens.css');
const CAMINHO_INDEX = path.join(RAIZ, 'index.css');

const CSS_LEGADOS = [
  'styles/App.css',
  'styles/Cadastro.css',
  'styles/Chat.css',
  'styles/Footer.css',
  'styles/Login.css',
  'styles/Modal.css',
  'styles/TelaAluno.css',
  'styles/TelaProfessor.css',
];

/** Colapsa espaços para comparar valores CSS sem depender de formatação. */
function normalizar(valor) {
  return valor.replace(/\s+/g, ' ').trim();
}

function lerTokens() {
  const css = fs.readFileSync(CAMINHO_TOKENS, 'utf8');
  const tokens = {};

  for (const [, nome, valor] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[nome] = normalizar(valor);
  }

  return tokens;
}

/**
 * Resolve `--a: var(--b)` até chegar a um valor concreto.
 *
 * Um apelido é a forma idiomática de dizer em CSS "este papel usa aquela cor":
 * o texto sobre o botão vermelho é branco *porque* é a cor da superfície, não
 * por coincidência. Dois nomes com o mesmo literal seriam duplicação; um nome
 * apontando para o outro é intenção declarada — e continua sendo verificado,
 * porque a resolução abaixo chega no literal e ele é conferido igual.
 */
function resolver(valor, tokens, vistos = new Set()) {
  const apelido = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valor);

  if (!apelido) return valor;

  const alvo = apelido[1];

  if (vistos.has(alvo)) throw new Error(`Ciclo de apelidos em ${alvo}`);
  if (!(alvo in tokens)) throw new Error(`Apelido aponta para token inexistente: ${alvo}`);

  return resolver(tokens[alvo], tokens, new Set(vistos).add(alvo));
}

const cssLegado = normalizar(
  CSS_LEGADOS.map((relativo) => fs.readFileSync(path.join(RAIZ, relativo), 'utf8')).join('\n')
);

describe('src/styles/tokens.css', () => {
  it('existe e declara os tokens em :root, para valerem no documento inteiro', () => {
    expect(fs.existsSync(CAMINHO_TOKENS)).toBe(true);
    expect(fs.readFileSync(CAMINHO_TOKENS, 'utf8')).toMatch(/:root\s*\{/);
  });

  it('cobre as cinco famílias que os componentes consomem', () => {
    const nomes = Object.keys(lerTokens());

    const familias = ['--cor-', '--espaco-', '--raio-', '--sombra-', '--duracao-'];

    for (const familia of familias) {
      expect(nomes.filter((nome) => nome.startsWith(familia)).length).toBeGreaterThan(0);
    }
  });

  it('não inventa valor nenhum: todo token aparece literalmente no CSS atual', () => {
    const tokens = lerTokens();

    expect(Object.keys(tokens).length).toBeGreaterThan(0);

    const inventados = Object.entries(tokens)
      .map(([nome, valor]) => [nome, resolver(valor, tokens)])
      .filter(([, valor]) => !cssLegado.includes(valor))
      .map(([nome, valor]) => `${nome}: ${valor}`);

    expect(inventados).toEqual([]);
  });

  it('não repete o mesmo literal em dois nomes — papéis que coincidem viram apelido', () => {
    const tokens = lerTokens();
    const vistos = new Map();
    const duplicados = [];

    for (const [nome, valor] of Object.entries(tokens)) {
      const familia = nome.split('-')[2];
      const chave = `${familia}|${valor}`;

      if (vistos.has(chave)) duplicados.push(`${vistos.get(chave)} e ${nome} valem ${valor}`);
      else vistos.set(chave, nome);
    }

    expect(duplicados).toEqual([]);
  });

  it('declara os dois vermelhos da identidade visual, que estão em todo botão', () => {
    const tokens = lerTokens();
    const valores = Object.values(tokens);

    expect(valores).toContain('#ff0000');
    expect(valores).toContain('#8f0000');
  });

  it('todo apelido aponta para um token que existe, sem ciclo', () => {
    const tokens = lerTokens();

    for (const [, valor] of Object.entries(tokens)) {
      expect(() => resolver(valor, tokens)).not.toThrow();
    }
  });
});

describe('src/index.css', () => {
  it('importa os tokens', () => {
    expect(fs.readFileSync(CAMINHO_INDEX, 'utf8')).toMatch(
      /@import\s+(url\()?['"]\.\/styles\/tokens\.css['"]/
    );
  });

  it('põe o @import antes de qualquer regra, como o CSS exige', () => {
    const css = fs.readFileSync(CAMINHO_INDEX, 'utf8');
    const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(semComentarios.trim()).toMatch(/^@import/);
  });
});
