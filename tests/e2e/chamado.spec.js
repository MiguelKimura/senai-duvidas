// Fluxos críticos 3 e 4 — abrir chamado com imagem, e excluir chamado —
// AC-TEST-06.
//
// Estes dois fluxos ficam no mesmo arquivo porque são o mesmo card visto de dois
// lados, e porque o segundo depende do primeiro: só se exclui o que se abriu.
//
// O que só um navegador de verdade prova aqui:
//
//   * **o upload.** A suíte unitária troca `enviarAnexo` por um duplo — em jsdom
//     não há `createImageBitmap` nem `canvas.toBlob`, que é como
//     `services/anexos.js` comprime. Aqui o PNG atravessa a compressão, sobe
//     para o emulador de Storage e volta por URL de download.
//   * **o `.exe` renomeado** (AC-SEC-08). A recusa por magic bytes acontece no
//     cliente, antes de a rede ser tocada, e é o caminho que o aluno de
//     informática tenta.
//   * **o tempo real.** O card aparecendo na tela do professor é um
//     `onSnapshot` atravessando processo, WebChannel e reconciliação do React —
//     nenhuma das três coisas existe quando o teste unitário chama o callback do
//     snapshot à mão.
//   * **os cinco segundos de desfazer** (AC-CHAMADO-04). O prazo é um
//     `setTimeout` de verdade, e o que o cancela é um clique de verdade.
const { expect, test } = require('@playwright/test');
const {
  ANA,
  BIA,
  CARLOS,
  SALA,
  semearCenarioCompleto,
  semearChamado,
} = require('./fixtures/cenario');
const { idsDe, ler, limparTudo } = require('./fixtures/emulador');
const { ARQUIVO_EXE_DISFARCADO, ARQUIVO_PNG, abrirSala, entrar } = require('./fixtures/app');

test.beforeEach(async () => {
  await limparTudo();
  await semearCenarioCompleto();
});

/** Abre o modal de novo chamado e devolve o diálogo. */
async function abrirModal(page) {
  await page.getByRole('button', { name: /abrir novo chamado/i }).click();

  const modal = page.getByRole('dialog', { name: /descreva o seu problema/i });

  await expect(modal).toBeVisible();

  return modal;
}

test('a aluna abre um chamado com print, cor e markdown, e o card aparece (AC-CHAMADO-01, AC-IMG-02, AC-COR-01)', async ({
  page,
}) => {
  await entrar(page, ANA);
  await abrirSala(page, SALA.id);

  const modal = await abrirModal(page);

  await modal
    .getByPlaceholder('Descreva o problema')
    .fill('O **torno** travou no meio do exercício.');

  // O upload passa pelo seletor de arquivo, que é o caminho de quem já tem o
  // print salvo. Arrastar e colar desembocam na mesma função — provado em
  // `src/components/__tests__/CampoAnexo.test.js`, onde não há rede no caminho.
  await modal.getByLabel('Anexar imagem do computador').setInputFiles(ARQUIVO_PNG);

  // A prévia aparecendo é o upload concluído: o `src` dela é a URL de download
  // que o Storage devolveu.
  await expect(modal.getByAltText('Pré-visualização do anexo')).toBeVisible();

  // As opções avançadas: a cor escolhida à mão substitui o sorteio (AC-COR-05).
  await modal.getByText(/opções avançadas/i).click();
  await modal.getByRole('radio', { name: /verde/i }).click();

  await modal.getByRole('button', { name: /^concluir$/i }).click();

  await expect(modal).toHaveCount(0);

  // O card na fila, com o markdown interpretado — `**torno**` virou <strong>,
  // e não ficou como texto com asteriscos (AC-COR-07).
  const card = page.locator('.problema-card').filter({ hasText: /torno travou/ });

  await expect(card).toBeVisible();
  await expect(card.locator('strong', { hasText: 'torno' })).toBeVisible();
  // Desde a v1.1.0 o card mostra o olho, e não a miniatura do print.
  await expect(card.getByRole('button', { name: /ver imagem/i })).toBeVisible();

  // E o documento no banco: o anexo gravado nos dois formatos, que é a
  // compatibilidade que a 1.0.0 mantém (AC-IMG-13, docs/MIGRACOES.md).
  const [chamadoId] = await idsDe(`salas/${SALA.id}/chamados`);
  const gravado = await ler(`salas/${SALA.id}/chamados/${chamadoId}`);

  expect(gravado.imagem.stringValue).toMatch(/^http/);
  expect(gravado.anexo.mapValue.fields.caminho.stringValue).toContain(
    `salas/${SALA.id}/chamados/${chamadoId}/`
  );
  expect(gravado.formato.stringValue).toBe('markdown');
  expect(gravado.autorUid.stringValue).toBe(ANA.uid);
  // A escrita dupla do autor continua: `nome` é o que o cliente da v0.4.0 lê.
  expect(gravado.nome.stringValue).toBe(ANA.nome);
});

test('descrição vazia e descrição gigante são recusadas na tela (AC-CHAMADO-01)', async ({
  page,
}) => {
  await entrar(page, ANA);
  await abrirSala(page, SALA.id);

  const modal = await abrirModal(page);

  await modal.getByRole('button', { name: /^concluir$/i }).click();

  await expect(modal.getByRole('alert')).toBeVisible();
  // O modal continua aberto: recusar não pode fechar a janela e perder o texto.
  await expect(modal).toBeVisible();

  await modal.getByPlaceholder('Descreva o problema').fill('x'.repeat(1001));
  await modal.getByRole('button', { name: /^concluir$/i }).click();

  await expect(modal.getByRole('alert')).toContainText(/1000/);
  await expect(modal).toBeVisible();

  // Nada foi gravado por nenhuma das duas tentativas.
  expect(await idsDe(`salas/${SALA.id}/chamados`)).toEqual([]);
});

