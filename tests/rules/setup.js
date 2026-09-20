// Polyfill de `fetch` para os testes de Security Rules.
//
// O react-scripts 5 traz o Jest 27, cujo ambiente `node` roda o código num
// contexto de VM com um conjunto fixo de globais. Vários globais que o Node 22
// tem de verdade não chegam lá dentro — entre eles `fetch` e os web streams.
//
// O `@firebase/rules-unit-testing` usa `fetch` para descobrir os emuladores e
// para limpar os dados entre os testes, então sem isto a suíte inteira morre
// em `initializeTestEnvironment` com "fetch is not defined".
//
// A ordem importa: `undici` é carregado por último, porque ele próprio precisa
// de `ReadableStream` já presente no escopo global.
//
// `undici` é a mesma implementação que o Node usa internamente para o `fetch`
// global, e está declarada como devDependency exatamente por causa disto.

// 1. Web streams, que o undici exige.
const streams = require('node:stream/web');

['ReadableStream', 'WritableStream', 'TransformStream', 'ByteLengthQueuingStrategy', 'CountQueuingStrategy'].forEach(
  (nome) => {
    if (typeof globalThis[nome] === 'undefined' && streams[nome]) {
      globalThis[nome] = streams[nome];
    }
  }
);

// 2. MessagePort/MessageChannel, usados pelo undici em respostas transferíveis.
const { MessageChannel, MessagePort } = require('node:worker_threads');

if (typeof globalThis.MessageChannel === 'undefined') globalThis.MessageChannel = MessageChannel;
if (typeof globalThis.MessagePort === 'undefined') globalThis.MessagePort = MessagePort;

// 3. Por fim, o fetch.
if (typeof globalThis.fetch === 'undefined') {
  const { fetch, FormData, Headers, Request, Response } = require('undici');

  Object.assign(globalThis, { fetch, FormData, Headers, Request, Response });
}
