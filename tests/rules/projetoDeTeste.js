// Guarda de segurança dos testes de integração.
//
// O erro mais caro que esta suíte poderia cometer é rodar contra o projeto de
// produção `senai-duvidas` — os testes apagam coleções inteiras, e há turma em
// aula. Toda conexão passa por aqui, e aqui se recusa qualquer projectId que
// não seja o de teste.
const PROJETO_DE_TESTE = 'demo-senai-duvidas';
const PROJETO_DE_PRODUCAO = 'senai-duvidas';

/**
 * Devolve o projectId de teste depois de provar que não é o de produção.
 * O prefixo `demo-` é o que faz o SDK do Firebase se recusar a falar com a
 * nuvem: projetos `demo-*` só existem no emulador.
 */
function projetoDeTeste() {
  if (PROJETO_DE_TESTE === PROJETO_DE_PRODUCAO) {
    throw new Error('O projeto de teste não pode ser o de produção.');
  }

  if (!PROJETO_DE_TESTE.startsWith('demo-')) {
    throw new Error(
      `projectId "${PROJETO_DE_TESTE}" não começa com "demo-": o SDK poderia sair para a rede.`
    );
  }

  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_EMULATOR_HUB) {
    throw new Error(
      'Nenhum emulador detectado. Rode via `npm run test:rules`, que sobe a suíte antes.'
    );
  }

  return PROJETO_DE_TESTE;
}

module.exports = { projetoDeTeste, PROJETO_DE_TESTE, PROJETO_DE_PRODUCAO };
