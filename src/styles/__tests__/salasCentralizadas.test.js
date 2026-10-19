// O PIN no centro da tela (v1.1.0): o formulário de entrar na sala, sozinho
// ou no primeiro acesso, fica centralizado, e não colado no canto esquerdo.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'Salas.css'), 'utf8');

function bloco(seletor) {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const achado = css.match(new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`));

  return achado ? achado[2] : null;
}

describe('Salas.css — o PIN centralizado', () => {
  it('a coluna centralizada tem largura máxima e margem automática dos lados', () => {
    const regras = bloco('.salas-centralizada');

    expect(regras).not.toBeNull();
    expect(regras).toMatch(/max-width:\s*\d+px/);
    expect(regras).toMatch(/margin:\s*[^;]*auto/);
  });

  it('dentro da caixa de primeiro acesso, o formulário não vira uma segunda caixa', () => {
    const regras = bloco('.salas-primeiro-acesso .salas-formulario');

    expect(regras).not.toBeNull();
    expect(regras).toMatch(/box-shadow:\s*none/);
  });
});

describe('o botão Sair não herda largura de outra tela', () => {
  const pasta = path.join(__dirname, '..');

  it('Cadastro.css não estiliza todo <button> do app', () => {
    const cadastro = fs.readFileSync(path.join(pasta, 'Cadastro.css'), 'utf8');

    // Um `button { width: 100% }` solto vale para o app inteiro depois que a
    // tela de cadastro é visitada — e esticava o Sair de uma borda à outra.
    expect(cadastro).not.toMatch(/(^|\n|\})\s*button\s*(:hover\s*)?\{/);
  });

  it('o Sair tem largura própria', () => {
    const sair = fs.readFileSync(path.join(pasta, 'BotaoSair.css'), 'utf8');

    expect(sair).toMatch(/\.botao-sair\s*\{[^}]*width:\s*auto/);
  });
});
