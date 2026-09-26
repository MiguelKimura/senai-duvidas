// Cada critério [REG] tem um teste de regressão que o nomeia — AC-TEST-10.
//
// O AC-TEST-10 não pede que o comportamento antigo funcione: pede que exista um
// teste **explícito** para cada critério marcado [REG]. A diferença é prática. Um
// comportamento coberto por acidente — porque outro teste passa por ele de
// passagem — some no dia em que aquele outro teste é reescrito, e ninguém
// percebe. Um teste que nomeia `AC-IMG-13` no título é um teste que quem for
// mexer no anexo vai ler antes.
//
// Até esta versão nada ligava as duas listas. Os testes existiam, os critérios
// existiam, e a correspondência era mantida à mão no próprio documento de
// critérios — que é exatamente o lugar onde uma correspondência para de ser
// verificada. Aqui ela vira asserção.
//
// **A regra escolhida:** o identificador do critério precisa aparecer no
// **título** de algum `it`/`test`/`describe` da suíte. Não basta estar num
// comentário: comentário não roda, e um `describe` que perde o seu último `it`
// continua com o comentário no topo do arquivo. O título é o que aparece na
// saída do Jest quando o teste falha, e é assim que quem quebrou o critério
// descobre qual critério quebrou.
//
// A parte que prova que este teste não é decorativo é o `describe` do detector:
// ele alimenta as mesmas funções com um repositório sintético em que falta um
// critério, e exige que a falta seja apontada. Sem isso, um erro de regex faria
// tudo passar sem ler arquivo nenhum.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_CRITERIOS = path.join(RAIZ, 'docs', 'CRITERIOS-DE-ACEITE.md');

/** Quantos critérios [REG] o projeto tem. Muda com o documento, nunca sozinho. */
const CRITERIOS_DE_REGRESSAO_ESPERADOS = 11;

/**
 * Os identificadores marcados [REG] nas tabelas de critérios.
 *
 * A linha de uma tabela de critério começa com `| AC-XXX-nn` e traz as marcas na
 * última coluna. As seções de evidência mais abaixo no documento também citam
 * `**[REG]**` ao lado do mesmo identificador, e por isso o casamento exige o
 * identificador no **começo** da célula: sem isso, uma linha de evidência
 * entraria na lista e o número de critérios passaria a depender de quantas vezes
 * alguém documentou a prova.
 *
 * @param {string} markdown
 * @returns {Array<string>}
 */
function criteriosDeRegressao(markdown) {
  const encontrados = [...markdown.matchAll(/^\|\s*(AC-[A-Z]+-\d+)\s*[^|]*\|([^|]*)\|([^|]*)\|/gm)]
    .filter(([, , , marcas]) => marcas.includes('[REG]'))
    .map(([, identificador]) => identificador);

  return [...new Set(encontrados)];
}

/** Todo arquivo de teste da suíte — os do `src/` e os de `tests/`. */
function arquivosDeTeste(diretorio, encontrados = []) {
  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, entrada.name);

    if (entrada.isDirectory()) {
      if (entrada.name !== 'node_modules') arquivosDeTeste(caminho, encontrados);
    } else if (/\.(test|spec)\.jsx?$/.test(entrada.name)) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

/**
 * Os títulos de `it`, `test` e `describe` de um texto de teste.
 *
 * A expressão aceita as três aspas e os modificadores (`describe.only`, e o
 * `it.each([...])` com a tabela entre o modificador e o título) e para na
 * primeira aspa do mesmo tipo que não esteja escapada. Ela não é um parser de
 * JavaScript e não precisa ser: um título que ela deixe passar é um título a
 * menos na busca, e o efeito disso é um critério apontado como descoberto —
 * falha para o lado seguro.
 */
function titulosDeTeste(texto) {
  const padrao =
    /\b(?:it|test|describe)(?:\.[a-z]+(?:\([^)]*\))?)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

  return [...texto.matchAll(padrao)].map(([, , titulo]) => titulo);
}

/**
 * Quais critérios não são nomeados por título de teste nenhum.
 *
 * @param {Array<string>} criterios
 * @param {Array<{arquivo: string, titulos: Array<string>}>} suite
 * @returns {Array<string>}
 */
function criteriosSemTeste(criterios, suite) {
  return criterios.filter(
    (criterio) => !suite.some(({ titulos }) => titulos.some((titulo) => titulo.includes(criterio)))
  );
}

