// As folhas de tela não mexem no resto do app (v1.1.0).
//
// Cada tela carrega a própria folha só quando é aberta (divisão por rota), e
// uma folha carregada não sai mais da página. Uma regra solta — `body`, `h1`,
// `p`, `button` — em Login.css ou Cadastro.css passava a valer para o app
// inteiro, mas só para quem tivesse passado por aquela tela: o layout mudava
// conforme o caminho. Vindo do cadastro, o `body` virava flex centralizado e
// o Sair esticava de uma borda à outra; abrindo direto na sala, sem passar
// pelo login, os títulos perdiam a centralização.
//
// A base que o app inteiro usa mora em index.css, que carrega sempre.
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..');

function semComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Seletores de regra que começam por elemento ou `*`, e não por classe. */
function seletoresSoltos(css) {
  const soltos = [];
  const regras = semComentarios(css).matchAll(/(^|\})\s*([^{}@]+)\{/g);

  for (const [, , seletores] of regras) {
    seletores
      .split(',')
      .map((seletor) => seletor.trim())
      .filter((seletor) => /^(\*|[a-z][a-z0-9]*)(\s|:|$)/i.test(seletor))
      .forEach((seletor) => soltos.push(seletor));
  }

  return soltos;
}

describe.each(['Login.css', 'Cadastro.css'])('%s', (folha) => {
  it('não tem regra solta de elemento: tudo fica sob a classe da tela', () => {
    const css = fs.readFileSync(path.join(PASTA, folha), 'utf8');

    expect(seletoresSoltos(css)).toEqual([]);
  });
});

describe('index.css — a base do app inteiro', () => {
  const css = semComentarios(fs.readFileSync(path.join(PASTA, '..', 'index.css'), 'utf8'));

  it('zera margens e usa border-box em todo elemento', () => {
    expect(css).toMatch(/\*\s*\{[^}]*box-sizing:\s*border-box/);
  });

  it('dá o fundo da página ao body', () => {
    expect(css).toMatch(/body\s*\{[^}]*background-color:\s*var\(--cor-fundo-pagina\)/);
  });

  it('o body não vira flex centralizado', () => {
    expect(css).not.toMatch(/body\s*\{[^}]*display:\s*flex/);
  });
});
