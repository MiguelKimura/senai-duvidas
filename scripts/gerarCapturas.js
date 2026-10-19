#!/usr/bin/env node
/*
 * As capturas de tela dos manuais — AC-DOC-03, AC-DOC-04.
 *
 * Uso:
 *   npm run emulators                 (numa aba, e deixe rodando)
 *   npm run build:e2e                 (o mesmo build que a suíte e2e serve)
 *   npx serve --single --listen 3100 build-e2e
 *   npm run capturas
 *
 * Ou, mais curto, se a suíte e2e já subiu tudo nesta máquina: `npm run capturas`
 * reaproveita o que estiver de pé nas portas de sempre.
 *
 * **Por que um script e não uma captura recortada à mão.** Uma imagem tirada à mão
 * não se refaz quando a tela muda: ela envelhece em silêncio, o manual passa a
 * mostrar uma interface que não existe mais, e o aluno que segue o passo a passo
 * procura um botão que saiu do lugar. Um manual com captura errada é pior do que
 * um sem captura — ele dá a impressão de estar conferido.
 *
 * **Por que não dentro da suíte de testes.** Ele escreve em `docs/imagens/`, e um
 * teste que reescreve arquivos versionados a cada execução deixa o `git status`
 * sujo no meio de qualquer outra coisa que se esteja fazendo. Ele roda quando a
 * interface muda, de propósito, e o commit das imagens é o registro de que
 * alguém olhou para elas.
 *
 * **O que é semeado, e por quê.** O mesmo cenário determinístico da suíte e2e —
 * as mesmas três pessoas, a mesma sala, os mesmos horários. Uma captura com dado
 * inventado na hora mostraria "Teste 123" no lugar onde o aluno vai ler o nome
 * dele, e o cenário compartilhado é o que mantém o manual e os testes falando da
 * mesma tela.
 *
 * A execução **apaga o banco do emulador**, como toda a suíte e2e. A guarda de
 * `projetoDeTeste.js` recusa qualquer projeto que não comece com `demo-`.
 */
const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require('@playwright/test');

const {
  ANA,
  CARLOS,
  SALA,
  semearCenarioCompleto,
  semearChamado,
  semearConversaDaSala,
  semearMensagem,
} = require('../tests/e2e/fixtures/cenario');
const { ENDERECO_DO_APP, limparTudo } = require('../tests/e2e/fixtures/emulador');

/** Onde as imagens ficam. É a pasta que os dois manuais referenciam. */
const PASTA = path.join(__dirname, '..', 'docs', 'imagens');

/**
 * A janela das capturas.
 *
 * 1024×768 é a tela do laboratório, e é a mesma da suíte e2e: o manual mostra o
 * app no tamanho em que ele é usado, não numa janela larga que faz o layout de
 * duas colunas parecer o normal.
 */
const JANELA = { width: 1024, height: 768 };

/**
 * O contexto de toda captura.
 *
 * `reducedMotion: 'reduce'` é a mesma preferência do sistema operacional que o
 * app já respeita (AC-ANIM-06): com ela, a tela chega ao estado final sem
 * transição, e a captura mostra o que o usuário lê, não um quadro do meio do
 * caminho.
 */
const CONTEXTO = { viewport: JANELA, locale: 'pt-BR', reducedMotion: 'reduce' };

/** Uma captura: nome do arquivo e o que ela mostra, em ordem de manual. */
const capturas = [];

/**
 * Salva a imagem e registra o que foi salvo.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} nome sem extensão.
 * @param {import('@playwright/test').Locator} [alvo] recorte, quando a tela
 *   inteira mostraria menos do que a parte que interessa.
 */
async function capturar(page, nome, alvo) {
  const arquivo = path.join(PASTA, `${nome}.png`);

  // `animations: 'disabled'` congela a animação de entrada dos cards no estado
  // final. Sem isso a captura sai no meio do fade, com o texto pela metade — e
  // sair pela metade em algumas execuções e não em outras é o mesmo defeito de
  // um teste intermitente, com a diferença de que ninguém roda o manual de novo.
  await (alvo || page).screenshot({ path: arquivo, animations: 'disabled' });

  capturas.push(nome);
  process.stdout.write(`  ${nome}.png\n`);
}

/**
 * Entra pela tela de login, como o usuário entra.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{email: string, senha: string}} pessoa
 */
async function entrar(page, { email, senha }) {
  await page.goto(ENDERECO_DO_APP);
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(senha);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/'), { timeout: 20000 });
}

/** Abre uma página e espera o conteúdo, nunca um tempo. */
async function ir(page, caminho, esperar) {
  await page.goto(`${ENDERECO_DO_APP}${caminho}`);
  await esperar.waitFor({ state: 'visible', timeout: 20000 });
}

