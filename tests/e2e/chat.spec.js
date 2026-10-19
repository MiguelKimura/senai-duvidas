// Fluxos críticos 5 e 6 — mensagem no chat da sala, e mensagem direta —
// AC-TEST-06.
//
// O que só o navegador prova, e por isso está aqui:
//
//   * **o horário em Brasília.** A suíte unitária roda a mesma asserção em três
//     fusos (`npm run test:fusos`), o que prova o formatador. Aqui o fuso é do
//     **navegador**, declarado por teste, e o que se mede é a tela: um relógio em
//     Nova York continua mostrando a hora de Brasília (AC-TEMPO-03, AC-CHAT-07).
//   * **a cor estável.** A cor do balão é calculada a partir do autor, e a
//     asserção compara o pixel computado em **duas sessões diferentes** — a
//     Ana vendo a si mesma e a Bia vendo a Ana. É a definição do AC-CHAT-02, e
//     ela não tem como ser escrita com um render só.
//   * **a paginação ao rolar.** Cinquenta mensagens vêm; as anteriores só depois
//     do clique, e é o `limit()` do Firestore que decide isso, não o React.
//   * **a conversa direta invisível para terceiros.** Três sessões abertas ao
//     mesmo tempo, que é o cenário do AC-DM-04 e o que nenhum teste de rules
//     mostra: a rule prova que o servidor recusa; isto prova que a tela da Bia
//     não tem a conversa em lugar nenhum.
const { expect, test } = require('@playwright/test');
const {
  ANA,
  BIA,
  CARLOS,
  SALA,
  semearCenarioCompleto,
  semearConversaDaSala,
  semearMensagem,
} = require('./fixtures/cenario');
const { idsDe, limparTudo } = require('./fixtures/emulador');
const { abrirChat, abrirSala, entrar } = require('./fixtures/app');

test.beforeEach(async () => {
  await limparTudo();
  await semearCenarioCompleto();
});

/** A cor de fundo que o navegador realmente pintou no balão. */
function fundoDoBalao(balao) {
  return balao.evaluate((no) => getComputedStyle(no).backgroundColor);
}

/** Entra, abre a sala e abre o chat — os três gestos que todo teste daqui faz. */
async function entrarNoChat(page, pessoa) {
  await entrar(page, pessoa);
  await abrirSala(page, SALA.id);
  await abrirChat(page);
}

test('a aluna manda uma mensagem e o professor a recebe na hora (AC-CHAT-01, AC-CHAT-04)', async ({
  browser,
}) => {
  const doProfessor = await browser.newContext();
  const telaDoProfessor = await doProfessor.newPage();

  await entrarNoChat(telaDoProfessor, CARLOS);

  const daAluna = await browser.newContext();
  const telaDaAluna = await daAluna.newPage();

  await entrarNoChat(telaDaAluna, ANA);

  await telaDaAluna.getByPlaceholder('Escreva uma mensagem').fill('Professor, pode vir na 4?');
  await telaDaAluna.getByRole('button', { name: 'Enviar mensagem' }).click();

  // Na tela dela: o balão, com o horário que o servidor carimbou.
  const balaoDela = telaDaAluna.getByRole('listitem').filter({ hasText: 'pode vir na 4' });

  await expect(balaoDela).toBeVisible();
  await expect(balaoDela.locator('time')).toHaveText(/^\d{2}:\d{2}$/);

  // E na dele, sem recarregar: é o `onSnapshot` da conversa.
  const balaoDele = telaDoProfessor.getByRole('listitem').filter({ hasText: 'pode vir na 4' });

  await expect(balaoDele).toBeVisible();
  await expect(balaoDele).toContainText(ANA.nome);

  // O professor responde, e o balão dele leva o selo do papel (AC-CHAT-04).
  await telaDoProfessor.getByPlaceholder('Escreva uma mensagem').fill('Já estou indo.');
  await telaDoProfessor.getByRole('button', { name: 'Enviar mensagem' }).click();

  const resposta = telaDaAluna.getByRole('listitem').filter({ hasText: 'Já estou indo.' });

  await expect(resposta).toBeVisible();
  await expect(resposta).toContainText('Professor');

  await doProfessor.close();
  await daAluna.close();
});

test('a cor do balão depende de quem escreveu, e não de quem lê (AC-CHAT-02)', async ({
  browser,
}) => {
  await semearMensagem({ id: 'da-ana-1', autor: ANA, texto: 'Primeira da Ana' });
  await semearMensagem({ id: 'da-ana-2', autor: ANA, texto: 'Segunda da Ana' });
  await semearMensagem({ id: 'do-carlos', autor: CARLOS, texto: 'Fala do Carlos' });

  const daAna = await browser.newContext();
  const telaDaAna = await daAna.newPage();

  await entrarNoChat(telaDaAna, ANA);

  const balao = (page, texto) =>
    page.getByRole('listitem').filter({ hasText: texto }).locator('.mensagem-balao');

  const primeira = await fundoDoBalao(balao(telaDaAna, 'Primeira da Ana'));
  const segunda = await fundoDoBalao(balao(telaDaAna, 'Segunda da Ana'));
  const doCarlos = await fundoDoBalao(balao(telaDaAna, 'Fala do Carlos'));

  // Duas mensagens da mesma pessoa, a mesma cor. Pessoas diferentes, cores
  // diferentes — é o que faz a turma reconhecer quem falou de longe.
  expect(primeira).toBe(segunda);
  expect(primeira).not.toBe(doCarlos);

  const daBia = await browser.newContext();
  const telaDaBia = await daBia.newPage();

  await entrarNoChat(telaDaBia, BIA);

  // A mesma mensagem, outra sessão, outro leitor: a mesma cor. Se a cor viesse
  // de "é minha ou é de outro", esta asserção falharia.
  expect(await fundoDoBalao(balao(telaDaBia, 'Primeira da Ana'))).toBe(primeira);
  expect(await fundoDoBalao(balao(telaDaBia, 'Fala do Carlos'))).toBe(doCarlos);

  await daAna.close();
  await daBia.close();
});

