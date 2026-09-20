// Esqueleto do tradutor de erros de autenticação (AC-AUTH-05).
// Existe para que o teste falhe na asserção, e não no import.

/**
 * @param {{code?: string}} _erro erro lançado pelo SDK do Firebase.
 * @returns {string} mensagem em português para exibir ao usuário.
 */
export function traduzirErroDeAuth(_erro) {
  return '';
}
