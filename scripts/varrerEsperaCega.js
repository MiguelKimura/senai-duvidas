#!/usr/bin/env node
/*
 * A varredura de espera cega na suíte end-to-end — AC-TEST-09.
 *
 * Uso:
 *   node scripts/varrerEsperaCega.js          (varre tests/e2e e sai != 0 se achar)
 *
 * O AC-TEST-09 diz que os testes são determinísticos: "sem `sleep` arbitrário, sem
 * dependência de relógio real". Na suíte unitária o relógio fake do Jest torna a
 * violação difícil de escrever por acidente. Na suíte e2e é o contrário:
 * `page.waitForTimeout(500)` é a primeira coisa que se escreve quando um teste
 * falha de forma intermitente, funciona na hora, e cobra duas vezes — meio segundo
 * em **toda** execução, somado ao orçamento de 5 minutos do AC-TEST-08, e a mesma
 * falha de volta no runner mais lento, agora sem sintoma para investigar.
 *
 * `tests/e2e/fixtures/app.js` afirmava no comentário do topo que a pasta era
 * varrida para garantir isso. A auditoria da 1.0.0 encontrou a afirmação sem a
 * varredura. Este arquivo é a varredura.
 *
 * A distinção que ela precisa fazer, e que é a razão de ela morar num módulo com
 * teste próprio em vez de ser um `grep`:
 *
 *   * `await page.waitForTimeout(500)` e `await new Promise((r) => setTimeout(r, 500))`
 *     são **esperas cegas**: escolhem uma duração e apostam nela.
 *   * `test.setTimeout(120000)` é um **teto**: ele não espera nada, e tirá-lo
 *     deixaria um `waitFor` que nunca resolve pendurar o CI. É o oposto do
 *     defeito, e um `grep setTimeout` reprovaria os dois.
 *   * um `setTimeout` dentro de um laço cuja condição de parada é o mundo
 *     respondendo é **sondagem**, não sono: a duração é o passo entre tentativas,
 *     e a espera termina quando a condição vira verdadeira.
 *
 * Comentários não contam. Um comentário que explica por que `waitForTimeout` não
 * é usado não pode reprovar o arquivo — e um que possa transforma a varredura em
 * algo que se burla escrevendo menos documentação.
 */
const fs = require('node:fs');
const path = require('node:path');

/** A pasta varrida. */
const PASTA_E2E = path.join(__dirname, '..', 'tests', 'e2e');

/**
 * As esperas cegas, uma por padrão, com o motivo que vai na mensagem de falha.
 *
 * `setTimeout` só é apontado quando está dentro de um `new Promise`, que é a
 * forma de transformá-lo em `await`. Sozinho ele é agendamento — o teto do
 * Playwright, o desfazer de cinco segundos do app — e não espera ninguém.
 */
const PADROES = [
  {
    padrao: /\.waitForTimeout\s*\(/,
    motivo: 'waitForTimeout: espere por condição (um elemento, um texto, um valor no banco)',
  },
  {
    padrao: /new Promise\s*\([^)]*\)?\s*=>\s*setTimeout|new Promise\s*\(\s*setTimeout/,
    motivo: 'setTimeout embrulhado em Promise: é um sleep com outro nome',
  },
  {
    padrao: /new Date\(\s*\)/,
    motivo: 'new Date() sem argumento: o instante do cenário vem de uma constante da fixture',
  },
];

/**
 * O código de um arquivo sem os comentários.
 *
 * Bloco (`/* … *\/`), linha (`//`) e o corpo de um JSDoc, cujas linhas começam
 * com `*`. A substituição preserva a quantidade de linhas — as posições precisam
 * continuar valendo para a mensagem apontar o lugar certo.
 *
 * Strings não são tratadas: um `'// isto'` dentro de uma string viraria linha
 * vazia. Nenhum arquivo da suíte tem um, e tratar strings pediria um parser —
 * custo alto para um risco que não se materializa aqui.
 *
 * @param {string} texto
 * @returns {string}
 */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_todo, antes) => antes);
}

/**
 * As esperas cegas de um texto de código, já sem comentários.
 *
 * @param {string} texto o conteúdo do arquivo.
 * @returns {Array<{numero: number, linha: string, motivo: string}>}
 */
