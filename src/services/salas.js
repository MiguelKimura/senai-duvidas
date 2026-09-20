// Esqueleto das salas — implementação nos commits seguintes (ciclo 3).
export const COLECAO_DE_SALAS = 'salas';
export const COLECAO_DO_INDICE = 'indicePins';

export class ErroDeSala extends Error {}

export function validarDadosDaSala(dados) {
  return dados;
}

export async function criarSala() {
  return { salaId: '', pin: '' };
}
