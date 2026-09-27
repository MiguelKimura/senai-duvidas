# ADR 0013 — A suíte end-to-end: Playwright sobre o build de produção e o Emulator Suite

- **Status:** aceita
- **Data:** 2026-09-26
- **Versão:** 1.0.0
- **Contexto da task:** `tasks/09-hardening-release.md`
- **Critérios:** AC-TEST-06, AC-TEST-08, AC-TEST-09, AC-PERF-01, AC-PERF-05, AC-ANIM-08

## Contexto

Até a 0.10.0 o projeto tinha duas suítes: unitários em jsdom, com fakes do
Firebase, e Security Rules contra o Emulator Suite. As duas são boas no que
fazem, e nenhuma das duas consegue responder a pergunta que importa na véspera
de uma versão estável: **o aluno consegue entrar e abrir uma dúvida?**

A auditoria da 1.0.0 encontrou três classes de defeito que só um navegador vê, e
as três eram reais:

1. **Layout.** `src/styles/__tests__/responsividade.test.js` lia as folhas de
   estilo **como texto**. O jsdom não aplica cascata nem calcula posição —
   `getComputedStyle` ali devolve o declarado inline. Não existe, dentro do
   Jest, largura de elemento para medir. Registrado como B-002 desde a 0.10.0.
2. **Cascata de CSS entre arquivos.** O painel do chat mostrava três mensagens
   num painel de 440px porque `.chat-historico` herdava `flex: 1` de um
   `button { flex: 1 }` sem escopo em `Modal.css` — o CSS do Create React App é
   global, e aquela regra alcança todo botão do aplicativo. Nenhum teste de
   jsdom pega isso, porque ali não há layout.
3. **Desempenho.** FCP (AC-PERF-01) e o comportamento com 40 membros, 200
   chamados e 1000 mensagens (AC-PERF-05) nunca tinham sido medidos com dado
   real. O teste existente media render em jsdom com dados em memória, que é
   medir outra coisa.

### As alternativas consideradas

**Cypress.** É o concorrente óbvio. Descartado por dois pontos concretos deste
projeto: não expõe o **CDP** de forma direta, e é por ele que se faz o
throttling de 3G rápida e se lê o First Contentful Paint (AC-PERF-01); e o
modelo de execução dentro do navegador complica a semeadura do emulador via
Admin SDK entre testes.

**Selenium/WebDriver.** Maduro e verboso. Exigiria construir à mão a espera por
condição que o Playwright dá pronta — e espera construída à mão é exatamente
onde nasce o `sleep` que o AC-TEST-09 proíbe.

**Rodar contra o `react-scripts start`.** Seria mais rápido de configurar, e
mediria um artefato que nunca chega ao aluno: módulos separados, sem
minificação, com o refresh de desenvolvimento ligado. Medir FCP ali não
significaria nada.

**Rodar contra o projeto Firebase da escola.** Descartado sem discussão: os
testes apagam o banco.

## Decisão

**Playwright**, em `tests/e2e/`, contra o **build de produção** servido
localmente e o **Firebase Emulator Suite**.

As decisões de configuração, cada uma com a sua razão:

| Decisão | Por quê |
|---|---|
| Roda sobre `build-e2e/`, gerado por `npm run build:e2e` | É o artefato que chega ao aluno. Medir o dev server mediria outra coisa |
| `projectId` `demo-senai-duvidas` | O prefixo `demo-` faz o SDK se recusar a sair para a rede. `tests/e2e/fixtures/emulador.js` reconfere em tempo de execução, porque estes testes apagam o banco inteiro |
| `workers: 1` | Os testes dividem o mesmo emulador e cada arquivo limpa o banco no `beforeEach`. Em paralelo, a limpeza de um apagaria o cenário do outro no meio da asserção — a mesma razão do `maxWorkers: 1` de `jest.rules.config.js` |
| Viewport 1024×768 como padrão | É a tela dos laboratórios. É nela que os defeitos de layout aparecem, e uma janela larga esconderia justamente o que se quer pegar |
| `locale: 'pt-BR'`, `timezoneId: 'America/Sao_Paulo'` | O horário e o formato de data são critério (AC-TEMPO-*). O runner do CI roda em UTC |
| `retries: 0` | Teste que só passa na segunda tentativa é teste intermitente, e intermitência escondida por retry é dívida que vence em produção |
| `forbidOnly` no CI | Um `test.only` esquecido deixaria a suíte verde cobrindo um teste só |
| `trace: 'retain-on-failure'` | Ninguém abre o rastro de um teste que passou, e guardar todos enche o disco do runner |

