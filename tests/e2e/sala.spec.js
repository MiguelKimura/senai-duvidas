// Fluxo crítico 2 — entrar na sala — AC-TEST-06.
//
// Cobre o ciclo inteiro do PIN, com duas pessoas em dois navegadores: o
// professor cria a sala e copia o número, a aluna entra com ele, o número
// errado é recusado sem revelar nada, e a volta no dia seguinte não pede o PIN
// de novo (AC-SALA-01 a AC-SALA-06).
//
// O PIN **não** é semeado no teste que o exercita: ele é lido da tela do
// professor. É o único jeito de provar o contrato inteiro — o número que a tela
// mostra é o mesmo que o servidor conferiu contra o resumo que ela gravou. Um
// PIN constante no código provaria que a fixture sabe calcular SHA-256.
const { expect, test } = require('@playwright/test');
const {
  ANA,
  BIA,
  CARLOS,
  SALA,
  criarContas,
  semearPerfis,
  semearSala,
} = require('./fixtures/cenario');
const { idsDe, ler, limparTudo } = require('./fixtures/emulador');
const { entrar } = require('./fixtures/app');

test.beforeEach(async () => {
  await limparTudo();
  await criarContas();
  await semearPerfis();
});

/** O PIN que a tela do professor está mostrando, lido de onde a turma o lê. */
async function pinNaTela(page) {
  const destaque = page.getByTestId('pin-em-destaque');

  await expect(destaque).toHaveText(/^\d{6}$/);

  return (await destaque.textContent()).trim();
}

test('o professor cria a sala, vê o PIN uma vez e o copia (AC-SALA-01, AC-SALA-03)', async ({
  page,
  context,
}) => {
  // A permissão é do navegador, não do app: sem ela o `navigator.clipboard`
  // rejeita e o teste mediria a caixa de diálogo do Chrome.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await entrar(page, CARLOS);
  await page.goto('/salas/nova');

  await page.getByLabel('Nome da sala').fill('Mecânica 2º ano');
  await page.getByLabel('Curso ou turma').fill('Mecânica — Turma B');
  await page.getByLabel('Ano letivo').fill('2026');
  await page.getByRole('button', { name: /criar sala/i }).click();

  await expect(page.getByRole('heading', { name: /sala criada/i })).toBeVisible();

  const pin = await pinNaTela(page);

  // O aviso de que o número aparece uma vez só é parte do critério: o banco
  // guarda o resumo, e nem o suporte recupera o PIN depois (AC-SEC-05).
  await expect(page.getByText(/o PIN aparece uma única vez/i)).toBeVisible();

  await page.getByRole('button', { name: /copiar pin/i }).click();
  await expect(page.getByText(/^copiado!$/i)).toBeVisible();

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(pin);

  // O banco guarda o resumo, e não o número. Esta é a asserção que falharia se
  // alguém decidisse "guardar o PIN para o professor consultar depois", e ela
  // olha para o documento com o token de administrador do emulador — quem lê
  // aqui vê mais do que qualquer cliente veria (AC-SEC-05).
  const [salaId] = await idsDe('salas');

  expect(salaId).toBeTruthy();

  const segredo = await ler(`salas/${salaId}/segredo/pin`);

  expect(Object.keys(segredo).sort()).toEqual(['atualizadoEm', 'hash', 'sal']);
  expect(JSON.stringify(segredo)).not.toContain(pin);

  // E a sala nasce na lista dele, com o vínculo de professor já gravado.
  await page.goto('/salas');
  await expect(page.getByRole('heading', { name: 'Mecânica 2º ano' })).toBeVisible();
});

