// A caixa de descrição do novo chamado (v1.1.0): tamanho fixo, sem crescer
// para o lado, com rolagem interna; e respiro entre o título e a caixa.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'Modal.css'), 'utf8');

describe('Modal.css — a caixa de descrição', () => {
  it('não se redimensiona e rola por dentro', () => {
    const bloco = css.match(/\.modal textarea\s*\{([^}]*)\}/);

    expect(bloco).not.toBeNull();
    expect(bloco[1]).toMatch(/resize:\s*none/);
    expect(bloco[1]).toMatch(/overflow-y:\s*auto/);
    expect(bloco[1]).toMatch(/height:\s*\d+px/);
  });

  it('nenhuma caixa de texto do app cresce para o lado', () => {
    expect(css).not.toMatch(/resize:\s*(both|horizontal)/);
  });

  it('o título tem margem embaixo antes da caixa', () => {
    expect(css).toMatch(/\.modal h2\s*\{[^}]*margin:\s*0 0 var\(--espaco-3\)/);
  });
});
