// As premiações do professor — AC-PERK-01, AC-PERK-03, AC-PERK-06, AC-PERK-10.
//
// ESBOÇO: a implementação real entra no ciclo GREEN. O módulo já existe para
// que o teste vermelho falhe pela asserção, e não pelo import.
export const LIMITE_DE_PERKS = 0;
export const TAMANHO_MAXIMO_DA_JUSTIFICATIVA = 280;

export class ErroDePerk extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDePerk';
  }
}

export function validarConcessao(dados) {
  return dados;
}

export async function concederPerk() {
  return { perkId: null };
}

export async function revogarPerk() {}

export async function marcarPerkVisualizado() {
  return false;
}

export function observarPerksDaSala() {
  return () => {};
}

export function separarConquistas() {
  return { ativos: [], expirados: [] };
}

export function perksDoAluno() {
  return [];
}
