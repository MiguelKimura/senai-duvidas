// Jest dos testes de Security Rules.
//
// Config separada da suíte unitária de propósito: estes testes rodam em Node,
// falam com o Firebase Emulator Suite por rede local e não carregam nem o
// jsdom nem os mocks de `src/__mocks__/`. Misturar os dois faria os mocks
// manuais do Firebase sequestrarem o SDK real que o emulador precisa.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/rules'],
  testMatch: ['**/*.test.js'],
  // Polyfill de `fetch`: o Jest 27 nao o expoe no ambiente `node`. Ver setup.js.
  setupFiles: ['<rootDir>/tests/rules/setup.js'],
  // O emulador pode demorar na primeira consulta enquanto compila as rules.
  testTimeout: 20000,
  // Em serie, obrigatoriamente: os arquivos de teste de Firestore dividem o
  // MESMO emulador e cada um chama `clearFirestore()` entre os testes. Em
  // paralelo, a limpeza de um apaga o cenario do outro no meio da asserção —
  // uma falha que aparece e some conforme a ordem de agendamento.
  maxWorkers: 1,
};
