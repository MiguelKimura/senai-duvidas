// A animação de premiação — AC-PERK-04, AC-PERK-08.
//
// ESBOÇO: a implementação real entra no ciclo GREEN. Por ora desenha o card
// mínimo, sem saída, sem som e sem respeitar movimento reduzido.
import React from 'react';

/** Quanto tempo a premiação fica na tela antes de sair sozinha. */
export const DURACAO_DA_ANIMACAO_MS = 2600;

export default function AnimacaoDePerk({ perk }) {
  if (!perk) return null;

  return <div className="perk-premiacao">{perk.tipo}</div>;
}