/** As telas do manual do aluno. */
async function capturarOAluno(navegador) {
  const contexto = await navegador.newContext({ ...CONTEXTO });
  const page = await contexto.newPage();

  await page.goto(ENDERECO_DO_APP);
  await page.getByRole('button', { name: /^entrar$/i }).waitFor();
  await capturar(page, 'aluno-login');

  await entrar(page, ANA);

  await ir(page, '/salas', page.getByRole('heading', { name: SALA.nome }));
  await capturar(page, 'aluno-minhas-salas');

  await ir(page, '/salas/entrar', page.getByLabel('PIN da sala'));
  await capturar(page, 'aluno-entrar-com-pin');

  // Dois cards, e não "pelo menos um": a espera pelo primeiro resolve enquanto o
  // segundo ainda está chegando, e a captura sai com metade da fila.
  await ir(page, `/sala/${SALA.id}`, page.locator('.problema-card').first());
  await page.locator('.problema-card').nth(1).waitFor();
  await capturar(page, 'aluno-fila-da-sala');

  // O modal com o texto já digitado e as opções avançadas abertas: é a tela do
  // passo a passo, e não a caixa vazia que aparece no primeiro clique.
  await page.getByRole('button', { name: /abrir novo chamado/i }).click();

  const modal = page.getByRole('dialog', { name: /descreva o seu problema/i });

  await modal.getByPlaceholder('Descreva o problema').fill(
    'O torno travou no meio do exercício. Segue o print do erro.'
  );
  await modal.getByText(/opções avançadas/i).click();
  await modal.getByRole('radio', { name: /verde/i }).waitFor();
  await capturar(page, 'aluno-novo-chamado', modal);

  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: /abrir o chat/i }).click();

  const chat = page.locator('.chat-box');

  // A última mensagem, e não a primeira: a lista rola para o fim ao abrir, e a
  // captura feita antes disso mostra o painel em branco com a conversa fora de
  // vista. O recorte é o painel — a tela inteira mostraria a fila atrás dele.
  await chat.getByRole('listitem').last().waitFor();
  await capturar(page, 'aluno-chat-da-sala', chat);

  await contexto.close();
}

/** As telas do manual do professor. */
async function capturarOProfessor(navegador) {
  const contexto = await navegador.newContext({ ...CONTEXTO });
  const page = await contexto.newPage();

  await entrar(page, CARLOS);

  await ir(page, `/sala/${SALA.id}`, page.locator('.problema-card').first());
  await page.locator('.problema-card').nth(1).waitFor();
  await capturar(page, 'professor-fila-da-sala');

  const painel = page.getByRole('region', { name: /conceder premia/i });

  if (await painel.count()) {
    await painel.scrollIntoViewIfNeeded();
    await capturar(page, 'professor-painel-de-premiacoes', painel);
  }

  // A sala nova, criada aqui, é a única forma de mostrar a tela do PIN: o número
  // aparece uma vez só, e não existe caminho para revê-lo depois (AC-SEC-05).
  await ir(page, '/salas/nova', page.getByLabel('Nome da sala'));
  await page.getByLabel('Nome da sala').fill('Eletrônica 1º ano');
  await page.getByLabel('Curso ou turma').fill('Eletrônica — Turma A');
  await page.getByLabel('Ano letivo').fill(String(SALA.anoLetivo));
  await capturar(page, 'professor-criar-sala');

  await page.getByRole('button', { name: /criar sala/i }).click();
  await page.getByTestId('pin-em-destaque').waitFor();
  await capturar(page, 'professor-sala-criada-com-pin');

  await contexto.close();
}

async function principal() {
  fs.mkdirSync(PASTA, { recursive: true });

  process.stdout.write(`Semeando o cenário no emulador…\n`);
  await limparTudo();
  await semearCenarioCompleto();
  await semearChamado({ id: 'chamado-do-torno' });
  await semearChamado({
    id: 'chamado-da-fresa',
    autor: ANA,
    descricao: 'A fresa está sem fio — já troquei a pastilha e continua raspando.',
    cor: '#e0f5e0',
  });
  await semearMensagem({ id: 'mensagem-do-professor', autor: CARLOS, texto: 'Bom dia, turma.' });
  await semearConversaDaSala({ quantidade: 6, primeiraHora: 9 });

  process.stdout.write(`Capturando em ${path.relative(process.cwd(), PASTA)}:\n`);

  const navegador = await chromium.launch({ channel: process.env.PLAYWRIGHT_CANAL || undefined });

  try {
    await capturarOAluno(navegador);
    await capturarOProfessor(navegador);
  } finally {
    await navegador.close();
  }

  process.stdout.write(`\n${capturas.length} capturas.\n`);
}

if (require.main === module) {
  principal().catch((erro) => {
    process.stderr.write(
      `${erro.stack}\n\n` +
        'Confira se o Emulator Suite está de pé (`npm run emulators`) e se o build de e2e ' +
        `está sendo servido em ${ENDERECO_DO_APP} (\`npm run build:e2e\` e \`npx serve --single ` +
        '--listen 3100 build-e2e`).\n'
    );
    process.exitCode = 1;
  });
}

module.exports = { JANELA, PASTA };
