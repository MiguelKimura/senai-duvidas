// A interface em cada tamanho de tela — AC-ANIM-08.
//
// Dois tamanhos importam de verdade, e por motivos opostos:
//
//   * **1024×768** é a tela do laboratório do SENAI. É onde o app roda na
//     aula, e é **baixa** — 768px de altura é menos do que qualquer monitor
//     comprado nesta década. O risco aqui não é largura, é altura;
//   * **360px** é o celular mais estreito que ainda se vê em sala. O risco
//     aqui é rolagem horizontal, que é a pior coisa que pode acontecer com
//     uma lista vertical: o polegar rola de lado sem querer e perde o lugar.
//
// O que este arquivo consegue provar e o que não consegue. Ele lê o CSS como
// texto, porque o jsdom não aplica folha de estilo nem calcula layout —
// `getComputedStyle` devolveria o valor declarado inline, não o resultado da
// cascata. Não dá para medir um pixel aqui; dá para provar que a regra que
// evita o problema **existe**, que ela está no ponto de corte combinado, e
// que ninguém inventou um sexto ponto de corte no caminho.
//
// Medir pixel de verdade é escopo do `test:e2e` (Playwright, a partir da
// v1.0.0), que roda num navegador com layout real. Até lá, este teste é o que
// impede a regressão silenciosa — e é ele que pegou o `calc(100vh - 120px)`
// documentado abaixo.
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..');

/**
 * Os pontos de corte do projeto, e o que cada um decide.
 *
 * Quatro, e não um por tela. Cada ponto de corte novo é uma combinação a mais
 * para conferir à mão, e a lista cresce sozinha se ninguém a guardar: basta
 * alguém escrever `@media (max-width: 600px)` porque *naquele* componente 600
 * pareceu melhor, e em três tasks não há mais um sistema, há dez exceções.
 */
const PONTOS_DE_CORTE = {
  480: 'o celular. Diálogo vira tela cheia; o card perde o teto de 400px',
  768: 'o limite do celular deitado. O chat deixa de flutuar e vira painel',
  1024: 'a tela do laboratório do SENAI, e o alvo principal',
  1440: 'o monitor grande, onde a coluna única deixa de fazer sentido',
};

/** A largura mínima que o projeto se compromete a atender, sem rolagem lateral. */
const LARGURA_MINIMA = 360;

function folhas() {
  return fs
    .readdirSync(PASTA)
    .filter((nome) => nome.endsWith('.css'))
    .sort();
}

/**
 * A folha sem comentário nenhum.
 *
 * Duas razões, e as duas são de correção. A primeira: a regra que este arquivo
 * proíbe está citada em prosa no CSS que a substituiu — é assim que a próxima
 * pessoa entende por que `height: calc(100vh - 120px)` não pode voltar. Ler o
 * comentário faria o teste acusar exatamente a documentação da correção.
 * A segunda: uma chave dentro de um comentário desalinharia a contagem de
 * `blocoDaMedia`, e o bloco devolvido seria outro.
 */
