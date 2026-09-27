// Carga: o alvo do projeto, com dado de verdade no emulador — AC-PERF-05.
//
// O critério é "uma sala com 40 alunos, 200 chamados e 1000 mensagens permanece
// fluida". Até esta task ele tinha teste unitário — render em jsdom com arrays
// em memória — e isso mede a coisa errada por duas razões: em jsdom não há
// layout para custar, e um array em memória não passa pelo Firestore, que é onde
// 1000 documentos viram 1000 documentos de tráfego.
//
// **O que "fluida" quer dizer aqui.** Duas coisas, e a primeira é a que importa:
//
//   1. **O tamanho da tela não acompanha o tamanho do banco.** 200 chamados no
//      Firestore são 30 cards no DOM; 1000 mensagens são 50 balões. Esta é a
//      asserção estrutural, e ela é determinística — não depende de quão ocupada
//      está a máquina que roda o teste. Se ela quebrar, quebrou o desenho:
//      alguém tirou um `limit` ou uma paginação, e nenhum orçamento de
//      milissegundos salvaria a tela do laboratório.
//   2. **O orçamento de tempo**, medido de verdade. Os números abaixo são
//      folgados de propósito: um teto apertado num runner compartilhado vira
//      falha intermitente, e uma suíte que falha sozinha é uma suíte que se
//      aprende a reexecutar sem ler. O que estes tetos pegam é regressão de
//      ordem de grandeza — a fila que passa a desenhar 200 cards, o chat que
//      passa a montar 1000 balões — e é isso que se quer pegar.
const { expect, test } = require('@playwright/test');
const {
  ANA,
  CARLOS,
  CHAMADOS_DE_CARGA,
  MENSAGENS_DE_CARGA,
  SALA,
  TURMA_DE_CARGA,
  semearSalaCheia,
} = require('./fixtures/cenario');
const { limparTudo } = require('./fixtures/emulador');
const { abrirChat, abrirSala, entrar } = require('./fixtures/app');

/** Quantos cards a fila desenha por página — `FilaDeChamados.CHAMADOS_POR_PAGINA`. */
const CARDS_POR_PAGINA = 30;

/** Quantos balões o chat monta por página — `chat.MENSAGENS_POR_PAGINA`. */
const MENSAGENS_POR_PAGINA = 50;

/**
 * Os orçamentos de tempo, em milissegundos.
 *
 * Do login ao primeiro card há a autenticação, a leitura do perfil, a resolução
 * do papel e o primeiro snapshot de 200 documentos. Depois disso a tela já está
 * montada, e paginar é só desenhar mais 30 cards: é por isso que o segundo
 * número é uma ordem de grandeza menor que o primeiro.
 */
const ORCAMENTO = {
  primeiroCard: 15000,
  paginar: 4000,
  mensagemNova: 8000,
};

// Semear 1240 documentos e abrir três telas não cabe nos 60s padrão.
test.setTimeout(120000);

let turma;

test.beforeEach(async () => {
  await limparTudo();
  turma = await semearSalaCheia();
});

/** Quanto tempo uma ação levou, medido do lado do teste. */
async function cronometrar(acao) {
  const comeco = Date.now();

  await acao();

  return Date.now() - comeco;
}

test('a sala cheia foi semeada com os números do alvo do projeto', async () => {
  // A guarda do arquivo. Sem ela, um erro na fixture — 20 chamados em vez de
  // 200 — deixaria todos os testes abaixo verdes provando o cenário fácil.
  expect(turma).toHaveLength(TURMA_DE_CARGA);
  expect(CHAMADOS_DE_CARGA).toBe(200);
  expect(MENSAGENS_DE_CARGA).toBe(1000);
});