test('um .exe renomeado para .png é recusado antes de sair da máquina (AC-SEC-08)', async ({
  page,
}) => {
  await entrar(page, ANA);
  await abrirSala(page, SALA.id);

  const modal = await abrirModal(page);

  await modal.getByLabel('Anexar imagem do computador').setInputFiles(ARQUIVO_EXE_DISFARCADO);

  await expect(modal.getByRole('alert')).toContainText(/imagem/i);
  await expect(modal.getByAltText('Pré-visualização do anexo')).toHaveCount(0);

  // E nada subiu: o arquivo é recusado pela assinatura, não pelo nome.
  expect(await idsDe(`salas/${SALA.id}/chamados`)).toEqual([]);
});

test('o card da aluna aparece na tela do professor em tempo real (AC-CHAMADO-02, AC-CHAMADO-09)', async ({
  browser,
}) => {
  const doProfessor = await browser.newContext();
  const telaDoProfessor = await doProfessor.newPage();

  await entrar(telaDoProfessor, CARLOS);
  await abrirSala(telaDoProfessor, SALA.id);

  // A fila do professor começa vazia, e a asserção é sobre a transição: é ela
  // que prova o tempo real. Sem esta linha, o teste passaria mesmo se a tela só
  // carregasse os chamados na montagem.
  await expect(telaDoProfessor.locator('.problema-card')).toHaveCount(0);

  const daAluna = await browser.newContext();
  const telaDaAluna = await daAluna.newPage();

  await entrar(telaDaAluna, ANA);
  await abrirSala(telaDaAluna, SALA.id);

  const modal = await abrirModal(telaDaAluna);

  await modal.getByPlaceholder('Descreva o problema').fill('A furadeira não liga.');
  await modal.getByRole('button', { name: /^concluir$/i }).click();

  // Sem recarregar nada do lado do professor: o `onSnapshot` entrega.
  await expect(
    telaDoProfessor.locator('.problema-card').filter({ hasText: 'A furadeira não liga.' })
  ).toBeVisible();
  await expect(telaDoProfessor.getByText(ANA.nome).first()).toBeVisible();

  await doProfessor.close();
  await daAluna.close();
});

test('a aluna exclui a própria dúvida, com confirmação e cinco segundos de volta (AC-CHAMADO-04, AC-CHAMADO-06)', async ({
  page,
}) => {
  await semearChamado({ id: 'chamado-da-ana', autor: ANA, descricao: 'O torno travou.' });

  await entrar(page, ANA);
  await abrirSala(page, SALA.id);

  const card = page.locator('.problema-card').filter({ hasText: 'O torno travou.' });

  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /excluir/i }).click();

  // A confirmação é a parte do critério que a v0.9.0 ainda não tinha: um clique
  // só apagava a dúvida e o print junto.
  const confirmacao = page.getByRole('dialog', { name: /excluir esta dúvida\?/i });

  await expect(confirmacao).toBeVisible();
  await confirmacao.getByRole('button', { name: /^excluir$/i }).click();

  // O card sai da fila dela na hora, e o aviso oferece a volta.
  await expect(card).toHaveCount(0);

  const aviso = page.getByRole('log');

  await expect(aviso).toContainText(/chamado excluído/i);
  await aviso.getByRole('button', { name: /desfazer/i }).click();

  // Desfeito: o card volta, e o documento nunca saiu do banco — é o desenho do
  // `useExclusaoComDesfazer`, que só grava quando o prazo vence.
  await expect(card).toBeVisible();
  expect(await idsDe(`salas/${SALA.id}/chamados`)).toContain('chamado-da-ana');
});

test('sem desfazer, o prazo vence e a exclusão vai ao banco (AC-CHAMADO-04)', async ({
  page,
}) => {
  await semearChamado({ id: 'chamado-da-ana', autor: ANA, descricao: 'O torno travou.' });

  await entrar(page, ANA);
  await abrirSala(page, SALA.id);

  await page
    .locator('.problema-card')
    .filter({ hasText: 'O torno travou.' })
    .getByRole('button', { name: /excluir/i })
    .click();

  await page
    .getByRole('dialog', { name: /excluir esta dúvida\?/i })
    .getByRole('button', { name: /^excluir$/i })
    .click();

  // A espera é pelo desaparecimento do aviso — a condição que marca o
  // vencimento do prazo —, e não por um número de milissegundos (AC-TEST-09).
  await expect(page.getByRole('log').getByRole('button', { name: /desfazer/i })).toHaveCount(0);

  await expect
    .poll(() => idsDe(`salas/${SALA.id}/chamados`), { message: 'o chamado sai do banco' })
    .toEqual([]);
});

test('a aluna não vê botão de excluir no chamado de outra pessoa (AC-CHAMADO-06)', async ({
  page,
}) => {
  await semearChamado({ id: 'chamado-da-bia', autor: BIA, descricao: 'A bancada está solta.' });

  await entrar(page, ANA);
  await abrirSala(page, SALA.id);

  const cardAlheio = page
    .locator('.problema-card')
    .filter({ hasText: 'A bancada está solta.' });

  await expect(cardAlheio).toBeVisible();
  await expect(cardAlheio.getByRole('button', { name: /excluir/i })).toHaveCount(0);

  // E o botão que não existe na tela também não existe no servidor: a rule
  // recusa a exclusão de chamado alheio, provado em `tests/rules/`. Aqui a
  // asserção é a da tela — o documento continua onde estava.
  expect(await idsDe(`salas/${SALA.id}/chamados`)).toContain('chamado-da-bia');
});