function cssDe(nome) {
  return fs.readFileSync(path.join(PASTA, nome), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** O corpo da primeira `@media` de `nome` que casa com `consulta`. */
function blocoDaMedia(nome, consulta) {
  const css = cssDe(nome);
  const abertura = css.indexOf(`@media ${consulta}`);

  if (abertura === -1) return null;

  let profundidade = 0;
  let inicio = -1;

  for (let i = css.indexOf('{', abertura); i < css.length; i += 1) {
    if (css[i] === '{') {
      if (profundidade === 0) inicio = i + 1;
      profundidade += 1;
    } else if (css[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return css.slice(inicio, i);
    }
  }

  return null;
}

describe('os pontos de corte são um sistema, e não um por componente (AC-ANIM-08)', () => {
  it('nenhuma folha inventa um ponto de corte fora da lista', () => {
    const permitidos = new Set(Object.keys(PONTOS_DE_CORTE).map(Number));
    const intrusos = [];

    for (const nome of folhas()) {
      for (const [, largura] of cssDe(nome).matchAll(
        /\(\s*(?:max|min)-width:\s*(\d+)px\s*\)/g
      )) {
        if (!permitidos.has(Number(largura))) intrusos.push(`${nome} usa ${largura}px`);
      }
    }

    expect(intrusos).toEqual([]);
  });

  it('todo ponto de corte declarado é usado — a lista não cresce por enfeite', () => {
    const todas = folhas().map(cssDe).join('\n');

    for (const largura of Object.keys(PONTOS_DE_CORTE)) {
      expect(todas).toMatch(new RegExp(`(?:max|min)-width:\\s*${largura}px`));
    }
  });
});

describe('o celular a 360px (AC-ANIM-08)', () => {
  it('o chat deixa de ser caixa flutuante e vira painel de tela cheia', () => {
    const bloco = blocoDaMedia('Chat.css', '(max-width: 768px)');

    expect(bloco).not.toBeNull();

    // A caixa flutuante tem 320×440 fixos. Numa tela de 360 ela sobra quarenta
    // pixels de cada lado e a conversa cabe em seis linhas — o aluno lê a
    // dúvida por uma fresta enquanto a tela inteira está livre atrás dela.
    expect(bloco).toMatch(/\.chat-box\b[^{]*\{[^}]*position:\s*fixed/);
    expect(bloco).toMatch(/\.chat-box\b[^{]*\{[^}]*inset:\s*0/);
    expect(bloco).toMatch(/\.chat-box\b[^{]*\{[^}]*width:\s*(100%|auto)/);
    expect(bloco).toMatch(/\.chat-box\b[^{]*\{[^}]*height:\s*(100%|auto)/);
  });

  it('o diálogo de novo chamado ocupa a tela inteira', () => {
    const bloco = blocoDaMedia('Modal.css', '(max-width: 480px)');

    expect(bloco).not.toBeNull();
    expect(bloco).toMatch(/\.modal\b[^{]*\{[^}]*max-width:\s*none/);
  });

  it('a confirmação de exclusão também — as duas seguem a mesma regra', () => {
    const bloco = blocoDaMedia('ConfirmarAcao.css', '(max-width: 480px)');

    expect(bloco).not.toBeNull();
    expect(bloco).toMatch(/max-width:\s*none/);
  });

  it('nenhuma largura fixa passa de 360px — é assim que nasce rolagem lateral', () => {
    const largos = [];

    for (const nome of folhas()) {
      const css = cssDe(nome);

      for (const [declaracao, valor] of css.matchAll(
        /(?:^|[;{])\s*(?:min-)?width:\s*(\d+)px/gm
      )) {
        if (Number(valor) > LARGURA_MINIMA) largos.push(`${nome}: ${declaracao.trim()}`);
      }
    }

    expect(largos).toEqual([]);
  });
});

describe('o laboratório a 1024×768 (AC-ANIM-08)', () => {
  // O achado que motivou este bloco. As duas telas de sala são uma coluna de
  // `height: 95vh`, e dentro dela a lista pedia `height: calc(100vh - 120px)`.
  // Os dois números vêm da MESMA altura de janela, e o de dentro é maior: a
  // 768px de altura, a coluna tem 730px e a lista pede 648 mais o título, a
  // margem e o padding — 776px de conteúdo dentro de 730 de caixa. A lista
  // vaza por baixo, e o botão "+", que é `position: fixed`, cobre o último
  // card. Num monitor de 1080px de altura a conta fecha e ninguém vê nada.
  it.each(['TelaAluno.css', 'TelaProfessor.css'])(
    '%s não dimensiona a lista por uma conta sobre a altura da janela',
    (nome) => {
      expect(cssDe(nome)).not.toMatch(/height:\s*calc\(\s*100vh/);
    }
  );

  it.each(['TelaAluno.css', 'TelaProfessor.css'])(
    '%s deixa a lista crescer pelo flex, que é quem já conhece a altura real',
    (nome) => {
      expect(cssDe(nome)).toMatch(/\.problemas-list\b[^{]*\{[^}]*flex-grow:\s*1/);
      // Sem `min-height: 0` um filho flex que rola não encolhe abaixo do
      // próprio conteúdo — o padrão de `min-height` é `auto`, e é a causa
      // clássica de a barra de rolagem aparecer na página em vez da lista.
      expect(cssDe(nome)).toMatch(/\.problemas-list\b[^{]*\{[^}]*min-height:\s*0/);
    }
  );

  it('a fila usa a largura do laboratório em vez de uma coluna estreita', () => {
    const bloco = blocoDaMedia('FilaDeChamados.css', '(min-width: 1024px)');

    expect(bloco).not.toBeNull();
    expect(bloco).toMatch(/grid-template-columns/);
  });
});
