// Compatibilidade de ponta a ponta: a 1.0.0 sobre o banco da v0.1.0.
//
// Passo 7 da task 09 e § 4 do `tasks/_PROTOCOLO.md`. Este é o arquivo que
// responde à pergunta que mais importa no dia do deploy: **o professor que tem
// dois anos de histórico vai abrir o app e encontrar os dados dele?**
//
// A suíte unitária já prova a leitura dupla em `src/__tests__/compatibilidadeFutura.test.js`
// e nos testes de `services/tempo.js`, e prova bem — com o Firestore falso. O que
// ela não pode provar é a soma: o app de produção, servido do `build/`, contra um
// Firestore de verdade que contém **só** documentos do formato antigo, com as
// Security Rules de hoje no caminho. É a soma que quebra, e é sempre num ponto que
// nenhuma das partes mostrava.
//
// O banco da v0.1.0 difere do atual em cinco pontos, e cada um é uma decisão que
// o app precisa continuar honrando:
//
//   1. `chamados` e `chat` são coleções **globais** — não existe sala;
//   2. `horario` é **string ISO**, gravada pelo relógio do navegador;
//   3. `imagem` é **string de URL**, não o mapa `anexo`;
//   4. o autor é identificado por `email`, não por `autorUid`;
//   5. `usuarios` não tem `criadoEm`.
//
// Sobre as migrações: elas rodam aqui **de verdade**, com o `firebase-admin`
// falando com o emulador, na sequência documentada em `docs/MIGRACOES.md` —
// `--dry-run`, execução, execução de novo (idempotência) e reversão. Os testes de
// `scripts/__tests__/` já cobrem o planejamento com dublês, e é o lugar certo para
// isso; o que eles não alcançam é o Firestore respondendo, que é onde um
// `merge: true` esquecido apaga um campo.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { expect, test } = require('@playwright/test');
const {
  ANA,
  CARLOS,
  HORARIO_LEGADO,
  semearBancoDaV010,
} = require('./fixtures/cenario');
const { HOST, PORTA_FIRESTORE, idsDe, ler, limparTudo, projeto } = require('./fixtures/emulador');
const { abrirSala, entrar } = require('./fixtures/app');

const RAIZ = path.join(__dirname, '..', '..');

// Semear, abrir três telas e rodar quatro migrações não cabe nos 60s padrão.
test.setTimeout(120000);

test.beforeEach(async () => {
  await limparTudo();
  await semearBancoDaV010();
});

/**
 * Roda um script de migração contra o emulador.
 *
 * `FIRESTORE_EMULATOR_HOST` é o que faz o `firebase-admin` falar com o emulador
 * em vez da nuvem, e `GCLOUD_PROJECT` é o projeto que ele assume sem credencial.
 * Sem os dois, este teste tentaria migrar um banco de produção — e é por isso que
 * `projeto()` é chamado aqui de novo, com a guarda do prefixo `demo-`.
 *
 * @param {string} script nome do arquivo em `scripts/`.
 * @param {Array<string>} argumentos
 * @returns {string} a saída padrão, que é o relatório da migração.
 */
function migrar(script, argumentos) {
  return execFileSync('node', [path.join('scripts', script), ...argumentos], {
    cwd: RAIZ,
    encoding: 'utf8',
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: `${HOST}:${PORTA_FIRESTORE}`,
      GCLOUD_PROJECT: projeto(),
      GOOGLE_CLOUD_PROJECT: projeto(),
    },
  });
}

/**
 * Leva o banco da v0.1.0 para dentro de uma sala, pelo caminho documentado.
 *
 * Desde a v1.1.0 a interface não lê mais as coleções globais: `/aluno` e
 * `/professor` redirecionam para `/salas`. O que continua valendo — e é o que
 * estes testes guardam — é que o documento no formato antigo, copiado pela
 * migração, aparece certo dentro da sala: horário em string ISO, `nome` sem
 * `autorNome`, `imagem` como string de URL.
 *
 * @returns {Promise<string>} o id da sala criada.
 */