**Fixtures determinísticos.** `tests/e2e/fixtures/cenario.js` semeia o banco via
Admin SDK: as mesmas três pessoas, a mesma sala, os mesmos horários, em toda
execução. O mesmo cenário alimenta `scripts/gerarCapturas.js`, que gera as
imagens dos manuais — assim o manual e os testes falam da mesma tela.

**Nenhuma espera cega.** Só espera por condição (`waitFor`, `waitForURL`,
`expect().toPass()`). Isso não é uma convenção confiada à boa-fé:
`src/__tests__/semEsperaCegaNoE2E.test.js` varre a suíte e reprova `sleep`,
`waitForTimeout` e afins. A varredura distingue o **teto** do Playwright
(`timeout:`, que é um limite superior) da **espera cega** (que é um piso) —
foram coisas diferentes desde sempre, e confundi-las reprovaria configuração
correta.

**O orçamento de tempo é da suíte inteira.** `timeout-minutes: 5` por job
permitia 25 minutos somados e não provava nada sobre o conjunto.
`scripts/orcamentoDaSuite.js` soma o tempo das três suítes e reprova o CI se o
total passar de cinco minutos (AC-TEST-08).

## Consequências

**Boas**

- Os seis fluxos críticos do sistema passam a ter prova em navegador de verdade:
  login e sessão restaurada, entrada por PIN com duas pessoas em dois contextos,
  abertura de chamado com print e exclusão com desfazer, chat da sala, mensagem
  direta com um terceiro logado sem acesso, e a compatibilidade com o banco da
  v0.1.0.
- FCP e carga passam a ser medidos, não estimados.
- B-002 fecha: o layout é medido em pixel nas duas resoluções que importam.
- Defeitos de cascata de CSS entre arquivos — a classe que mais escapa num
  projeto com CSS global — ganham um lugar onde aparecer.

**Custos aceitos**

- **A suíte e2e é lenta e pesada.** Precisa de Java (os emuladores de Firestore
  e Storage são aplicações Java) e de um navegador baixado. Ela não roda a cada
  salvamento; roda antes do PR e no CI.
- **É a suíte mais frágil das três.** Um seletor que muda quebra um teste e2e
  sem que o comportamento tenha mudado. A mitigação é usar papéis e rótulos
  acessíveis (`getByRole`, `getByLabel`) em vez de classes de CSS onde for
  possível — o que, de quebra, faz o teste falhar quando a acessibilidade
  regride.
- **Não é a primeira linha de defesa.** Os unitários continuam sendo onde a
  regra de negócio é testada; a e2e prova que as peças se encaixam. Migrar
  cobertura de lá para cá tornaria a suíte lenta e o diagnóstico ruim.
- O download do navegador no CI (`npx playwright install --with-deps chromium`)
  soma tempo ao pipeline. Numa máquina que já tem Chrome, `PLAYWRIGHT_CANAL=chrome`
  usa o do sistema — mesma engine, mesmo CDP, mesma medição.

## Verificação

- `tests/e2e/login.spec.js`, `sala.spec.js`, `chamado.spec.js`, `chat.spec.js` —
  os fluxos críticos (AC-TEST-06)
- `tests/e2e/desempenho.spec.js` — FCP em 3G rápida (AC-PERF-01)
- `tests/e2e/carga.spec.js` — a sala cheia do alvo (AC-PERF-05)
- `tests/e2e/layout.spec.js` — pixel em 1024×768 e em 360×640 (AC-ANIM-08)
- `tests/e2e/compatibilidade.spec.js` — a 1.0.0 contra o banco da v0.1.0
- `src/__tests__/semEsperaCegaNoE2E.test.js` — nenhuma espera cega (AC-TEST-09)
- `src/__tests__/orcamentoDaSuite.test.js` — a suíte inteira em menos de cinco
  minutos (AC-TEST-08)
