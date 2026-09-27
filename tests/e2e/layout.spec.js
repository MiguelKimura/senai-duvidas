// Layout medido em pixel, nas duas telas que existem de verdade — AC-ANIM-08.
//
// Este arquivo existe porque o AC-ANIM-08 estava marcado 🟡 desde a v0.10.0, e a
// razão está escrita no próprio documento de critérios: os testes de
// responsividade leem o **texto** do CSS. Eles provam que existe uma regra no
// ponto de corte combinado; não provam que um pixel caiu onde deveria, porque o
// jsdom não aplica folha de estilo nem calcula posição.
//
// Aqui há layout de verdade, e a asserção é geométrica.
//
// **Os dois tamanhos não são exemplos.** 1024×768 é a tela dos laboratórios do
// SENAI — é onde o sistema roda todos os dias, e é onde a v0.10.0 descobriu que a
// fila vazava por causa de um `calc(100vh - …)` dentro de uma coluna de `95vh`.
// 360×640 é o piso do critério: o celular mais estreito que ainda se encontra na
// mão de um aluno.
//
// **O que se mede é o vazamento horizontal.** Rolar para baixo é normal numa
// fila de dúvidas; rolar para o lado não é — é o sintoma de um elemento mais
// largo que a tela, e o defeito que faz o botão de enviar ficar fora do alcance.
// `scrollWidth` contra `clientWidth` é a medida exata disso, e ela é objetiva:
// não há tolerância a escolher nem captura de tela para comparar.
const { expect, test } = require('@playwright/test');
const { ANA, CARLOS, SALA, semearCenarioCompleto, semearChamado } = require('./fixtures/cenario');
const { limparTudo } = require('./fixtures/emulador');
const { abrirChat, abrirSala, entrar } = require('./fixtures/app');

/** A tela dos laboratórios. É a mesma do `playwright.config.js`. */
const LABORATORIO = { width: 1024, height: 768 };

/** O piso do critério: o celular mais estreito que o AC-ANIM-08 nomeia. */
const CELULAR = { width: 360, height: 640 };

test.beforeEach(async () => {
  await limparTudo();
  await semearCenarioCompleto();
  // Uma dúvida longa e uma curta: o texto longo é o que estica um card além da
  // coluna, e com a fila vazia não haveria card nenhum para medir. A palavra
  // sem espaço no fim é de propósito — é o caso que só `overflow-wrap` resolve,
  // e o que um aluno produz colando um caminho de arquivo.
  await semearChamado({
    id: 'chamado-longo',
    autor: ANA,
    descricao:
      'O torno travou no meio do exercício e o mandril não solta a peça de jeito ' +
      'nenhum, mesmo com a chave. Tentei desligar e ligar de novo e continua igual. ' +
      'Palavradecinquentaletrassemespaconenhumparaforcaralinhaaquebrar',
  });
  await semearChamado({ id: 'chamado-curto', autor: ANA, descricao: 'A furadeira não liga.' });
});

/**
 * Quantos pixels a página vaza para o lado. Zero é o esperado em toda tela.
 *
 * Mede no `documentElement` **e** no `body`: uma folha que fixa `overflow-x:
 * hidden` no body esconde o vazamento da barra de rolagem sem consertá-lo, e a
 * segunda medida é o que impede este teste de aceitar esse disfarce.
 */
function vazamentoHorizontal(page) {
  return page.evaluate(() => {
    const raiz = document.documentElement;

    return {
      documento: raiz.scrollWidth - raiz.clientWidth,
      corpo: document.body.scrollWidth - raiz.clientWidth,
    };
  });
}

/**
 * Os elementos cujo lado direito passa da borda da janela.
 *
 * O complemento do vazamento: quando o `overflow-x: hidden` de uma folha corta a
 * barra de rolagem, `scrollWidth` volta a zero e o elemento continua fora do
 * alcance do dedo. Aqui a pergunta é sobre a caixa de cada elemento.
 *
 * Um pixel de tolerância porque `getBoundingClientRect` devolve fração — uma
 * borda de meio pixel arredondada para cima apareceria como vazamento.
 */
function elementosForaDaTela(page) {
  return page.evaluate(() => {
    const largura = window.innerWidth;
    const interessantes = 'button, input, a, .problema-card, h1, h2';

    return [...document.querySelectorAll(interessantes)]
      .map((no) => ({ no, caixa: no.getBoundingClientRect() }))
      // Elemento sem área é elemento escondido: não tem lado direito para vazar.
      .filter(({ caixa }) => caixa.width > 0 && caixa.height > 0 && caixa.right > largura + 1)
      .map(({ no, caixa }) => `${no.tagName.toLowerCase()}.${no.className}: ${caixa.right}px`);
  });
}

/** O par de asserções que toda tela deste arquivo faz. */
async function naoVazaParaOLado(page) {
  expect(await vazamentoHorizontal(page)).toEqual({ documento: 0, corpo: 0 });
  expect(await elementosForaDaTela(page)).toEqual([]);
}

