// A única fonte de horário do app — AC-TEMPO-01 a AC-TEMPO-09.
//
// Esqueleto em construção: cada função nasce aqui sem corpo e é preenchida
// pelo ciclo red-green-refactor que a exige.

/** @typedef {import('firebase/firestore').Timestamp} Timestamp */

/** Um `Date` que o motor conseguiu construir de verdade. */
function ehDataValida(data) {
  return data instanceof Date && !Number.isNaN(data.getTime());
}

/**
 * Converte qualquer formato de `horario` já gravado no banco em `Date`.
 *
 * É a leitura dupla exigida pelo AC-TEMPO-08: convivem no banco documentos da
 * v0.1.0, com `horario` em string ISO, e documentos novos, com `Timestamp` do
 * servidor. Nenhum dos dois é convertido no banco — os dois são entendidos
 * aqui, permanentemente nesta versão.
 *
 * A checagem do `Timestamp` é por `toDate`, não por `instanceof`: o SDK do
 * Firebase é carregado em mais de um lugar (app, mock de teste, cache), e
 * `instanceof` falha em silêncio quando as classes vêm de módulos diferentes.
 *
 * @param {Timestamp|string|Date|null|undefined} valor valor lido do documento.
 * @returns {Date|null} `null` quando não há data legível — inclusive para o
 *   sentinela de `serverTimestamp()` que o servidor ainda não resolveu.
 */
export function paraData(valor) {
  if (valor === null || valor === undefined) return null;

  if (valor instanceof Date) return ehDataValida(valor) ? valor : null;

  if (typeof valor === 'string' || typeof valor === 'number') {
    const data = new Date(valor);
    return ehDataValida(data) ? data : null;
  }

  if (typeof valor.toDate === 'function') {
    const data = valor.toDate();
    return ehDataValida(data) ? data : null;
  }

  // Um `Timestamp` que passou por JSON — cache do navegador, export, REST —
  // chega como objeto puro, sem método nenhum.
  if (typeof valor.seconds === 'number') {
    return new Date(valor.seconds * 1000 + Math.floor((valor.nanoseconds || 0) / 1e6));
  }

  return null;
}
