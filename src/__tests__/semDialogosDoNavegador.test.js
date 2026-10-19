// Nenhum diálogo do navegador sobra no código — AC-ANIM-07.
//
// `alert()`, `confirm()`, `prompt()` e `window.open()` saíram do projeto aos
// poucos, uma task por vez: o login e o cadastro na 01, o visualizador de
// anexo na 04, a exclusão do professor nesta. Um teste por tela provou cada
// saída; nenhum deles impede a **volta**. E a volta é fácil — `alert('deu
// certo')` é a primeira coisa que qualquer um escreve ao depurar, e é a última
// que alguém lembra de tirar.
//
// Por que isso não é preciosismo de estilo. Nos laboratórios do SENAI a
// política do Windows suprime pop-up e diálogo modal em parte das máquinas.
// Suprimido, `alert()` simplesmente não aparece; `confirm()` devolve `false`
// em silêncio, e a ação nunca acontece; `window.open()` devolve `null`, e o
// anexo não abre. Em todos os três casos o aluno clica, nada acontece, e não
// há nada na tela explicando por quê — o pior modo de falha possível numa aula
// de quarenta pessoas.
//
// A varredura é do **fonte**, e não do comportamento, porque é a única forma
// de cobrir o arquivo que ninguém lembrou de testar. Um teste de tela prova
// que aquela tela não chama; este prova que nenhuma chama.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/**
 * Os arquivos de produção do `src/`.
 *
 * Teste e utilitário de teste ficam de fora: `Toast.test.js` precisa poder
 * espionar `window.alert` para provar que ninguém o chamou, e um teste que
 * proíbe o espião proíbe a prova.
 */
function fontes(pasta = RAIZ) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);

    if (entrada.isDirectory()) {
      if (entrada.name === '__tests__' || entrada.name === '__mocks__') return [];
      if (entrada.name === 'test-utils') return [];
      return fontes(caminho);
    }

    if (!/\.(js|jsx)$/.test(entrada.name)) return [];
    if (/\.(test|spec)\.(js|jsx)$/.test(entrada.name)) return [];

    return [caminho];
  });
}

/**
 * O fonte sem comentário nenhum.
 *
 * Metade dos arquivos do projeto explica em prosa de qual `alert()` ela veio —
 * `Toast.jsx` abre com um parágrafo sobre isso. Proibir a palavra proibiria a
 * documentação, e a documentação é o que impede a volta por esquecimento.
 */
function codigoDe(caminho) {
  return fs
    .readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** O que está proibido, e o que o projeto usa no lugar. */
const PROIBIDOS = [
  ['alert', '<Toast> (components/Toast.jsx)'],
  ['confirm', '<ConfirmarAcao> (components/ConfirmarAcao.jsx)'],
  ['prompt', 'um campo de formulário na própria tela'],
  ['open', '<Lightbox> (components/Lightbox.jsx)'],
];

/**
 * As chamadas proibidas de um arquivo, com a linha de cada uma.
 *
 * Pega tanto `window.alert(...)` quanto o `alert(...)` solto, que é o global
 * implícito e o mais provável de escapar. `\b` antes do nome para `.open(` de
 * um `XMLHttpRequest` ou de um `IDBDatabase` não virar falso positivo — o que
 * se procura é o global, não um método homônimo de outro objeto.
 */
function chamadasDe(caminho, nome) {
  const codigo = codigoDe(caminho);
  const padrao = new RegExp(`(?:^|[^.\\w])(?:window\\s*\\.\\s*)?${nome}\\s*\\(`, 'gm');
  const achados = [];

  for (const achado of codigo.matchAll(padrao)) {
    const linha = codigo.slice(0, achado.index).split('\n').length;
    achados.push(`${path.relative(RAIZ, caminho)}:${linha}`);
  }

  return achados;
}

describe('nenhum diálogo do navegador no código de produção (AC-ANIM-07)', () => {
  it('encontra os fontes — uma varredura vazia aprovaria qualquer coisa', () => {
    expect(fontes().length).toBeGreaterThan(30);
  });

  it.each(PROIBIDOS)('ninguém chama %s() — quem precisa usa %s', (nome) => {
    const chamadas = fontes().flatMap((caminho) => chamadasDe(caminho, nome));

    expect(chamadas).toEqual([]);
  });

  // O guarda do guarda. Se a varredura acima parar de enxergar `alert(` — por
  // uma mudança de regex, por uma pasta que saiu da lista —, ela passa a
  // aprovar o projeto inteiro sem que ninguém perceba. Este teste a submete a
  // um arquivo que sabidamente chama, e exige que ela reclame.
  it('a varredura de fato enxerga uma chamada — senão ela aprova o vazio', () => {
    const isca = path.join(RAIZ, '__iscaDaVarredura.js');

    fs.writeFileSync(
      isca,
      [
        'export function avisar() {',
        "  window.alert('oi');",
        "  confirm('mesmo?');",
        '}',
        '',
      ].join('\n'),
      'utf8'
    );

    try {
      expect(chamadasDe(isca, 'alert')).toHaveLength(1);
      expect(chamadasDe(isca, 'confirm')).toHaveLength(1);
    } finally {
      fs.unlinkSync(isca);
    }
  });

  it('ignora comentário: falar do alert() que saiu é como se impede a volta', () => {
    const isca = path.join(RAIZ, '__iscaDeComentario.js');

    fs.writeFileSync(
      isca,
      [
        '// Este componente substitui o alert() da v0.1.0.',
        '/* nem window.open(url) */',
        '',
      ].join('\n'),
      'utf8'
    );

    try {
      expect(chamadasDe(isca, 'alert')).toEqual([]);
      expect(chamadasDe(isca, 'open')).toEqual([]);
    } finally {
      fs.unlinkSync(isca);
    }
  });

  it('o substituto de cada um está montado, e não só escrito', () => {
    const app = fs.readFileSync(path.join(RAIZ, 'App.js'), 'utf8');

    // A pilha de avisos precisa estar ACIMA das rotas: um toast disparado ao
    // excluir tem de sobreviver à navegação que a exclusão possa causar.
    expect(app).toMatch(/<ProvedorDeToasts>/);

    const anexo = fs.readFileSync(path.join(RAIZ, 'components', 'AnexoDoCard.jsx'), 'utf8');
    expect(anexo).toMatch(/<Lightbox\b/);
  });
});