test('a fila do professor desenha uma página, e não os 200 chamados (AC-PERF-05)', async ({
  page,
}) => {
  const ateOPrimeiroCard = await cronometrar(async () => {
    await entrar(page, CARLOS);
    await abrirSala(page, SALA.id);
    // A fila é do mais antigo para o mais novo (`ordenarFila`): quem esperou
    // mais é quem o professor atende primeiro. A primeira página é, portanto,
    // as dúvidas 001 a 030.
    await expect(page.getByText('Dúvida número 001')).toBeVisible();
  });

  const cards = page.locator('.problemas-list .problema-card');

  // A asserção que importa: 200 no banco, 30 na tela.
  await expect(cards).toHaveCount(CARDS_POR_PAGINA);

  // E a 200ª não está montada em lugar nenhum — não é um card fora da área
  // visível, é um card que não existe.
  await expect(page.getByText('Dúvida número 200')).toHaveCount(0);

  // E o resto está anunciado, não escondido: o professor precisa saber que a
  // fila continua abaixo (AC-CHAMADO-09).
  const carregarMais = page.getByRole('button', { name: /carregar mais/i });

  await expect(carregarMais).toContainText(String(CHAMADOS_DE_CARGA - CARDS_POR_PAGINA));

  const aoPaginar = await cronometrar(async () => {
    await carregarMais.click();
    await expect(cards).toHaveCount(CARDS_POR_PAGINA * 2);
    await expect(page.getByText('Dúvida número 060')).toBeVisible();
  });

  expect(ateOPrimeiroCard).toBeLessThan(ORCAMENTO.primeiroCard);
  expect(aoPaginar).toBeLessThan(ORCAMENTO.paginar);
});

test('o painel da turma mostra os 40 alunos sem paginar (AC-PERF-05, AC-SALA-08)', async ({
  page,
}) => {
  await entrar(page, CARLOS);
  await abrirSala(page, SALA.id);

  const linhas = page.getByRole('region', { name: 'Turma da sala' }).getByRole('listitem');

  // 40 alunos mais o professor dono. A turma inteira cabe numa leitura porque o
  // teto de `listarMembros` é 60 — a folga sobre o alvo de 40 (AC-SALA-08).
  await expect(linhas).toHaveCount(TURMA_DE_CARGA + 1);
  await expect(linhas.filter({ hasText: 'Colega 38' })).toBeVisible();
});

test('o chat com 1000 mensagens monta 50 balões (AC-PERF-05, AC-CHAT-06)', async ({ page }) => {
  await entrar(page, ANA);
  await abrirSala(page, SALA.id);
  await abrirChat(page);

  const baloes = page.locator('.mensagens-lista > li');

  await expect(page.getByText(`Mensagem de carga ${MENSAGENS_DE_CARGA}`)).toBeVisible();
  await expect(baloes).toHaveCount(MENSAGENS_POR_PAGINA);

  // A mais antiga do dia não está no DOM: é o `limit()` da consulta, e não um
  // `overflow: hidden` escondendo 950 elementos montados.
  await expect(page.getByText('Mensagem de carga 1', { exact: true })).toHaveCount(0);
});

test('escrever no chat cheio continua respondendo (AC-PERF-05)', async ({ page }) => {
  await entrar(page, ANA);
  await abrirSala(page, SALA.id);
  await abrirChat(page);

  await expect(page.getByText(`Mensagem de carga ${MENSAGENS_DE_CARGA}`)).toBeVisible();

  // O gesto mais comum da aula, na sala mais cheia do ano: escrever e ver o
  // próprio balão. É o que o aluno sente como "o app travou".
  const ateAparecer = await cronometrar(async () => {
    await page.getByPlaceholder('Escreva uma mensagem').fill('Professor, e a mil e uma?');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.getByText('e a mil e uma?')).toBeVisible();
  });

  expect(ateAparecer).toBeLessThan(ORCAMENTO.mensagemNova);

  // A janela continua sendo de 50 depois do envio: a mensagem nova entra e a
  // mais antiga da janela sai. Sem isto, o chat de uma aula longa cresceria
  // sem teto na memória do navegador.
  await expect(page.locator('.mensagens-lista > li')).toHaveCount(MENSAGENS_POR_PAGINA);
});
