// Os gestos que todo spec repete — AC-TEST-06, AC-TEST-09.
//
// Uma regra governa este arquivo: **nenhuma espera cega**. Não há
// `waitForTimeout` aqui, nem em nenhum spec, e `scripts/varrerEsperaCega.js`
// varre a pasta para garantir que continue assim — chamado por
// `src/__tests__/semEsperaCegaNoE2E.test.js`, que roda no CI junto da suíte
// unitária. Um `sleep` de 500ms é duas coisas ao mesmo tempo: meio segundo
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

  // O cabeçalho da sala, e não "o primeiro h2 da página": a tela do professor
  // monta o painel da turma, que também tem um h2. Sem o escopo, esta espera
  // passa na tela do aluno e estoura na do professor por ambiguidade — que é
  // um defeito do teste, e não do app.
  await expect(
    page.locator('.sala-cabecalho').getByRole('heading', { level: 2 })
  ).toBeVisible();
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
 * Um PNG 2×2 de verdade — assinatura, IHDR, IDAT e CRCs corretos.
 *
 * Dois cuidados, os dois aprendidos aqui:
 *
 * **Passar pelos magic bytes não basta.** `services/anexos.js` confere o tipo
 * pela assinatura (AC-SEC-08), e a assinatura são os oito primeiros bytes. O
 * blob que estava neste lugar tinha a assinatura certa e o CRC do IDAT errado:
 * a validação o aceitava, e a compressão morria depois, em
 * `createImageBitmap`, com "The source image could not be decoded" — dentro de
 * um `catch` que vira faixa vermelha na tela do aluno. Era um teste verde
 * escondendo um caminho que nunca chegava ao Storage.
 *
 * **2×2, e não 1×1.** A compressão redimensiona e reencoda; uma imagem de um
 * pixel é o caso em que largura, altura e razão de aspecto valem todos 1, e
 * qualquer erro de aritmética em `dimensionarPara` passaria batido.
 */
const PNG_DE_UM_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DAwPCfAUIBABvyA/3MQfc+AAAAAElFTkSuQmCC',
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
