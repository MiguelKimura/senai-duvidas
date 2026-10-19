// Fake do `firebase/app`. Guarda a configuração recebida para que os testes de
// `src/firebase.js` possam afirmar qual config foi usada — é assim que o
// AC-AUTH-10 (config por REACT_APP_*, com fallback) fica provado nos dois
// caminhos: com e sem variáveis de ambiente definidas.

let configuracoes = [];

export function initializeApp(config) {
  configuracoes.push(config);

  return { name: '[DEFAULT]', options: config };
}

export function getApp() {
  return { name: '[DEFAULT]', options: configuracoes[configuracoes.length - 1] };
}

/** Configuração da última chamada a `initializeApp`. */
export function __ultimaConfiguracao() {
  return configuracoes[configuracoes.length - 1];
}

export function __resetarApp() {
  configuracoes = [];
}