/** A suíte de verdade, lida uma vez. */
function lerSuite() {
  return [...arquivosDeTeste(path.join(RAIZ, 'src')), ...arquivosDeTeste(path.join(RAIZ, 'tests'))]
    .map((arquivo) => ({
      arquivo: path.relative(RAIZ, arquivo),
      titulos: titulosDeTeste(fs.readFileSync(arquivo, 'utf8')),
    }));
}

describe('o detector', () => {
  const TABELA = [
    '| AC | Descrição | Escopo |',
    '|---|---|---|',
    '| AC-AUTH-01 ✅ | Cadastro cria o documento. | [MVP] [REG] |',
    '| AC-AUTH-03 ✅ | Entrar com Google. | [MVP] |',
    '| AC-TEMPO-08 ✅ | Horário em string ISO continua legível. | [MVP] [REG] |',
    '',
    '| AC-AUTH-01 | **[REG]** `src/__tests__/algum.test.js:12` — a prova |',
  ].join('\n');

  it('acha os critérios marcados [REG] e ignora os outros', () => {
    expect(criteriosDeRegressao(TABELA)).toEqual(['AC-AUTH-01', 'AC-TEMPO-08']);
  });

  it('não confunde a linha de evidência com um critério', () => {
    // A última linha da tabela acima cita `**[REG]**` ao lado de AC-AUTH-01. Se
    // ela entrasse na lista, o total de critérios passaria a depender de quantas
    // vezes alguém documentou a prova — e o teste mediria o documento, não o
    // projeto.
    expect(criteriosDeRegressao(TABELA)).toHaveLength(2);
  });

  it('aponta o critério que nenhum título de teste nomeia', () => {
    const suite = [
      { arquivo: 'src/__tests__/a.test.js', titulos: ['cadastra e grava (AC-AUTH-01)'] },
    ];

    expect(criteriosSemTeste(['AC-AUTH-01', 'AC-TEMPO-08'], suite)).toEqual(['AC-TEMPO-08']);
  });

  it('não aceita a menção em comentário como teste', () => {
    // O caso que motiva a regra: o arquivo fala do critério no topo, e nenhum
    // teste dele o exercita. `titulosDeTeste` só enxerga títulos, então a
    // menção solta não conta.
    const arquivo = [
      '// Cobre o AC-TEMPO-08: horário em string ISO.',
      "it('ordena a fila', () => {});",
    ].join('\n');

    expect(titulosDeTeste(arquivo)).toEqual(['ordena a fila']);
    expect(
      criteriosSemTeste(['AC-TEMPO-08'], [{ arquivo: 'x.test.js', titulos: titulosDeTeste(arquivo) }])
    ).toEqual(['AC-TEMPO-08']);
  });

  it('enxerga título em aspas simples, duplas e template', () => {
    const arquivo = [
      "it('um (AC-A-01)', () => {});",
      'test("dois (AC-A-02)", () => {});',
      'describe(`três (AC-A-03)`, () => {});',
      "it.each([1])('quatro (AC-A-04)', () => {});",
    ].join('\n');

    expect(titulosDeTeste(arquivo)).toEqual([
      'um (AC-A-01)',
      'dois (AC-A-02)',
      'três (AC-A-03)',
      'quatro (AC-A-04)',
    ]);
  });
});

describe('o repositório', () => {
  const criterios = criteriosDeRegressao(fs.readFileSync(CAMINHO_CRITERIOS, 'utf8'));

  it('tem os critérios [REG] que o documento declara', () => {
    // A guarda contra o teste vazio: com a expressão errada, `criterios` vem
    // vazio e o `forEach` abaixo não afirmaria nada sobre nada.
    expect(criterios).toHaveLength(CRITERIOS_DE_REGRESSAO_ESPERADOS);
  });

  it('nomeia cada critério [REG] em pelo menos um título de teste (AC-TEST-10)', () => {
    expect(criteriosSemTeste(criterios, lerSuite())).toEqual([]);
  });

  it('lê uma suíte de verdade, e não uma lista vazia de arquivos', () => {
    const suite = lerSuite();

    expect(suite.length).toBeGreaterThan(80);
    expect(suite.reduce((soma, { titulos }) => soma + titulos.length, 0)).toBeGreaterThan(1000);
  });
});