test.describe('na 1024×768 dos laboratórios', () => {
  test.use({ viewport: LABORATORIO });

  test('o login não vaza para o lado (AC-ANIM-08)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^entrar$/i })).toBeVisible();

    await naoVazaParaOLado(page);
  });

  test('a tela da aluna cabe, com a fila e o botão de abrir dúvida (AC-ANIM-08)', async ({
    page,
  }) => {
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);

    await expect(page.locator('.problema-card')).toHaveCount(2);
    await naoVazaParaOLado(page);

    // O botão de abrir dúvida dentro da janela, e não abaixo dela: é o gesto
    // principal da tela do aluno, e foi ele que a v0.10.0 viu vazar.
    const caixa = await page.getByRole('button', { name: /abrir novo chamado/i }).boundingBox();

    expect(caixa.y + caixa.height).toBeLessThanOrEqual(LABORATORIO.height);
  });

  test('a tela do professor cabe com o painel da turma e o de perks (AC-ANIM-08)', async ({
    page,
  }) => {
    // A tela mais cheia do sistema: cabeçalho, turma, premiações e a fila. É
    // onde duas colunas disputam a largura.
    await entrar(page, CARLOS);
    await abrirSala(page, SALA.id);

    await expect(page.getByRole('region', { name: 'Turma da sala' })).toBeVisible();
    await naoVazaParaOLado(page);
  });

  test('o chat aberto não empurra a fila para fora (AC-ANIM-08)', async ({ page }) => {
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);
    await abrirChat(page);

    await naoVazaParaOLado(page);
  });

  test('a conversa fica com o painel, e não com o botão de histórico (AC-CHAT-05)', async ({
    page,
  }) => {
    // Encontrado tirando as capturas do manual do aluno: o painel de 440px
    // mostrava três mensagens, e o resto era um botão "Ver dias anteriores" de
    // 170px de altura com o fundo transparente — espaço vazio, ao clique, que
    // ninguém identificaria como botão.
    //
    // A causa é uma regra solta: `Modal.css` declara `button { flex: 1 }` sem
    // escopo nenhum, e o CSS do Create React App é global. Todo botão que for
    // item de um flex em coluna cresce até preencher o que sobrar — e o do
    // histórico é o único item da coluna que não devia crescer.
    //
    // Nenhum teste de jsdom pega isso: ali não há layout. A medida é a razão
    // entre a área de conversa e o painel, e não um número de pixels — o painel
    // muda de altura entre o laboratório e o celular, a proporção não.
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);
    await abrirChat(page);

    const painel = await page.locator('.chat-box').boundingBox();
    const conversa = await page.locator('.mensagens-rolagem').boundingBox();
    const historico = await page.getByRole('button', { name: /ver dias anteriores/i }).boundingBox();

    expect(conversa.height).toBeGreaterThan(painel.height * 0.5);

    // E o botão tem a altura de um botão: o teto é generoso de propósito, para
    // o teste não reprovar uma mudança de fonte ou de espaçamento.
    expect(historico.height).toBeLessThan(60);
  });

  test('o modal de nova dúvida cabe na janela (AC-ANIM-08)', async ({ page }) => {
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);
    await page.getByRole('button', { name: /abrir novo chamado/i }).click();

    const modal = page.getByRole('dialog', { name: /descreva o seu problema/i });

    await expect(modal).toBeVisible();
    await naoVazaParaOLado(page);

    const caixa = await modal.boundingBox();

    expect(caixa.width).toBeLessThanOrEqual(LABORATORIO.width);
  });
});

test.describe('em celular de 360×640', () => {
  test.use({ viewport: CELULAR });

  test('o login não vaza na tela estreita (AC-ANIM-08)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^entrar$/i })).toBeVisible();

    await naoVazaParaOLado(page);
  });

  test('a fila da aluna cabe em 360px, texto longo incluído (AC-ANIM-08)', async ({ page }) => {
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);

    const card = page.locator('.problema-card').first();

    await expect(card).toBeVisible();
    await naoVazaParaOLado(page);

    const caixa = await card.boundingBox();

    expect(caixa.width).toBeLessThanOrEqual(CELULAR.width);
  });

  test('o chat vira painel de tela cheia, e não uma coluna de lado (AC-ANIM-08)', async ({
    page,
  }) => {
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);
    await abrirChat(page);

    await naoVazaParaOLado(page);

    // Abaixo de 768px o painel ocupa a largura da tela: uma coluna lateral de
    // 320px sobre uma tela de 360 deixaria 40px para a conversa.
    const caixa = await page.locator('.chat-box').boundingBox();

    expect(caixa.width).toBeGreaterThan(CELULAR.width * 0.9);
    expect(caixa.width).toBeLessThanOrEqual(CELULAR.width);

    // E o campo de escrever cabe inteiro, que é o que decide se dá para usar.
    const doCampo = await page.getByPlaceholder('Escreva uma mensagem').boundingBox();

    expect(doCampo.x + doCampo.width).toBeLessThanOrEqual(CELULAR.width);
  });

  test('o modal de nova dúvida cabe em 360px (AC-ANIM-08)', async ({ page }) => {
    await entrar(page, ANA);
    await abrirSala(page, SALA.id);
    await page.getByRole('button', { name: /abrir novo chamado/i }).click();

    const modal = page.getByRole('dialog', { name: /descreva o seu problema/i });

    await expect(modal).toBeVisible();
    await naoVazaParaOLado(page);

    // O botão de concluir dentro da tela: é o fim do fluxo, e um botão fora do
    // alcance aqui significa que o aluno não consegue abrir a dúvida do celular.
    const caixa = await modal.getByRole('button', { name: /^concluir$/i }).boundingBox();

    expect(caixa.x + caixa.width).toBeLessThanOrEqual(CELULAR.width);
  });
});