async function migrarParaSala() {
  migrar('migrar-para-salas.js', ['--confirmar', '--professor', CARLOS.uid]);

  const [salaId] = await idsDe('salas');

  return salaId;
}

test('a aluna num banco sem sala nenhuma cai no PIN, e não na fila global (v1.1.0)', async ({
  page,
}) => {
  await entrar(page, ANA);

  await expect(page).toHaveURL(/\/salas$/);
  await expect(page.getByLabel('PIN da sala')).toBeVisible();
  await expect(page.locator('.problema-card')).toHaveCount(0);
});

test('o histórico da v0.1.0, migrado para a sala, aparece certo (AC-SALA-06, AC-TEMPO-08)', async ({
  page,
}) => {
  const salaId = await migrarParaSala();

  await entrar(page, ANA);
  await abrirSala(page, salaId);

  const comPrint = page.locator('.problema-card').filter({ hasText: 'olha o print' });
  const semPrint = page.locator('.problema-card').filter({ hasText: 'A furadeira' });

  await expect(comPrint).toBeVisible();
  await expect(semPrint).toBeVisible();

  // O horário: `2026-03-10T13:45:00.000Z` é 10:45 em Brasília. A string ISO da
  // v0.1.0 é lida pelo mesmo caminho do `Timestamp` de hoje (AC-TEMPO-08), e o
  // número na tela é o que separa as duas leituras — um `new Date()` cru sobre o
  // valor daria a hora do relógio da máquina.
  await expect(comPrint.locator('em')).toHaveText('10/03/2026 10:45');

  // A ordem: 10:45 antes de 11:10, crescente, como o AC-CHAMADO-03 pede — e
  // decidida entre duas strings ISO, que é o caso em que um `orderBy` do
  // servidor não serviria.
  const descricoes = await page.locator('.problema-card').allInnerTexts();

  expect(descricoes.findIndex((texto) => texto.includes('olha o print'))).toBeLessThan(
    descricoes.findIndex((texto) => texto.includes('A furadeira'))
  );

  // O anexo em formato de string de URL continua sendo um anexo (AC-IMG-13): o
  // olho aparece no card.
  await expect(comPrint.getByRole('button', { name: /ver imagem/i })).toBeVisible();
  // E o chamado sem anexo não ganha um botão para um arquivo que não existe.
  await expect(semPrint.getByRole('button', { name: /ver imagem/i })).toHaveCount(0);
});

test('a aluna usa as features novas sobre o banco antigo (AC-COR-01, AC-COR-07)', async ({
  page,
}) => {
  const salaId = await migrarParaSala();

  await entrar(page, ANA);
  await abrirSala(page, salaId);

  await page.getByRole('button', { name: /abrir novo chamado/i }).click();

  const modal = page.getByRole('dialog', { name: /descreva o seu problema/i });

  await modal.getByPlaceholder('Descreva o problema').fill('A **fresa** está sem fio.');
  await modal.getByText(/opções avançadas/i).click();
  await modal.getByRole('radio', { name: /verde/i }).click();
  await modal.getByRole('button', { name: /^concluir$/i }).click();

  await expect(modal).toHaveCount(0);

  const novo = page.locator('.problema-card').filter({ hasText: 'está sem fio' });

  await expect(novo).toBeVisible();
  // Markdown e cor escolhida — duas features que a v0.1.0 não tinha — num
  // documento que nasceu ao lado dos dela.
  await expect(novo.locator('strong', { hasText: 'fresa' })).toBeVisible();
});

