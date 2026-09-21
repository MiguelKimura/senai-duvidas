// Esqueleto do markdown — as assinaturas existem para que o teste do ciclo 2
// falhe na asserção, e não no `import`.
export const FORMATO_MARKDOWN = 'markdown';
export const FORMATO_TEXTO = 'texto';

export function paraHtmlSeguro(_texto) {
  return '';
}

export function formatoDoTexto(_documento) {
  return FORMATO_TEXTO;
}
