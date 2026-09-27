#!/usr/bin/env node
/*
 * O ciclo red-green-refactor, lido no histórico de commits — AC-TEST-02.
 *
 * Uso:
 *   node scripts/verificarCicloTdd.js                 (origin/dev..HEAD)
 *   node scripts/verificarCicloTdd.js origin/dev..HEAD
 *
 * O AC-TEST-02 não diz "escreva os testes antes": diz que o ciclo precisa estar
 * **comprovado no histórico de commits**. Isso é verificável, e não estava sendo
 * verificado por nada — o `tasks/_PROTOCOLO.md` pede um commit por ciclo, e o
 * único jeito de saber se a regra foi seguida era alguém abrir o `git log`.
 *
 * A regra, e por que é esta:
 *
 *   **Todo commit de implementação vem imediatamente depois de um commit de
 *   teste.** Implementação é `feat`, `fix` e `perf`. "Imediatamente" ignora
 *   `docs`, `chore`, `style`, `ci` e `build`, que não mudam comportamento e
 *   aparecem no meio de um ciclo sem o interromper.
 *
 * O que esta regra pega, e é o que ela existe para pegar: o commit gigante no
 * fim, com o código e os testes juntos, e a implementação que entra sem teste
 * nenhum para ser reprovada por ele depois.
 *
 * O que ela não pega: um commit `test` cujo teste passava de primeira. Nenhuma
 * leitura de histórico pega isso — só a revisão humana do teste, lendo se ele
 * falharia sem a implementação. Por isso ela é um piso, e não a garantia.
 *
 * Por que não exigir o mesmo **escopo** entre o teste e a implementação: porque
 * o teste que reprova uma tela é, muitas vezes, de outro escopo que o conserto.
 * Nesta versão um `test(e2e)` de chat encontrou um defeito no painel de cor, e o
 * conserto virou `fix(cor)`. Exigir escopo igual reprovaria o ciclo mais valioso
 * dos dois — o teste de fora que acha o que o teste de dentro não vê.
 */
const { execFileSync } = require('node:child_process');

/** Os tipos que mudam comportamento de produção. */
const TIPOS_DE_IMPLEMENTACAO = ['feat', 'fix', 'perf'];

/**
 * Os tipos que podem aparecer entre o teste e a implementação sem quebrar o par.
 *
 * `refactor` **não** está aqui de propósito: ele fecha um ciclo, e o que vem
 * depois dele é outro ciclo, que precisa do próprio teste.
 */
const TIPOS_NEUTROS = ['docs', 'chore', 'style', 'ci', 'build'];

const PADRAO_DE_ASSUNTO = /^(?<tipo>[a-z]+)(?:\((?<escopo>[^)]*)\))?!?: (?<resumo>.+)$/;

/**
 * Um assunto de commit repartido em tipo, escopo e resumo.
 *
 * @param {string} assunto
 * @returns {{tipo: string|null, escopo: string|null, resumo: string, assunto: string}}
 */
function classificar(assunto) {
  const encontrado = PADRAO_DE_ASSUNTO.exec(assunto.trim());

  if (!encontrado) return { tipo: null, escopo: null, resumo: assunto.trim(), assunto };

  const { tipo, escopo, resumo } = encontrado.groups;

  return { tipo, escopo: escopo || null, resumo, assunto };
}

/**
 * Verifica a ordem do ciclo numa lista de assuntos, do mais antigo ao mais novo.
 *
 * @param {Array<string>} assuntos
 * @returns {{ok: boolean, ciclos: number, implementacoes: number, problemas: Array<string>}}
 */
function verificarOrdem(assuntos) {
  const commits = assuntos.map(classificar);
  const problemas = [];

  let anterior = null;
  let ciclos = 0;

  commits.forEach((commit) => {
    const { tipo, assunto } = commit;

    if (tipo === null) {
      problemas.push(`fora do padrão Conventional Commits: "${assunto}"`);

      return;
    }

    if (TIPOS_NEUTROS.includes(tipo)) return;

    if (TIPOS_DE_IMPLEMENTACAO.includes(tipo)) {
      if (anterior && anterior.tipo === 'test') ciclos += 1;
      else {
        problemas.push(
          `"${assunto}" implementa sem um commit de teste imediatamente antes ` +
            `(o anterior é ${anterior ? `"${anterior.assunto}"` : 'o começo da branch'})`
        );
      }
    }

    anterior = commit;
  });

  const implementacoes = commits.filter(({ tipo }) =>
    TIPOS_DE_IMPLEMENTACAO.includes(tipo)
  ).length;

  if (commits.length > 0 && !commits.some(({ tipo }) => tipo === 'test')) {
    problemas.push('nenhum commit de teste na branch: não há ciclo nenhum para comprovar');
  }

  return { ok: problemas.length === 0, ciclos, implementacoes, problemas };
}

/** O relatório que o CI imprime. */
function relatorio(resultado, intervalo) {
  const { ok, ciclos, implementacoes, problemas } = resultado;

  const linhas = [
    `Ciclo red-green-refactor no histórico de ${intervalo} (AC-TEST-02)`,
    '',
    `  commits de implementação: ${implementacoes}`,
    `  precedidos por um commit de teste: ${ciclos}`,
  ];

  if (!ok) {
    linhas.push('');
    problemas.forEach((problema) => linhas.push(`  ✗ ${problema}`));
  }

  return `${linhas.join('\n')}\n`;
}

/** Os assuntos de um intervalo do git, do mais antigo ao mais novo. */
function assuntosDoIntervalo(intervalo) {
  const saida = execFileSync('git', ['log', '--reverse', '--no-merges', '--pretty=%s', intervalo], {
    encoding: 'utf8',
  });

  return saida.split('\n').filter((linha) => linha.trim() !== '');
}

function principal(argumentos) {
  const intervalo = argumentos.find((argumento) => !argumento.startsWith('--')) || 'origin/dev..HEAD';
  const resultado = verificarOrdem(assuntosDoIntervalo(intervalo));

  process.stdout.write(relatorio(resultado, intervalo));

  if (!resultado.ok) process.exitCode = 1;
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = {
  TIPOS_DE_IMPLEMENTACAO,
  TIPOS_NEUTROS,
  assuntosDoIntervalo,
  classificar,
  relatorio,
  verificarOrdem,
};