test('o cliente da v0.1.0 lê sem quebrar o que a 1.0.0 grava (compatibilidade futura)', async ({
  page,
}) => {
  const salaId = await migrarParaSala();

  await entrar(page, ANA);
  await abrirSala(page, salaId);

  await page.getByRole('button', { name: /abrir novo chamado/i }).click();

  const modal = page.getByRole('dialog', { name: /descreva o seu problema/i });

  await modal.getByPlaceholder('Descreva o problema').fill('Escrito pela 1.0.0.');
  await modal.getByRole('button', { name: /^concluir$/i }).click();
  await expect(page.locator('.problema-card').filter({ hasText: 'pela 1.0.0' })).toBeVisible();

  const ids = await idsDe(`salas/${salaId}/chamados`);
  const idNovo = ids.find((id) => !id.startsWith('legado-'));

  expect(idNovo).toBeTruthy();

  // `horarioIso` não nasce com o documento: ele é escrito pelo cliente do autor
  // **depois** de o carimbo do servidor voltar, porque só então existe uma data
  // para converter (`services/tempo.js` › `completarHorarioIso`). A espera é por
  // condição, e ela é parte do que se está provando — a janela em que um cliente
  // da v0.1.0 leria `Invalid Date` é a duração desse ida e volta.
  await expect
    .poll(
      async () => (await ler(`salas/${salaId}/chamados/${idNovo}`)).horarioIso?.stringValue,
      {
        timeout: 15000,
      }
    )
    .toBeTruthy();

  const gravado = await ler(`salas/${salaId}/chamados/${idNovo}`);

  // O leitor da v0.1.0, reconstruído: ele conhece cinco campos e mais nada. Se
  // ele lançar exceção, é a tela branca no meio da aula de quem não atualizou a
  // aba — o cenário que o § 4 do protocolo existe para evitar.
  const leitorDaV010 = (campos) => ({
    nome: campos.nome.stringValue,
    email: campos.email.stringValue,
    descricao: campos.descricao.stringValue,
    // `new Date(...)` sobre um `Timestamp` do Firestore dá `Invalid Date`: é
    // exatamente por isso que `horarioIso` existe e continua sendo escrito.
    quando: new Date(campos.horarioIso.stringValue),
    imagem: campos.imagem.stringValue === undefined ? null : campos.imagem.stringValue,
  });

  expect(() => leitorDaV010(gravado)).not.toThrow();

  const lido = leitorDaV010(gravado);

  expect(lido.nome).toBe(ANA.nome);
  expect(lido.email).toBe(ANA.email);
  expect(Number.isNaN(lido.quando.getTime())).toBe(false);

  // E os campos novos estão lá, ao lado dos antigos — aditivos, nunca no lugar.
  expect(gravado.autorUid.stringValue).toBe(ANA.uid);
  expect(gravado.horario.timestampValue).toBeTruthy();
});

test('o professor também vê o histórico migrado, e a mensagem antiga do chat', async ({
  page,
}) => {
  const salaId = await migrarParaSala();

  await entrar(page, CARLOS);
  await abrirSala(page, salaId);

  await expect(
    page.locator('.problema-card').filter({ hasText: 'olha o print' })
  ).toBeVisible();

  await page
    .getByRole('button', { name: /chat|conversa/i })
    .first()
    .click();

  // A conversa de março de 2026 não é a de hoje: o chat abre no dia corrente
  // (AC-TEMPO-07) e o histórico fica atrás do botão. Vale como asserção — é o
  // caminho que o professor percorre para reler a aula passada.
  await page.getByRole('button', { name: /ver dias anteriores/i }).click();

  // A mensagem da v0.1.0 tem `nome` e `texto`, e nenhum `autorUid`: o balão é
  // montado pelo mesmo caminho de leitura dupla dos chamados.
  const balao = page.getByRole('listitem').filter({ hasText: 'Hoje é torno' });

  await expect(balao).toBeVisible();
  await expect(balao).toContainText(CARLOS.nome);
});

test('o app preenche horarioIso sozinho no chamado antigo do próprio autor', async ({
  page,
}) => {
  const salaId = await migrarParaSala();
  const caminho = `salas/${salaId}/chamados/legado-com-print`;

  // Antes de a Ana entrar, os documentos dela não têm o campo.
  const antes = await ler(caminho);

  expect(antes.horarioIso).toBeUndefined();

  await entrar(page, ANA);
  await abrirSala(page, salaId);
  await expect(
    page.locator('.problema-card').filter({ hasText: 'olha o print' })
  ).toBeVisible();

  // `completarHorariosIso` escreve só nos documentos de quem está logado, e a
  // rule aceita porque `horario` não mudou. A espera é por condição — o valor
  // aparecendo no banco —, nunca por tempo.
  await expect
    .poll(async () => (await ler(caminho)).horarioIso?.stringValue, {
      timeout: 15000,
    })
    .toBe(new Date(HORARIO_LEGADO).toISOString());

  // E `horario` continua intocado: a migração é aditiva, nunca reescreve.
  const depois = await ler(caminho);

  expect(depois.horario.stringValue).toBe(HORARIO_LEGADO);
});

