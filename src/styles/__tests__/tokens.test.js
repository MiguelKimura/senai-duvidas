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
      .filter(([, valor]) => !cssLegado.includes(valor))
      .map(([nome, valor]) => `${nome}: ${valor}`);

    expect(inventados).toEqual([]);
  });

  it('não repete o mesmo valor em dois nomes diferentes da mesma família', () => {
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
