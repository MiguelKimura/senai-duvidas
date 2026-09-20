// AC-SEC-06 — o app roda apenas sob HTTPS.
//
// O hosting do Firebase já serve com redirecionamento, mas ele cobre só o
// domínio dele. Basta alguém abrir o app por um IP da rede local, ou por um
// domínio novo ainda sem o redirecionamento configurado, para a aula inteira
// rodar em HTTP sem ninguém perceber. Este guarda é a rede de segurança para
// esse caso, e roda antes de a aplicação montar.
//
// A outra metade do AC-SEC-06 — a lista de domínios autorizados do Firebase
// Auth — é configuração do console e está documentada em
// `docs/DOMINIOS-AUTORIZADOS.md`; não há API do cliente que a verifique.

/**
 * Hosts que servem em HTTP por natureza. `npm start` sobe em
 * `http://localhost:3000` e os emuladores em `127.0.0.1` — redirecionar ali
 * deixaria o projeto impossível de rodar na máquina do desenvolvedor.
 */
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1', '[::1]', ''];

/**
 * Redireciona para HTTPS quando a página foi aberta em HTTP.
 *
 * Usa `replace` e não `assign` de propósito: a URL insegura não fica no
 * histórico, então o botão "voltar" do navegador não devolve o usuário para
 * ela.
 *
 * @param {Location} [local] normalmente `window.location`.
 * @returns {boolean} `true` quando redirecionou — o chamador deve parar de
 *   montar a aplicação, porque a página está sendo trocada.
 */
export function garantirHttps(local) {
  if (!local || local.protocol !== 'http:') {
    return false;
  }

  if (HOSTS_LOCAIS.includes(local.hostname)) {
    return false;
  }

  local.replace(local.href.replace(/^http:/, 'https:'));

  return true;
}
