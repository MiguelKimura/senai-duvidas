// Anexos de imagem dos chamados — AC-IMG-02 a AC-IMG-13, AC-SEC-08.
//
// Esqueleto do ciclo 1: a função existe, e faz o que o app fazia antes de esta
// task — confia no que o navegador declarou. É por isso que o teste de magic
// bytes falha aqui, e falha na asserção, não no import.

/**
 * Diz se o arquivo pode virar anexo.
 *
 * @param {File|Blob} arquivo
 * @returns {Promise<{ok: boolean, erro: string|null, tipo: string|null}>}
 */
export async function validarArquivo(arquivo) {
  return { ok: true, erro: null, tipo: arquivo.type || null };
}
