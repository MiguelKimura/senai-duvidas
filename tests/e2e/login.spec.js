// Fluxo crítico 1 — login — AC-TEST-06.
//
// Cobre: e-mail e senha, o Google (contra o emulador de Auth, que é o provedor de
// verdade servindo a tela de consentimento), e a sessão restaurada depois de um
// recarregamento **de navegador real** (AC-SESSAO-01, AC-SESSAO-03).
//
// A última é a razão principal de este arquivo existir. A suíte unitária prova a
// sessão remontando o `AuthProvider` com o Firestore falso — o que é o gesto
// certo em jsdom e não é um recarregamento. Só um navegador de verdade tem
// IndexedDB de verdade, e é ali que a persistência do Firebase guarda o token.
const { expect, test } = require('@playwright/test');
const { limparTudo } = require('./fixtures/emulador');
const { ANA, CARLOS, criarContas, semearPerfis } = require('./fixtures/cenario');
const { entrar } = require('./fixtures/app');

test.beforeEach(async () => {
  await limparTudo();
  await criarContas();
  await semearPerfis();
});

test('o aluno entra com e-mail e senha e cai na tela dele (AC-AUTH-02)', async ({ page }) => {
  await entrar(page, ANA);

  await expect(page).toHaveURL(/\/aluno$/);
  await expect(page.getByRole('heading', { name: new RegExp(ANA.nome, 'i') })).toBeVisible();
});

test('o professor entra na rota dele, decidida pelo Firestore (AC-AUTH-06)', async ({
  page,
}) => {
  await entrar(page, CARLOS);

  // O papel vem de `usuarios/{uid}.tipo` e de `autorizados/{email}.Tipo`, nunca
  // do navegador. A rota é a prova visível dessa decisão.
  await expect(page).toHaveURL(/\/professor$/);

  // E a ação que só o professor tem existe na lista de salas dele.
  await page.goto('/salas');
  await expect(page.getByRole('button', { name: /criar sala/i })).toBeVisible();
});

test('senha errada mostra erro em português, e não um código do Firebase', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel(/e-?mail/i).fill(ANA.email);
  await page.getByLabel(/senha/i).fill('senha-que-nao-e-a-dela');
  await page.getByRole('button', { name: /^entrar$/i }).click();

  const aviso = page.getByRole('alert');

  await expect(aviso).toBeVisible();
  // AC-AUTH-05: nenhum código cru do SDK chega à tela.
  await expect(aviso).not.toContainText('auth/');
  await expect(aviso).not.toContainText('Firebase');
  await expect(page).toHaveURL(/\/$/);
});

test('a sessão sobrevive a um recarregamento de verdade (AC-SESSAO-01, AC-SESSAO-03)', async ({
  page,
}) => {
  await entrar(page, ANA);

  await page.goto('/salas');
  await expect(page.getByRole('heading', { name: /minhas salas/i })).toBeVisible();

  await page.reload();

  // Sem nova digitação de senha: o token veio do IndexedDB, que é o que
  // `browserLocalPersistence` usa e o que o jsdom não tem.
  await expect(page.getByRole('heading', { name: /minhas salas/i })).toBeVisible();
  await expect(page.getByLabel(/senha/i)).toHaveCount(0);
});

test('sair encerra a sessão, e a rota protegida não reabre depois (AC-AUTH-08)', async ({
  page,
}) => {
  await entrar(page, ANA);
  await expect(page).toHaveURL(/\/aluno$/);

  await page.getByRole('button', { name: /sair/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel(/senha/i)).toBeVisible();

  // Voltar à rota protegida **pela URL** é o gesto que importa, e é mais forte
  // do que o `goBack`: o `AuthProvider` e a `RotaProtegida` são remontados do
  // zero, com o IndexedDB já limpo. (`goBack` não serve aqui porque as duas
  // navegações do app usam `replace` de propósito — não há entrada anterior no
  // histórico para voltar, e o teste estaria medindo o histórico, não a sessão.)
  await page.goto('/aluno');

  await expect(page.getByLabel(/senha/i)).toBeVisible();
  await expect(page.getByText(new RegExp(ANA.nome, 'i'))).toHaveCount(0);
});

test('rota protegida sem sessão nenhuma cai no login', async ({ page }) => {
  await page.goto('/salas');

  await expect(page.getByLabel(/senha/i)).toBeVisible();
});

test('o botão do Google leva a uma sessão de verdade (AC-AUTH-03)', async ({ page }) => {
  await page.goto('/');

  // O emulador de Auth serve a própria tela de consentimento, com um provedor
  // de mentira e contas de teste. É o mock **do provedor**, servido por quem
  // implementa o protocolo — e não um `jest.mock` do nosso lado, que provaria
  // que o nosso código chama a nossa função.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /entrar com google/i }).click(),
  ]);

  await popup.waitForLoadState('domcontentloaded');
  await popup.getByRole('button', { name: /add new account/i }).click();

  // Os campos são alcançados por `id`, e não por rótulo: o widget do emulador
  // dá o **mesmo** `aria-labelledby` a todos os quatro campos, então consultar
  // por rótulo ali é sorte, não localização.
  const email = popup.locator('#email-input');

  await email.waitFor({ state: 'visible' });
  await email.fill('dani.google@senai.br');
  await popup.locator('#display-name-input').fill('Dani Google');

  await popup.getByRole('button', { name: /sign in with google/i }).click();

  // Primeiro acesso por provedor social cria o perfil com `tipo: "aluno"`, e o
  // app leva a pessoa para a rota de aluno.
  await expect(page).toHaveURL(/\/aluno$/, { timeout: 20000 });
});
