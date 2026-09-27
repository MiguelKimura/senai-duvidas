// `globalSetup` do Playwright: espera os três emuladores antes do primeiro teste.
//
// O `webServer` da configuração sobe o Emulator Suite e sabe esperar **uma** URL.
// A escolhida é a do Firestore, que é Java e abre a porta 8080 antes de o Auth
// abrir a 9099 e o Storage a 9199. Quando o Playwright libera a suíte, portanto,
// só um dos três está de pé.
//
// Até esta versão, quem completava a espera era `limparTudo()`, no `beforeEach` de
// cada spec. Funciona, e cobra a conta da pessoa errada: o tempo de subida entra
// no orçamento do primeiro teste que precise do banco. Numa máquina carregada
// esse tempo passa dos 60s do teto, o teste reprova em `beforeEach` — e, porque a
// promessa da sonda é memoizada, todos os testes que começam antes de os
// emuladores subirem aguardam a *mesma* promessa pendente e reprovam junto. Foi
// assim que seis testes corretos ficaram vermelhos de uma vez, com uma mensagem
// que aponta para eles e não para a causa.
//
// Aqui a espera acontece uma vez, antes de existir o primeiro teste, e com
// orçamento próprio: o teto de `ESPERA_MAXIMA_MS` da própria sonda, que desiste
// com uma mensagem dizendo qual emulador não subiu, em vez de o teto por teste,
// que desiste dizendo o nome de um teste que não tem culpa nenhuma.
// `limparTudo()` continua chamando a sonda — a chamada é idempotente e, com as
// portas já abertas, custa uma sondagem — mas já não é ela quem espera a subida.
//
// A regra está fixada em `src/__tests__/prontidaoDosEmuladores.test.js`.
const { aguardarEmuladores } = require('./fixtures/emulador');

module.exports = async () => {
  await aguardarEmuladores();
};
