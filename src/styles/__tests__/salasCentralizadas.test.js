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
