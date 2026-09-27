// As regras de acessibilidade que o lint deixou de fora — AC-ANIM-10.
//
// O `.eslintrc.js` do projeto tem uma convenção que vale a pena preservar:
// regra que exigiria mudar comportamento fica desligada **no arquivo de
// configuração**, com um `TODO(task-NN)` apontando quem resolve, em vez de
// silenciada caso a caso no meio do código, onde ninguém mais acharia.
//
// Duas delas apontam para esta task. As duas nasceram do mesmo elemento: o
// ícone 👁️ de "ver imagem" era uma `<div>` com `onClick`, e quem navegava por
// teclado não alcançava o anexo. A task 04 já trocou aquela `<div>` por um
// `<button>` quando extraiu `AnexoDoCard` — o que sobrou foi o desligamento,
// que continua valendo para todo arquivo novo.
//
// Uma regra desligada por engano é pior do que uma regra que nunca existiu:
// ela dá a impressão de cobertura. Este teste existe para que o desligamento
// seja uma decisão consciente e datada, e não um resíduo — se alguém precisar
// desligar de novo, precisa passar por aqui e explicar.
const fs = require('fs');
const path = require('path');

const CAMINHO_ESLINTRC = path.join(__dirname, '..', '..', '.eslintrc.js');

// eslint-disable-next-line import/no-dynamic-require, global-require
const configuracao = require(CAMINHO_ESLINTRC);

/**
 * As regras que **precisam** estar valendo no fim desta task.
 *
 * Cada uma cobre um caminho de teclado que o `jsx-a11y` sabe conferir e que
 * nenhum teste de render alcança: o elemento clicável que não responde a
 * Enter, e o elemento sem papel que recebeu um `onClick`.
 */
const REGRAS_EXIGIDAS = [
  'jsx-a11y/click-events-have-key-events',
  'jsx-a11y/no-static-element-interactions',
  'jsx-a11y/no-noninteractive-element-interactions',
];

/** Uma regra vale quando não está em `off`/`0`. */
function estaLigada(valor) {
  if (valor === undefined) return true; // herdada do preset `recommended`
  const nivel = Array.isArray(valor) ? valor[0] : valor;
  return nivel !== 'off' && nivel !== 0;
}

describe('.eslintrc.js (AC-ANIM-10)', () => {
  it('estende o preset recomendado do jsx-a11y', () => {
    expect(configuracao.extends).toContain('plugin:jsx-a11y/recommended');
  });

  it.each(REGRAS_EXIGIDAS)('mantém %s valendo em src/', (regra) => {
    expect(estaLigada((configuracao.rules || {})[regra])).toBe(true);
  });

  it('não deixa TODO(task-08) para trás — esta é a task 08', () => {
    const texto = fs.readFileSync(CAMINHO_ESLINTRC, 'utf8');

    expect(texto).not.toMatch(/TODO\(task-08\)/);
  });
});