test('a aluna entra com o PIN que o professor acabou de gerar (AC-SALA-04, AC-SALA-06)', async ({
  browser,
}) => {
  const salaDoProfessor = await browser.newContext();
  const telaDoProfessor = await salaDoProfessor.newPage();

  await entrar(telaDoProfessor, CARLOS);
  await telaDoProfessor.goto('/salas/nova');
  await telaDoProfessor.getByLabel('Nome da sala').fill('Eletrônica 1º ano');
  await telaDoProfessor.getByLabel('Curso ou turma').fill('Eletrônica — Turma A');
  await telaDoProfessor.getByLabel('Ano letivo').fill('2026');
  await telaDoProfessor.getByRole('button', { name: /criar sala/i }).click();

  const pin = await pinNaTela(telaDoProfessor);

  // Outro contexto, e não outra aba: contexto separado é sessão separada, que é
  // o que separa a aluna do professor. Na mesma sessão o teste estaria provando
  // que o navegador guarda dois tokens, o que ele não faz.
  const salaDaAluna = await browser.newContext();
  const telaDaAluna = await salaDaAluna.newPage();

  await entrar(telaDaAluna, ANA);
  await telaDaAluna.goto('/salas/entrar');
  await telaDaAluna.getByLabel('PIN da sala').fill(pin);
  await telaDaAluna.getByRole('button', { name: /entrar na sala/i }).click();

  // A entrada termina na sala, com o nome que o professor escolheu.
  await expect(telaDaAluna).toHaveURL(/\/sala\/.+/);
  await expect(
    telaDaAluna.getByRole('heading', { name: /Eletrônica 1º ano/i, level: 2 })
  ).toBeVisible();

  // AC-SALA-06: a volta é pela lista, sem PIN. E é a lista dela, não a dele.
  await telaDaAluna.goto('/salas');
  await expect(telaDaAluna.getByRole('heading', { name: 'Eletrônica 1º ano' })).toBeVisible();
  await expect(telaDaAluna.getByRole('button', { name: /criar sala/i })).toHaveCount(0);

  await salaDoProfessor.close();
  await salaDaAluna.close();
});

test('PIN errado é recusado e não conta nada sobre a sala (AC-SALA-04, AC-SEC-02)', async ({
  page,
}) => {
  // A sala existe, e a Ana não é membro dela: é o cenário de quem chuta.
  await semearSala({ membros: [BIA] });

  await entrar(page, ANA);
  await page.goto('/salas/entrar');
  await page.getByLabel('PIN da sala').fill('000001');
  await page.getByRole('button', { name: /entrar na sala/i }).click();

  const aviso = page.getByRole('alert');

  await expect(aviso).toContainText(/PIN inválido/i);
  // Nenhum nome, nenhum curso, nenhuma pista de que a sala existe.
  await expect(page.getByText(SALA.nome)).toHaveCount(0);
  await expect(page).toHaveURL(/\/salas\/entrar$/);

  // E a URL da sala continua fechada para ela, mesmo digitada à mão.
  await page.goto(`/sala/${SALA.id}`);
  await expect(page.getByRole('alert')).toContainText(/não faz parte desta sala/i);
  await expect(page.getByText(SALA.nome)).toHaveCount(0);
});

test('quem já entrou uma vez volta pela lista, sem redigitar o PIN (AC-SALA-06)', async ({
  page,
}) => {
  await semearSala();

  await entrar(page, ANA);
  await page.goto('/salas');

  await page
    .getByRole('listitem')
    .filter({ hasText: SALA.nome })
    .getByRole('button', { name: /abrir sala/i })
    .click();

  await expect(page).toHaveURL(new RegExp(`/sala/${SALA.id}$`));
  await expect(
    page.getByRole('heading', { level: 2, name: new RegExp(SALA.nome) })
  ).toBeVisible();

  // Recarregar a sala direto na URL também não pede PIN: o vínculo está no
  // banco, e não no navegador.
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: new RegExp(SALA.nome) })
  ).toBeVisible();
  await expect(page.getByLabel('PIN da sala')).toHaveCount(0);
});

test('o professor regera o PIN e o número antigo para de servir (AC-SALA-09)', async ({
  browser,
}) => {
  // A Bia é a única membro: quem tenta o número antigo precisa estar de fora.
  // Um membro que redigite o PIN antigo entra pelo vínculo que já tem, e o
  // teste passaria a medir o vínculo em vez do PIN.
  await semearSala({ membros: [BIA] });

  const doProfessor = await browser.newContext();
  const telaDoProfessor = await doProfessor.newPage();

  await entrar(telaDoProfessor, CARLOS);
  await telaDoProfessor.goto('/salas');
  await telaDoProfessor
    .getByRole('listitem')
    .filter({ hasText: SALA.nome })
    .getByRole('button', { name: /gerar novo pin/i })
    .click();

  await expect(
    telaDoProfessor.getByRole('heading', { name: /novo pin da sala/i })
  ).toBeVisible();

  const pinNovo = await pinNaTela(telaDoProfessor);

  expect(pinNovo).not.toBe(SALA.pin);

  const deFora = await browser.newContext();
  const telaDeFora = await deFora.newPage();

  await entrar(telaDeFora, ANA);
  await telaDeFora.goto('/salas/entrar');
  await telaDeFora.getByLabel('PIN da sala').fill(SALA.pin);
  await telaDeFora.getByRole('button', { name: /entrar na sala/i }).click();

  await expect(telaDeFora.getByRole('alert')).toContainText(/PIN inválido/i);

  await doProfessor.close();
  await deFora.close();
});
