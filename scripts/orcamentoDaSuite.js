#!/usr/bin/env node
/*
 * Orçamento de tempo da suíte completa — AC-TEST-08.
 *
 * Uso:
 *   node scripts/orcamentoDaSuite.js medir unit -- npm run test:ci
 *   node scripts/orcamentoDaSuite.js somar [--teto=300000] [--tempos=.tempos]
 *
 * O critério é "a suíte completa roda em menos de 5 minutos no CI". O que havia
 * antes era `timeout-minutes: 5` em cada job, e isso é outra coisa: impede um
 * job de pendurar o runner, e deixa cinco jobs somarem vinte e cinco minutos com
 * o CI verde.
 *
 * O desenho é o de `scripts/verificarOrcamentoDoBundle.js`: as funções puras
 * abaixo — `avaliar` e `relatorio` — carregam a regra e são testadas em
 * `src/__tests__/orcamentoDaSuite.test.js`; a casca no fim chama o
 * `child_process` e o disco, e não decide nada.
 *
 * Por que medir por etapa e somar depois, em vez de rodar tudo num job só: um
 * job único repetiria `npm ci`, o build e a subida do emulador que os outros já
 * fizeram, e cobraria do CI o dobro do tempo para medir o mesmo número. Cada job
 * cronometra o **seu** comando e publica o resultado como artefato; o último
 * soma.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/** O teto do AC-TEST-08. */
const TETO_DA_SUITE_EM_MS = 5 * 60 * 1000;

/**
 * As etapas que somadas são "a suíte completa".
 *
 * Três, e a ordem é a do pipeline. Uma suíte nova que não entre aqui faz o
 * orçamento medir menos do que existe, e é por isso que
 * `src/__tests__/orcamentoDaSuite.test.js` afirma sobre esta lista.
 */
const ETAPAS_DA_SUITE = ['unit', 'rules', 'e2e'];

/** Onde as medições são gravadas, uma por arquivo, para virar artefato do CI. */
const PASTA_DE_TEMPOS = '.tempos';

/** Milissegundos em minutos com uma casa, que é a unidade do critério. */
function emMinutos(ms) {
  return `${(ms / 60000).toFixed(1)} min`;
}

/**
 * Soma as medições e diz se a suíte cabe no orçamento.
 *
 * @param {Array<{nome: string, ms: number}>} medicoes
 * @param {number} [teto] em milissegundos.
 * @param {Array<string>} [exigidas] etapas que **precisam** estar presentes. Uma
 *   etapa ausente somaria zero e faria a suíte caber justamente quando ela não
 *   rodou: ausência é reprovação, não é folga.
 */
function avaliar(medicoes, teto = TETO_DA_SUITE_EM_MS, exigidas = []) {
  const total = medicoes.reduce((soma, { ms }) => soma + ms, 0);
  const presentes = medicoes.map(({ nome }) => nome);
  const faltando = exigidas.filter((etapa) => !presentes.includes(etapa));

  const motivos = [];

  if (total > teto) {
    motivos.push(`a suíte levou ${emMinutos(total)}, acima do teto de ${emMinutos(teto)}`);
  }

  faltando.forEach((etapa) => {
    motivos.push(`a etapa "${etapa}" não foi medida: sem ela o total não é o total`);
  });

  return {
    dentroDoOrcamento: motivos.length === 0,
    medicoes: [...medicoes].sort((a, b) => b.ms - a.ms),
    total,
    teto,
    faltando,
    motivos,
  };
}

/** O relatório que o CI imprime. */
function relatorio(resultado) {
  const { medicoes, total, teto, motivos } = resultado;

  const linhas = ['Orçamento de tempo da suíte completa (AC-TEST-08)', ''];

  medicoes.forEach(({ nome, ms }) => {
    linhas.push(`  ${emMinutos(ms).padStart(9)}  ${nome}`);
  });

  linhas.push('');
  linhas.push(`  total: ${emMinutos(total)}  (teto: ${emMinutos(teto)})`);

  if (motivos.length > 0) {
    linhas.push('');
    motivos.forEach((motivo) => linhas.push(`  ✗ ${motivo}`));
  }

  return `${linhas.join('\n')}\n`;
}

/** As medições gravadas em disco, ignorando o que não for medição. */
function lerMedicoes(diretorio) {
  if (!fs.existsSync(diretorio)) return [];

  return fs
    .readdirSync(diretorio)
    .filter((arquivo) => arquivo.endsWith('.json'))
    .map((arquivo) => JSON.parse(fs.readFileSync(path.join(diretorio, arquivo), 'utf8')))
    .filter(({ nome, ms }) => typeof nome === 'string' && Number.isFinite(ms));
}

// ---------------------------------------------------------------------------
// A casca
// ---------------------------------------------------------------------------

/**
 * Roda um comando, cronometra e grava o número.
 *
 * Devolve o código de saída do comando **sem tocá-lo**: o cronômetro não pode
 * transformar uma suíte vermelha em verde nem o contrário.
 */
function medir(nome, comando, diretorio) {
  const comeco = Date.now();
  const { status } = spawnSync(comando[0], comando.slice(1), {
    stdio: 'inherit',
    shell: true,
  });
  const ms = Date.now() - comeco;

  fs.mkdirSync(diretorio, { recursive: true });
  fs.writeFileSync(path.join(diretorio, `${nome}.json`), JSON.stringify({ nome, ms }));

  process.stdout.write(`\n[orçamento] ${nome}: ${emMinutos(ms)}\n`);

  return status === null ? 1 : status;
}

function principal(argumentos) {
  const opcao = (nome, padrao) => {
    const encontrado = argumentos.find((argumento) => argumento.startsWith(`--${nome}=`));

    return encontrado ? encontrado.split('=')[1] : padrao;
  };

  const [modo, ...resto] = argumentos;
  const diretorio = opcao('tempos', PASTA_DE_TEMPOS);

  if (modo === 'medir') {
    const separador = resto.indexOf('--');

    if (separador === -1) {
      throw new Error('Uso: orcamentoDaSuite.js medir <nome> -- <comando>');
    }

    process.exitCode = medir(resto[0], resto.slice(separador + 1), diretorio);

    return;
  }

  if (modo !== 'somar') {
    throw new Error(`Modo desconhecido: "${modo}". Use "medir" ou "somar".`);
  }

  const resultado = avaliar(
    lerMedicoes(diretorio),
    Number(opcao('teto', TETO_DA_SUITE_EM_MS)),
    ETAPAS_DA_SUITE
  );

  process.stdout.write(relatorio(resultado));

  if (!resultado.dentroDoOrcamento) process.exitCode = 1;
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = {
  ETAPAS_DA_SUITE,
  PASTA_DE_TEMPOS,
  TETO_DA_SUITE_EM_MS,
  avaliar,
  emMinutos,
  lerMedicoes,
  relatorio,
};
