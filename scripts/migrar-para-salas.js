#!/usr/bin/env node
/*
 * Esqueleto da migração dos dados globais para dentro de uma sala — task 03.
 *
 * O teste em `scripts/__tests__/migrar-para-salas.test.js` descreve o plano, a
 * idempotência e a reversão. Nada disso existe ainda.
 */

module.exports = {
  CAMPO_DE_ORIGEM: 'migradoDe',
  escolherDono: () => null,
  executarPlano: async () => ({}),
  formatarRelatorio: () => '',
  lerOpcoes: () => ({}),
  nomeDaSalaGeral: () => '',
  planejarMigracao: () => ({}),
  planejarReversao: () => ({}),
};