test('as migrações rodam na ordem documentada, são idempotentes e reversíveis', async () => {
  // 1. `--dry-run` não grava uma linha. É a regra 1 de `docs/MIGRACOES.md`, e é
  //    a única que dá para desobedecer sem ninguém notar.
  const simulacao = migrar('migrar-horarios.js', ['--dry-run']);

  expect(simulacao).toMatch(/chamados/);
  expect((await ler('chamados/legado-com-print')).horarioIso).toBeUndefined();

  // 2. A execução preenche o campo aditivo, sem tocar em `horario`.
  migrar('migrar-horarios.js', ['--confirmar']);

  const comIso = await ler('chamados/legado-com-print');

  expect(comIso.horarioIso.stringValue).toBe(new Date(HORARIO_LEGADO).toISOString());
  expect(comIso.horario.stringValue).toBe(HORARIO_LEGADO);

  // 3. A migração para salas: primeiro em simulação, depois de verdade.
  expect(await idsDe('salas')).toEqual([]);
  migrar('migrar-para-salas.js', ['--dry-run', '--professor', CARLOS.uid]);
  expect(await idsDe('salas')).toEqual([]);

  migrar('migrar-para-salas.js', ['--confirmar', '--professor', CARLOS.uid]);

  const salas = await idsDe('salas');

  expect(salas).toHaveLength(1);

  const [salaId] = salas;

  // Os ids são preservados: é o que torna a segunda rodada uma pergunta
  // respondível ("este documento já está lá?") em vez de uma cópia cega.
  expect((await idsDe(`salas/${salaId}/chamados`)).sort()).toEqual([
    'legado-com-print',
    'legado-sem-print',
  ]);
  expect(await idsDe(`salas/${salaId}/chat`)).toEqual(['legado-mensagem']);

  // O campo antigo continua ao lado do novo dentro da sala: nada foi renomeado.
  // A sala **não** entra como campo do documento — ela é o caminho, e nenhuma
  // tela lê um `salaId` de dentro do chamado (`colecaoDeChamados(salaId)` em
  // `src/firebase.js`). O que a cópia acrescenta é a marca `migradoDe`, que é o
  // que a reversão usa para saber o que pode apagar, e o `autorUid` que a
  // v0.1.0 não tinha e que as rules de hoje pedem.
  const copiado = await ler(`salas/${salaId}/chamados/legado-com-print`);

  expect(copiado.email.stringValue).toBe(ANA.email);
  expect(copiado.horario.stringValue).toBe(HORARIO_LEGADO);
  expect(copiado.migradoDe.stringValue).toBe('chamados');
  expect(copiado.autorUid.stringValue).toBe(ANA.uid);

  // 4. E as coleções globais continuam intactas: elas são o backup vivo.
  expect((await idsDe('chamados')).sort()).toEqual(['legado-com-print', 'legado-sem-print']);

  // 5. Idempotência: a segunda rodada não duplica nem cria uma segunda sala.
  migrar('migrar-para-salas.js', ['--confirmar', '--professor', CARLOS.uid]);

  expect(await idsDe('salas')).toEqual([salaId]);
  expect(await idsDe(`salas/${salaId}/chamados`)).toHaveLength(2);

  // 6. Reversão: apaga da sala o que a migração copiou, e nada mais.
  migrar('migrar-para-salas.js', ['--reverter', '--confirmar']);

  expect(await idsDe(`salas/${salaId}/chamados`)).toEqual([]);
  expect(await idsDe(`salas/${salaId}/chat`)).toEqual([]);
  // O que a reversão nunca toca: as coleções globais, que são a fonte.
  expect((await idsDe('chamados')).sort()).toEqual(['legado-com-print', 'legado-sem-print']);
});
