// Playwright — a suíte end-to-end (AC-TEST-06).
//
// O que ela roda contra, e por quê:
//
// **O build de produção, não o dev server.** `react-scripts start` serve módulos
// separados, sem minificação e com o refresh de desenvolvimento ligado. Medir o
// First Contentful Paint ali (AC-PERF-01) mediria um artefato que nunca chega ao
// aluno. O `npm run test:e2e` constrói e serve `build-e2e/`.
//
// **O Firebase Emulator Suite, nunca o projeto da escola.** O `projectId` do
// build de e2e é `demo-senai-duvidas`, e o prefixo `demo-` é o que faz o SDK se
// recusar a sair para a rede. `tests/e2e/fixtures/emulador.js` confere isso de
// novo em tempo de execução, porque estes testes apagam o banco inteiro.
//
// **Um worker.** Os testes dividem o mesmo emulador e cada arquivo limpa o banco
// no `beforeEach`. Em paralelo, a limpeza de um apagaria o cenário do outro no
// meio da asserção — a mesma razão do `maxWorkers: 1` de `jest.rules.config.js`.
//
// Sobre o navegador: no CI, `npx playwright install --with-deps chromium` baixa o
// Chromium do Playwright. Numa máquina sem esse download, `PLAYWRIGHT_CANAL=chrome`
// usa o Chrome já instalado — mesma engine, mesmo CDP, mesma medição de FCP.
const { defineConfig, devices } = require('@playwright/test');

const HOST = process.env.EMULADOR_HOST || '127.0.0.1';
const PORTA_DO_APP = Number(process.env.E2E_PORTA || 3100);
const PORTA_FIRESTORE = Number(process.env.EMULADOR_PORTA_FIRESTORE || 8080);

const ENDERECO = `http://${HOST}:${PORTA_DO_APP}`;

/** O canal do navegador, quando se quer o Chrome do sistema em vez do baixado. */
const canal = process.env.PLAYWRIGHT_CANAL || undefined;

module.exports = defineConfig({
  testDir: './tests/e2e',
  // `__meta__` são testes **sobre** a suíte e2e, rodados pelo Jest junto da
  // suíte unitária. Eles não abrem navegador nenhum.
  testIgnore: ['**/__meta__/**', '**/fixtures/**'],

  // O teto por teste. Generoso para o de carga, que semeia 1000 mensagens, e
  // ainda assim um teto: sem ele, um `waitFor` que nunca resolve pendura o CI.
  timeout: 60000,
  expect: { timeout: 10000 },

  // Nada de `test.only` esquecido entrando na branch principal.
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: ENDERECO,
    // O rastro só é guardado de quem falhou: guardar de todos enche o disco do
    // runner e ninguém abre o rastro de um teste que passou.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // A 1024×768 do laboratório é o tamanho padrão de propósito: é a tela em que
    // o app roda de verdade, e é nela que os defeitos de layout aparecem.
    viewport: { width: 1024, height: 768 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: canal },
    },
  ],

  webServer: [
    {
      // `emulators:exec` encerra a suíte junto do comando; `emulators:start`
      // fica de pé, que é o que o Playwright precisa entre os testes.
      command:
        'npx firebase emulators:start --project demo-senai-duvidas --only auth,firestore,storage',
      // Esta URL só diz que o **Firestore** subiu: ele é Java e abre a porta
      // bem antes de o Auth abrir a dele. Quem espera os três é
      // `aguardarEmuladores()`, chamado no `limparTudo` de cada spec — o
      // `webServer` do Playwright só sabe esperar uma URL.
      url: `http://${HOST}:${PORTA_FIRESTORE}/`,
      reuseExistingServer: !process.env.CI,
      // Os emuladores de Firestore e Storage são aplicações Java: a primeira
      // subida baixa e inicia a JVM.
      timeout: 180000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx serve --single --no-clipboard --listen ${PORTA_DO_APP} build-e2e`,
      url: ENDERECO,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
