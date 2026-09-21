#!/usr/bin/env node
/* Esqueleto do ciclo 14: as funções existem e não decidem nada ainda. */

function planejar(_documentos) {
  return { total: 0, aMigrar: [], jaTinham: 0, semAnexo: 0, ilegiveis: 0 };
}

async function migrar(_opcoes) {
  return { total: 0, atualizados: 0, jaTinham: 0, semAnexo: 0, ilegiveis: 0, falhas: [] };
}

function lerOpcoes(_argumentos) {
  return { simulacao: false, confirmado: false, reverter: false, colecoes: [] };
}

function formatarRelatorio(_relatorio) {
  return '';
}

module.exports = { planejar, migrar, lerOpcoes, formatarRelatorio };
