// A ordem da fila de chamados — AC-PERK-09, AC-CHAMADO-03.
//
// ESBOÇO: a ordenação real entra no ciclo GREEN. O módulo já existe para que
// o teste vermelho falhe pela asserção, e não pelo import.

/** Tipos de perk. Só o primeiro mexe na fila. */
export const TIPO_PRIORIDADE = 'prioridade';

/** Agrupa os perks por aluno. */
export function indexarPerksPorUid(perks = []) {
  return new Map(perks.map((perk) => [perk.alunoUid, [perk]]));
}

/** Devolve a fila ordenada. */
export function ordenarFila(chamados) {
  return [...chamados];
}
