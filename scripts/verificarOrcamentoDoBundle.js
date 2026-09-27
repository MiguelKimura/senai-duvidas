#!/usr/bin/env node
/*
 * Orçamento do bundle inicial — AC-PERF-02.
 *
 * Uso:
 *   npm run build && npm run orcamento
 *   node scripts/verificarOrcamentoDoBundle.js [--teto=307200] [--build=build]
 *
 * Sai com código 1 quando o orçamento é estourado. É essa linha que faz o
 * critério existir: o bundle já estava em 219 KB antes desta versão, e isso não
 * significava nada, porque nada media e nada quebrava se estourasse. Um
 * orçamento sem alarme é uma frase num documento.
 *
 * O desenho segue o de `scripts/gerarChangelog.js`: funções puras aqui,
 * testadas em `scripts/__tests__/`, e uma casca no fim que lê `process.argv` e
 * escreve na saída. A casca não tem regra nenhuma.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

/** O teto do critério: 300 KB gzip no que o navegador baixa para abrir a tela. */
const TETO_INICIAL_EM_BYTES = 300 * 1024;

/**
 * Quantos pedaços de rota o build precisa ter, no mínimo.
 *
 * Um. A intenção não é contar rotas — é distinguir "dividido" de "monolítico".
 * Exigir oito amarraria o verificador ao número de telas de hoje, e a primeira
 * fusão de duas rotas reprovaria um build correto.
 */
const MINIMO_DE_CHUNKS = 1;

const MANIFESTO = 'asset-manifest.json';

