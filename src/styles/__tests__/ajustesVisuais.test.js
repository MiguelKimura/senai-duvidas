// Ajustes visuais pedidos pelo cliente na revisão da v1.1.0.
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..');

function css(folha) {
  return fs.readFileSync(path.join(PASTA, folha), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

function bloco(folha, seletor) {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const achado = css(folha).match(new RegExp(`(^|\\n|\\})\\s*${escapado}\\s*\\{([^}]*)\\}`));

  return achado ? achado[2] : null;
}

describe('ajustes visuais da v1.1.0', () => {
  it('a caixa do PIN da sala criada fica no centro', () => {
    expect(bloco('Salas.css', '.painel-do-pin')).toMatch(/margin:\s*[^;]*auto/);
  });

  it('"Remover imagem" é um botão de texto branco', () => {
    const regras = bloco('Modal.css', '.delete-image-btn');

    expect(regras).toMatch(/color:\s*var\(--cor-texto-invertido\)/);
    expect(regras).toMatch(/background-color:\s*var\(--cor-primaria\)/);
  });

  it('o diálogo de novo chamado nunca passa da altura da tela: rola por dentro', () => {
    const regras = bloco('Modal.css', '.modal');

    expect(regras).toMatch(/max-height:\s*calc\(100vh/);
    expect(regras).toMatch(/overflow-y:\s*auto/);
  });

  it('a prévia da imagem colada por link tem teto de altura', () => {
    expect(bloco('Modal.css', '.image-preview img')).toMatch(/max-height:\s*\d+px/);
  });

  it('o painel de premiações do professor tem largura máxima', () => {
    expect(bloco('Perks.css', '.perk-painel')).toMatch(/max-width:\s*\d+px/);
  });

  it('a lista da turma é uma coluna, com o nome à esquerda e o botão à direita', () => {
    expect(bloco('Salas.css', '.painel-da-turma-lista')).toMatch(/flex-direction:\s*column/);
    expect(bloco('Salas.css', '.painel-da-turma-lista li')).toMatch(
      /justify-content:\s*space-between/
    );
  });

  it('as conquistas viram cartões, com o texto alinhado à esquerda', () => {
    const item = bloco('Perks.css', '.perk-vitrine-item');

    expect(item).not.toBeNull();
    expect(item).toMatch(/text-align:\s*left/);
    expect(item).toMatch(/border-radius/);
  });
});