test.describe('com o navegador em Nova York', () => {
  // O fuso é do navegador, e não do formatador: é o cenário do aluno que mexeu
  // no relógio da máquina do laboratório, e o do professor acessando de viagem.
  test.use({ timezoneId: 'America/New_York' });

  test('o horário mostrado continua sendo o de Brasília (AC-TEMPO-03, AC-CHAT-07)', async ({
    page,
  }) => {
    // 10:45 em Brasília é 09:45 em Nova York — uma hora de diferença em
    // setembro. O número na tela é o que separa as duas leituras.
    await semearMensagem({
      id: 'da-ana',
      autor: ANA,
      texto: 'Marcado para as dez e quarenta e cinco',
    });

    await entrarNoChat(page, ANA);

    const balao = page.getByRole('listitem').filter({ hasText: 'dez e quarenta e cinco' });

    await expect(balao.locator('time')).toHaveText('10:45');
    // E o navegador está de fato em Nova York: sem esta linha, o teste passaria
    // num runner que já estivesse no fuso de Brasília e não provaria nada.
    expect(await page.evaluate(() => new Date('2026-09-26T13:45:00Z').getHours())).toBe(9);
  });
});

test('a conversa antiga só vem depois do clique, e não de uma vez (AC-CHAT-06, AC-PERF-03)', async ({
  page,
}) => {
  // 60 mensagens, e a janela é de 50: é o menor cenário em que a paginação
  // existe. Com 50 exatas o botão apareceria sem ter o que carregar.
  await semearConversaDaSala({ quantidade: 60 });

  await entrarNoChat(page, ANA);

  // A mais nova está na tela; a mais velha, não. Este par é a asserção: a
  // consulta é decrescente com `limit`, então quem cai fora é o começo do dia.
  await expect(page.getByText('Mensagem número 60', { exact: true })).toBeVisible();
  await expect(page.getByText('Mensagem número 1', { exact: true })).toHaveCount(0);

  // O botão de paginar vive na visão de histórico: a conversa de hoje é curta
  // por definição, e é ali que a turma rola para trás.
  await page.getByRole('button', { name: /ver dias anteriores/i }).click();
  await page.getByRole('button', { name: /ver mensagens anteriores/i }).click();

  await expect(page.getByText('Mensagem número 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Mensagem número 60', { exact: true })).toBeVisible();
});

test('o professor abre uma conversa direta, e um terceiro não a enxerga (AC-DM-01, AC-DM-04)', async ({
  browser,
}) => {
  const doProfessor = await browser.newContext();
  const telaDoProfessor = await doProfessor.newPage();

  await entrarNoChat(telaDoProfessor, CARLOS);

  await telaDoProfessor.getByRole('tab', { name: 'Diretas' }).click();
  await telaDoProfessor.getByRole('button', { name: /nova conversa/i }).click();
  // O contato é procurado **dentro** da lista de contatos: o painel da turma,
  // que só o dono da sala vê, tem um "Remover Ana Souza" na mesma página.
  await telaDoProfessor
    .locator('.conversas-contatos')
    .getByRole('button', { name: ANA.nome })
    .click();

  await telaDoProfessor
    .getByPlaceholder('Escreva uma mensagem')
    .fill('Ana, você entendeu a parte do torno?');
  await telaDoProfessor.getByRole('button', { name: 'Enviar mensagem' }).click();

  await expect(
    telaDoProfessor.getByRole('listitem').filter({ hasText: 'parte do torno' })
  ).toBeVisible();

  // Do lado da aluna: a conversa aparece na lista dela, com a mensagem.
  const daAluna = await browser.newContext();
  const telaDaAluna = await daAluna.newPage();

  await entrarNoChat(telaDaAluna, ANA);
  await telaDaAluna.getByRole('tab', { name: 'Diretas' }).click();

  await telaDaAluna
    .locator('.conversas')
    .getByRole('button', { name: new RegExp(CARLOS.nome) })
    .click();
  await expect(
    telaDaAluna.getByRole('listitem').filter({ hasText: 'parte do torno' })
  ).toBeVisible();

  // E do lado da Bia, que é membro da mesma sala e não é parte da conversa:
  // nada. Nem a conversa na lista, nem o texto em lugar nenhum da página.
  const daBia = await browser.newContext();
  const telaDaBia = await daBia.newPage();

  await entrarNoChat(telaDaBia, BIA);
  await telaDaBia.getByRole('tab', { name: 'Diretas' }).click();

  await expect(telaDaBia.getByText(/nenhuma conversa por aqui ainda/i)).toBeVisible();
  await expect(telaDaBia.getByText('parte do torno')).toHaveCount(0);
  await expect(telaDaBia.locator('body')).not.toContainText('parte do torno');

  // A conversa existe no banco, e a Bia não é uma das duas pessoas dela: é o
  // documento que a rule protege, e é por isso que a tela dela está vazia.
  const [conversaId] = await idsDe(`salas/${SALA.id}/conversas`);

  expect(conversaId).toBeTruthy();
  expect(conversaId).not.toContain(BIA.uid);

  await doProfessor.close();
  await daAluna.close();
  await daBia.close();
});