/** Lê o `asset-manifest.json` do build, com erro legível quando não há build. */
function lerManifesto(diretorio) {
  const caminho = path.join(diretorio, MANIFESTO);

  if (!fs.existsSync(caminho)) {
    throw new Error(
      `Não achei ${MANIFESTO} em ${diretorio}. Rode \`npm run build\` antes de medir o orçamento.`
    );
  }

  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

/**
 * Um caminho do manifesto virado caminho de arquivo.
 *
 * O CRA escreve `/static/js/main.js` quando `homepage` não está definido, e
 * `path.join(raiz, '/static/...')` no Windows produz um caminho que não existe.
 * A barra sai aqui, uma vez, em vez de em cada chamador.
 */
function caminhoNoDisco(diretorio, referencia) {
  return path.join(diretorio, referencia.replace(/^\//, '').split('/').join(path.sep));
}

/** Os bytes gzip de um arquivo, no nível que um servidor estático usa. */
function bytesGzip(caminho) {
  return zlib.gzipSync(fs.readFileSync(caminho), { level: 9 }).length;
}

/**
 * O que o navegador baixa para abrir a **primeira** tela.
 *
 * São os `entrypoints` do manifesto, e só eles: os pedaços de rota são baixados
 * quando a rota é visitada, e contá-los aqui mediria o app inteiro, que é
 * exatamente o número que a divisão existe para não ser mais o relevante.
 *
 * @param {string} diretorio a raiz do build.
 * @returns {Array<{nome: string, bytes: number, gzip: number}>}
 */
function medirEntrypoints(diretorio) {
  const { entrypoints = [] } = lerManifesto(diretorio);

  return entrypoints.map((referencia) => {
    const caminho = caminhoNoDisco(diretorio, referencia);

    return {
      nome: referencia.replace(/^\//, ''),
      bytes: fs.statSync(caminho).size,
      gzip: bytesGzip(caminho),
    };
  });
}

/**
 * Os pedaços de JavaScript que **não** são entrypoint.
 *
 * É a assinatura da divisão por rota no disco: sem `lazy`, o webpack emite um
 * `main.js` e nada mais.
 *
 * @param {string} diretorio a raiz do build.
 * @returns {Array<{nome: string, gzip: number}>}
 */
function chunksDeRota(diretorio) {
  const { entrypoints = [] } = lerManifesto(diretorio);
  const doEntrypoint = new Set(entrypoints.map((referencia) => path.basename(referencia)));
  const pastaJs = path.join(diretorio, 'static', 'js');

  if (!fs.existsSync(pastaJs)) return [];

  return fs
    .readdirSync(pastaJs)
    .filter((nome) => nome.endsWith('.js') && !doEntrypoint.has(nome))
    .map((nome) => ({ nome, gzip: bytesGzip(path.join(pastaJs, nome)) }));
}

/**
 * As duas metades do AC-PERF-02, medidas juntas.
 *
 * São independentes de propósito: um app pequeno e monolítico cabe no teto hoje
 * e volta a não caber na primeira tela nova. É a divisão que mantém o teto
 * verdadeiro com o tempo, então um build sem divisão reprova mesmo cabendo.
 *
 * @param {{diretorio?: string, teto?: number, minimoDeChunks?: number}} opcoes
 * @returns {{dentroDoOrcamento: boolean, gzipTotal: number, teto: number,
 *   entrypoints: Array<object>, chunks: Array<object>, motivos: string[]}}
 */
function verificarOrcamento({
  diretorio = 'build',
  teto = TETO_INICIAL_EM_BYTES,
  minimoDeChunks = MINIMO_DE_CHUNKS,
} = {}) {
  const entrypoints = medirEntrypoints(diretorio);
  const chunks = chunksDeRota(diretorio);
  const gzipTotal = entrypoints.reduce((soma, { gzip }) => soma + gzip, 0);

  const motivos = [];

  if (gzipTotal > teto) {
    motivos.push(
      `o bundle inicial estourou o orçamento: ${emKB(gzipTotal)} gzip contra um teto de ${emKB(teto)}`
    );
  }

  if (chunks.length < minimoDeChunks) {
    motivos.push(
      `não há divisão por rota: ${chunks.length} pedaço(s) além do entrypoint, ` +
        `e o mínimo é ${minimoDeChunks}`
    );
  }

  return {
    dentroDoOrcamento: motivos.length === 0,
    gzipTotal,
    teto,
    entrypoints,
    chunks,
    motivos,
  };
}

/** Bytes em KB com uma casa, do jeito que o próprio CRA imprime. */
function emKB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

/**
 * O relatório que vai para o log do CI.
 *
 * Ele imprime o número mesmo quando aprova. Quem está olhando um PR que mexeu em
 * dependência quer ver a folga, não um "ok" — é a folga que diz se a próxima
 * biblioteca cabe.
 *
 * @param {object} resultado a saída de `verificarOrcamento`.
 * @returns {string}
 */
function relatorio(resultado) {
  const { dentroDoOrcamento, gzipTotal, teto, entrypoints, chunks, motivos } = resultado;

  const linhas = ['Orçamento do bundle inicial (AC-PERF-02)', ''];

  entrypoints.forEach(({ nome, gzip }) => {
    linhas.push(`  ${emKB(gzip).padStart(10)} gzip  ${nome}`);
  });

  linhas.push('');
  linhas.push(`  total inicial: ${emKB(gzipTotal)} gzip  (teto: ${emKB(teto)})`);
  linhas.push(`  folga:         ${emKB(teto - gzipTotal)}`);
  linhas.push(`  pedaços de rota carregados sob demanda: ${chunks.length}`);

  if (!dentroDoOrcamento) {
    linhas.push('');
    motivos.forEach((motivo) => linhas.push(`  ✗ ${motivo}`));
  }

  return `${linhas.join('\n')}\n`;
}

function principal(argumentos) {
  const opcao = (nome, padrao) => {
    const encontrado = argumentos.find((argumento) => argumento.startsWith(`--${nome}=`));

    return encontrado ? encontrado.split('=')[1] : padrao;
  };

  const resultado = verificarOrcamento({
    diretorio: opcao('build', 'build'),
    teto: Number(opcao('teto', TETO_INICIAL_EM_BYTES)),
  });

  process.stdout.write(relatorio(resultado));

  if (!resultado.dentroDoOrcamento) process.exitCode = 1;
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = {
  MINIMO_DE_CHUNKS,
  TETO_INICIAL_EM_BYTES,
  chunksDeRota,
  medirEntrypoints,
  relatorio,
  verificarOrcamento,
};
