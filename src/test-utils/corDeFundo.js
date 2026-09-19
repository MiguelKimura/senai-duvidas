// Suporte a `hsl()` no jsdom.
//
// O `cssstyle` que vem com o jest-environment-jsdom do react-scripts 5 só
// entende cor em `rgb()`, `rgba()`, hexadecimal e nomes. Qualquer `hsl()` que
// chegue nele é descartado e o valor lido de volta vira SEMPRE a mesma string,
// `rgb(61, 61, 61)`.
//
// Isso é veneno para esta base de código, porque toda cor da v0.1.0 é `hsl()`:
// a cor do card em `TelaAluno.addProblema` e a cor por e-mail do `Chat`. Sem
// este arquivo, `expect(card).toHaveStyle({ backgroundColor: 'hsl(210,70%,80%)' })`
// passa mesmo que o componente pinte o card de qualquer outra cor — os dois
// lados da comparação desabam no mesmo cinza e a asserção não prova nada.
//
// A correção guarda o texto original do `hsl()` e o devolve na leitura, sem
// mexer em nenhum componente. As tasks 05 e 08 dependem de cor ser verificável.

const PADRAO_HSL = /^hsla?\(/i;

/** Texto original por objeto de estilo, para não vazar entre elementos. */
const valoresBrutos = new WeakMap();

/**
 * Faz o jsdom preservar valores `hsl()` em `element.style.backgroundColor`.
 * Idempotente: chamar duas vezes não empilha decorações.
 */
export function instalarSuporteAHsl() {
  const prototipo = window.CSSStyleDeclaration.prototype;
  const descritor = Object.getOwnPropertyDescriptor(prototipo, 'backgroundColor');

  if (!descritor || descritor.__suportaHsl) return;

  const novoDescritor = {
    configurable: true,
    enumerable: descritor.enumerable,
    get() {
      if (valoresBrutos.has(this)) return valoresBrutos.get(this);
      return descritor.get.call(this);
    },
    set(valor) {
      const texto = valor == null ? '' : String(valor);

      if (PADRAO_HSL.test(texto)) {
        valoresBrutos.set(this, texto);
        return;
      }

      valoresBrutos.delete(this);
      descritor.set.call(this, valor);
    },
  };

  novoDescritor.__suportaHsl = true;
  Object.defineProperty(prototipo, 'backgroundColor', novoDescritor);
}

/**
 * Cor de fundo que o componente realmente pediu, sem a normalização do jsdom.
 *
 * Use isto em vez de `toHaveStyle({ backgroundColor })` sempre que a cor for
 * `hsl()` — `toHaveStyle` passa por `getComputedStyle`, que reconstrói o valor
 * a partir do atributo e volta a perder o `hsl()`.
 *
 * @param {Element} elemento elemento renderizado.
 * @returns {string} por exemplo `hsl(210, 70%, 80%)`.
 */
export function corDeFundo(elemento) {
  return elemento.style.backgroundColor;
}
