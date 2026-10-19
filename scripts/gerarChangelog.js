#!/usr/bin/env node
/*
 * Gera a seção de uma versão do CHANGELOG.md a partir dos commits — AC-CI-09.
 *
 * Uso:
 *   node scripts/gerarChangelog.js <base>..<head>     (imprime na saída padrão)
 *   npm run changelog -- origin/dev..HEAD
 *
 * A versão e a data saem do package.json e do relógio, mas podem ser passadas
 * por `--versao` e `--data` para que a saída seja reproduzível.
 *
 * O desenho separa duas coisas: as funções puras abaixo, que transformam uma
 * lista de assuntos de commit em Markdown e são testadas em
 * `scripts/__tests__/`, e a casca no fim do arquivo, que chama o git. Só a
 * primeira parte tem regra de negócio; a segunda é encanamento.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/** As seções do Keep a Changelog, na ordem em que aparecem no arquivo. */
const SECOES = [
  'Adicionado',
  'Alterado',
  'Descontinuado',
  'Removido',
  'Corrigido',
  'Segurança',
];

/*
 * Onde cada tipo de commit desemboca.
 *
 * `docs`, `test`, `chore`, `build`, `ci`, `refactor`, `perf` e `style` caem
 * todos em "Alterado". Poderiam ganhar seções próprias, mas o Keep a Changelog
 * define um vocabulário fechado de propósito: quem lê um changelog quer saber
 * o que mudou para ele, não como o time organiza o trabalho interno.
 */
const DESTINO_POR_TIPO = {
  feat: 'Adicionado',
  fix: 'Corrigido',
  perf: 'Alterado',
  refactor: 'Alterado',
  style: 'Alterado',
  docs: 'Alterado',
  test: 'Alterado',
  build: 'Alterado',
  ci: 'Alterado',
  chore: 'Alterado',
  release: 'Alterado',
};

// `String.raw`: sem ele, o `\(` do template literal viraria um `(` solto e o
// escopo deixaria de ser um grupo — o padrão casaria errado, em silêncio.
const PADRAO_CONVENCIONAL = new RegExp(
  String.raw`^(${Object.keys(DESTINO_POR_TIPO).join('|')})(?:\(([^)]+)\))?(!)?: (.+)$`
);

/**
 * Quebra o assunto de um commit convencional em suas partes.
 * Devolve `null` para qualquer coisa fora do padrão — inventar um tipo para
 * um "ajustes gerais" seria mentir no changelog.
 */
function classificar(assunto) {
  const encontrado = PADRAO_CONVENCIONAL.exec(String(assunto).trim());

  if (!encontrado) return null;

  const [, tipo, escopo, quebra, descricao] = encontrado;

  return { tipo, escopo: escopo || null, descricao, quebra: Boolean(quebra) };
}

/** Uma linha do changelog: `**escopo:** descrição`, com o aviso de quebra na frente. */
function formatarItem({ escopo, descricao, quebra }) {
  const corpo = escopo ? `**${escopo}:** ${descricao}` : descricao;

  return quebra ? `**BREAKING** ${corpo}` : corpo;
}

/**
 * Agrupa assuntos de commit nas seções do Keep a Changelog.
 * Seção sem item não aparece no resultado: cabeçalho vazio é ruído.
 */
function agruparPorSecao(assuntos) {
  const secoes = {};

  for (const assunto of assuntos) {
    const commit = classificar(assunto);

    if (!commit) continue;

    const destino = DESTINO_POR_TIPO[commit.tipo];

    (secoes[destino] = secoes[destino] || []).push(formatarItem(commit));
  }

  return secoes;
}

/** O Markdown da versão inteira, pronto para ser colado no topo do CHANGELOG. */
function gerarSecaoDaVersao({ versao, data, assuntos }) {
  const secoes = agruparPorSecao(assuntos);
  const linhas = [`## [${versao}] - ${data}`, ''];

  const comItens = SECOES.filter((nome) => secoes[nome] && secoes[nome].length > 0);

  if (comItens.length === 0) {
    linhas.push('Nenhuma mudança registrada em commits convencionais neste intervalo.', '');

    return linhas.join('\n');
  }

  for (const nome of comItens) {
    linhas.push(`### ${nome}`, '');

    for (const item of secoes[nome]) linhas.push(`- ${item}`);

    linhas.push('');
  }

  return linhas.join('\n');
}

/** Os assuntos dos commits de um intervalo do git, do mais antigo ao mais novo. */
function assuntosDoIntervalo(intervalo) {
  const saida = execFileSync('git', ['log', '--reverse', '--pretty=%s', intervalo], {
    encoding: 'utf8',
  });

  return saida.split('\n').filter((linha) => linha.trim() !== '');
}

function principal(argumentos) {
  const opcao = (nome, padrao) => {
    const posicao = argumentos.indexOf(`--${nome}`);

    return posicao === -1 ? padrao : argumentos[posicao + 1];
  };

  const intervalo =
    argumentos.find((argumento) => !argumento.startsWith('--')) || 'origin/dev..HEAD';
  const pacote = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );

  process.stdout.write(
    gerarSecaoDaVersao({
      versao: opcao('versao', pacote.version),
      data: opcao('data', new Date().toISOString().slice(0, 10)),
      assuntos: assuntosDoIntervalo(intervalo),
    })
  );
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = {
  SECOES,
  classificar,
  agruparPorSecao,
  gerarSecaoDaVersao,
  assuntosDoIntervalo,
};
