// Os gestos que todo spec repete — AC-TEST-06, AC-TEST-09.
//
// Uma regra governa este arquivo: **nenhuma espera cega**. Não há
// `waitForTimeout` aqui, nem em nenhum spec, e
// `tests/e2e/__meta__/semEsperaCega.test.js` varre a pasta para garantir que
// continue assim. Um `sleep` de 500ms é duas coisas ao mesmo tempo: meio segundo
// desperdiçado em toda execução e uma falha intermitente no runner mais lento.
// Espera-se por condição — um elemento que aparece, um texto que muda.
const { expect } = require('@playwright/test');

/**
 * Entra com e-mail e senha pela tela de login.
 *
 * Passa pela interface de propósito, inclusive nos specs que não testam login:
 * injetar um token no `localStorage` seria mais rápido e provaria menos — o
 * caminho do token injetado não é o caminho que o aluno percorre, e é onde a
 * sessão restaurada (AC-SESSAO-01) deixaria de ser exercitada.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{email: string, senha: string}} pessoa
 */
async function entrar(page, { email, senha }) {
  await page.goto('/');

  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(senha);
  await page.getByRole('button', { name: /^entrar$/i }).click();

  // O login termina quando a rota autenticada aparece, e não quando o clique
  // volta: entre os dois há a leitura do perfil e a resolução do papel.
  await expect(page).not.toHaveURL(/\/$/, { timeout: 15000 });
}

/**
 * Abre a sala diretamente pela URL.
 *
 * Atalho de navegação, não de estado: quem já é membro chega aqui pelo cartão da
 * lista, e o spec da lista (`sala.spec.js`) exercita esse clique. Repetir os dois
 * cliques em todo spec só acrescentaria formas de o teste do chat falhar por
 * causa da tela de salas.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} salaId
 */
async function abrirSala(page, salaId) {
  await page.goto(`/sala/${salaId}`);

  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
}

/** O painel de chat da sala, aberto pelo botão que o esconde por padrão. */
async function abrirChat(page) {
  await page
    .getByRole('button', { name: /chat|conversa/i })
    .first()
    .click();

  await expect(page.getByRole('textbox', { name: /mensagem/i })).toBeVisible();
}

/**
 * Um PNG de verdade, do menor tamanho possível.
 *
 * `services/anexos.js` confere o tipo por **magic bytes** (AC-SEC-08), então um
 * arquivo de texto renomeado para `.png` é recusado — e é bom que seja. Estes
 * bytes são um PNG 1×1 válido.
 */
const PNG_DE_UM_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

/** O mesmo PNG como arquivo pronto para `setInputFiles`. */
const ARQUIVO_PNG = {
  name: 'print-do-erro.png',
  mimeType: 'image/png',
  buffer: PNG_DE_UM_PIXEL,
};

/**
 * Um `.exe` com o nome trocado para `.png` (AC-SEC-08).
 *
 * `MZ` são os dois primeiros bytes de todo executável do Windows. É o arquivo
 * que o aluno de informática tenta subir para provar que consegue.
 */
const ARQUIVO_EXE_DISFARCADO = {
  name: 'print-do-erro.png',
  mimeType: 'image/png',
  buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 0x90)]),
};

module.exports = {
  ARQUIVO_EXE_DISFARCADO,
  ARQUIVO_PNG,
  PNG_DE_UM_PIXEL,
  abrirChat,
  abrirSala,
  entrar,
};
