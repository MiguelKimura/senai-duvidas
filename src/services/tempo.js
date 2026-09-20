// A única fonte de horário do app — AC-TEMPO-01 a AC-TEMPO-09.
//
// Esqueleto em construção: cada função nasce aqui sem corpo e é preenchida
// pelo ciclo red-green-refactor que a exige.

/** @typedef {import('firebase/firestore').Timestamp} Timestamp */

/**
 * Converte qualquer formato de `horario` já gravado no banco em `Date`.
 *
 * @param {Timestamp|string|Date|null|undefined} valor valor lido do documento.
 * @returns {Date|null} `null` quando não há data legível.
 */
export function paraData(valor) {
  throw new Error(`paraData ainda não foi implementada (recebeu ${typeof valor}).`);
}
