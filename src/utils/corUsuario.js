// A cor de quem fala no chat.
//
// PASSO 1: o comportamento da v0.7.0, movido para cá sem mudar uma vírgula.
// É o incumbente contra o qual `__tests__/corUsuario.test.js` está vermelho.
const FALLBACK = '';

export function corUsuario(semente) {
  const valorUnico = typeof semente === 'string' ? semente : FALLBACK;
  let hash = 0;

  for (let i = 0; i < valorUnico.length; i += 1) {
    hash = (hash << 5) - hash + valorUnico.charCodeAt(i);
  }

  return { fundo: `hsl(${Math.abs(hash) % 360}, 90%, 60%)`, texto: '#ffffff' };
}

export function corDaMensagem(mensagem, leitor = {}) {
  const dados = mensagem || {};

  return corUsuario(dados.autorUid || dados.email || leitor.email);
}