function esperasCegasEm(texto) {
  return semComentarios(texto)
    .split('\n')
    .flatMap((linha, indice) =>
      PADROES.filter(({ padrao }) => padrao.test(linha)).map(({ motivo }) => ({
        numero: indice + 1,
        linha: linha.trim(),
        motivo,
      }))
    );
}

/**
 * Os arquivos `.js` da suíte e2e, recursivamente.
 *
 * As fixtures entram de propósito: uma espera cega em `fixtures/app.js` é pior do
 * que uma num spec, porque ela se paga em todos os testes que chamam o helper.
 *
 * @param {string} [pasta]
 * @returns {Array<string>} caminhos absolutos.
 */
function arquivosDaSuite(pasta = PASTA_E2E) {
  return fs
    .readdirSync(pasta, { withFileTypes: true })
    .flatMap((entrada) => {
      const caminho = path.join(pasta, entrada.name);

      if (entrada.isDirectory()) return arquivosDaSuite(caminho);

      return entrada.isFile() && entrada.name.endsWith('.js') ? [caminho] : [];
    })
    .sort();
}

/** O caminho relativo à raiz, com barra normal: é o que serve numa mensagem. */
function relativo(caminho) {
  return path.relative(path.join(__dirname, '..'), caminho).replace(/\\/g, '/');
}

/**
 * As exceções, nomeadas uma por uma com o que as justifica.
 *
 * Nomeadas, e não cobertas por um padrão amplo: cada exceção nova precisa passar
 * por este arquivo e ganhar uma frase. A `prova` é o que impede a licença de
 * sobreviver ao motivo — se o laço de sondagem sair de `emulador.js`, a exceção
 * dele para de valer e o arquivo volta a ser reprovado.
 */
const EXCECOES = [
  {
    arquivo: 'tests/e2e/fixtures/emulador.js',
    // O passo do laço que espera os três emuladores subirem. A condição de parada
    // é uma porta respondendo, e o teto existe para o laço não ser infinito.
    prova: /while\s*\(!\(await/,
    motivo: 'sondagem: o laço para quando a porta responde, não quando o tempo passa',
  },
  {
    arquivo: 'tests/e2e/fixtures/cenario.js',
    // O chat da sala mostra só a conversa do dia corrente (AC-TEMPO-07): uma
    // mensagem semeada numa data fixa ficaria atrás de "Ver dias anteriores", e o
    // spec do chat testaria a paginação em vez do envio. O "hoje" aqui é o de
    // Brasília, calculado pelo mesmo caminho de `src/services/tempo.js`.
    prova: /hojeEmBrasiliaAs/,
    motivo: 'o cenário do chat precisa ser de hoje, e "hoje" é o de Brasília',
  },
];

/**
 * Varre a suíte inteira.
 *
 * @returns {{ok: boolean, arquivos: number, problemas: Array<string>}}
 */
function varrer() {
  const arquivos = arquivosDaSuite();
  const problemas = arquivos.flatMap((caminho) => {
    const nome = relativo(caminho);
    const texto = fs.readFileSync(caminho, 'utf8');
    const excecao = EXCECOES.find((candidata) => candidata.arquivo === nome);

    if (excecao) {
      if (excecao.prova.test(texto)) return [];

      return [`${nome}: a exceção "${excecao.motivo}" não se sustenta mais neste arquivo`];
    }

    return esperasCegasEm(texto).map(
      ({ numero, linha, motivo }) => `${nome}:${numero}: ${motivo}\n    ${linha}`
    );
  });

  return { ok: problemas.length === 0, arquivos: arquivos.length, problemas };
}

if (require.main === module) {
  const { ok, arquivos, problemas } = varrer();

  if (ok) {
    process.stdout.write(`${arquivos} arquivos da suíte e2e, nenhuma espera cega.\n`);
  } else {
    process.stderr.write(`Espera cega na suíte e2e (AC-TEST-09):\n\n${problemas.join('\n')}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  EXCECOES,
  PADROES,
  PASTA_E2E,
  arquivosDaSuite,
  esperasCegasEm,
  relativo,
  semComentarios,
  varrer,
};
