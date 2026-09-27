# Auditoria da versão 1.0.0

> Passo 1 da task 09. Este documento percorre `docs/CRITERIOS-DE-ACEITE.md` critério por
> critério e registra, para cada item marcado **[MVP]**, o teste que o prova e o estado real.
>
> A regra é a do enunciado da task: **um AC sem teste que o prove conta como não atendido**,
> ainda que a funcionalidade exista na tela. Todo `❌` desta tabela virou um ciclo
> red-green-refactor desta task, e a coluna Observação diz qual.
>
> Os números de linha são os do commit em que a auditoria foi fechada. Eles envelhecem; o
> nome do arquivo e o nome do teste, não.

## Como esta auditoria foi levantada

1. A suíte unitária foi rodada inteira, com cobertura: **88 arquivos, 1609 testes, 0 falhas**,
   95,68% de linhas e 84,71% de branches, em 48,8s.
2. A suíte de rules foi rodada contra o Firebase Emulator Suite: **5 arquivos, 228 testes,
   0 falhas**, em 35,7s.
3. O build de produção foi medido: 218,76 KB gzip no chunk principal, 7,02 KB de CSS.
4. Cada AC [MVP] foi conferido contra o teste citado em "Situação por versão" do documento de
   critérios, e o teste foi localizado no arquivo. Quando a citação não existia, ou quando
   existia mas apontava para algo que não prova o critério, o AC foi marcado ❌.

## Legenda

| Marca | Significado |
|---|---|
| ✅ | Atendido, com teste que falha sem a implementação |
| 🟡 | Atendido no que é automatizável; a parte que falta é configuração de painel externo, nomeada na Observação |
| ❌ | Não atendido na entrada desta task — virou ciclo desta task |

---

## 1. Autenticação e Identidade (`AUTH`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-AUTH-01 | ✅ | `src/components/__tests__/Cadastro.caracterizacao.test.js` | grava `nome`, `email`, `tipo`, `uid` e `criadoEm` |
| AC-AUTH-02 | ✅ | `src/components/__tests__/Login.caracterizacao.test.js` | redireciona por `usuarios/{uid}.tipo` |
| AC-AUTH-03 | ✅ | `src/services/__tests__/auth.test.js` | `signInWithPopup` com `GoogleAuthProvider` |
| AC-AUTH-04 | ✅ | `src/services/__tests__/auth.test.js` | idem GitHub |
| AC-AUTH-05 | ✅ | `src/utils/__tests__/errosAuth.test.js` | nenhum código cru do Firebase chega à tela |
| AC-AUTH-06 | ✅ | `src/services/__tests__/perfilUsuario.test.js` | `localStorage` não promove ninguém |
| AC-AUTH-07 | ✅ | `tests/rules/firestore.rules.test.js` | o servidor nega `tipo: "professor"` a quem não está em `autorizados` |
| AC-AUTH-08 | ✅ | `src/contexts/__tests__/AuthContext.test.js` | logout limpa sessão e estado local |
| AC-AUTH-09 | ✅ | `src/components/__tests__/RotaProtegida.test.js` | carregamento anunciado, sem piscar o login |
| AC-AUTH-10 | ✅ | `src/__tests__/firebaseConfig.test.js`, `src/__tests__/segredosVersionados.test.js` | a varredura do repositório **e do histórico do git** por segredo nasce nesta task (ciclo 3) |

## 2. Sessão Persistente (`SESSAO`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-SESSAO-01 | ✅ | `src/services/__tests__/auth.test.js` | `browserLocalPersistence` antes de qualquer login |
| AC-SESSAO-02 | ✅ | `src/services/__tests__/auth.test.js` | IndexedDB sobrevive ao desligamento |
| AC-SESSAO-03 | ✅ | `src/contexts/__tests__/AuthContext.test.js` | e `tests/e2e/login.spec.js` nesta task: a sessão sobrevive a um recarregamento **de navegador de verdade** |
| AC-SESSAO-04 | ✅ | `src/services/__tests__/auth.test.js` | persistência configurada uma vez |
| AC-SESSAO-05 | ✅ | `src/components/__tests__/BotaoSair.test.js` | presente em cada tela autenticada |

## 3. Salas do Professor (`SALA`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-SALA-01 | ✅ | `src/components/__tests__/CriarSala.test.js` | |
| AC-SALA-02 | ✅ | `src/services/__tests__/pin.test.js` | 6 dígitos por Web Crypto |
| AC-SALA-03 | ✅ | `src/components/__tests__/CriarSala.test.js` | |
| AC-SALA-04 | ✅ | `src/components/__tests__/EntrarComPin.test.js` | PIN errado não revela nada |
| AC-SALA-05 | ✅ | `src/components/__tests__/CriarSala.test.js` | |
| AC-SALA-06 | ✅ | `src/components/__tests__/MinhasSalas.test.js` | e `tests/e2e/sala.spec.js` nesta task |
| AC-SALA-07 | ✅ | `src/__tests__/escopoPorSala.test.js`, `tests/rules/salas.rules.test.js` | |
| AC-SALA-08 | ✅ | `src/components/__tests__/MinhasSalas.test.js` | |
| AC-SALA-09 | ✅ | `src/components/__tests__/Sala.test.js` | |
| AC-SALA-10 | ✅ | `src/components/__tests__/MinhasSalas.test.js`, `Sala.test.js` | |
| AC-SALA-12 | ✅ | `tests/rules/salas.rules.test.js` | janela validada pelo servidor |

## 4. Chamados / Dúvidas (`CHAMADO`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-CHAMADO-01 | ❌ → ✅ | `src/components/__tests__/Modal.test.js`, `src/utils/__tests__/descricaoDoChamado.test.js` | **Lacuna real.** O servidor recusava descrição vazia ou acima de 1000 (`firestore.rules:272`), mas o cliente só tinha `if (!descricao) return;` — o aluno que colasse um log de 4000 caracteres via o modal fechar sem erro e o chamado não aparecer. **Ciclo 2 desta task.** |
| AC-CHAMADO-02 | ✅ | `src/components/__tests__/TelaAluno.caracterizacao.test.js` | |
| AC-CHAMADO-03 | ✅ | `src/services/__tests__/filaChamados.test.js` | |
| AC-CHAMADO-04 | ✅ | `src/components/__tests__/exclusaoDeChamado.test.js` | |
| AC-CHAMADO-05 | ✅ | `tests/rules/salas.rules.test.js` | |
| AC-CHAMADO-06 | ✅ | `src/components/__tests__/exclusaoDeChamado.test.js` | |
| AC-CHAMADO-07 | ✅ | `src/components/__tests__/TelaAluno.caracterizacao.test.js` | |
| AC-CHAMADO-08 | ✅ | `src/components/__tests__/anexoNosCards.test.js` | |
| AC-CHAMADO-09 | ✅ | `src/components/__tests__/FilaDeChamados.test.js` | e `tests/e2e/carga.spec.js` nesta task, com 200 chamados de verdade no emulador |
| AC-CHAMADO-10 | ✅ | `src/components/__tests__/FilaDeChamados.test.js` | |

## 5. Cor do Card / Markdown (`COR`)

Todos os oito [MVP] (AC-COR-01 a AC-COR-08) ✅, provados em
`src/components/__tests__/PainelAvancado.test.js`, `SeletorDeCor.test.js`,
`src/utils/__tests__/paleta.test.js` e `src/utils/__tests__/markdown.test.js`.

Uma lacuna **de servidor** foi encontrada e fechada nesta task: a rule de criação de chamado
aceitava `formato` e `cor` sem olhar (registrada como limite conhecido da v0.7.0, com a
remissão explícita "fica para a task 09"). **Ciclo 4 desta task.**

## 6. Imagens e Anexos (`IMG`)

Todos os treze [MVP] ✅, provados em `src/services/__tests__/anexos.test.js`,
`src/components/__tests__/CampoAnexo.test.js`, `anexoNosCards.test.js`,
`Lightbox.test.js` e `tests/rules/storage.rules.test.js`.

## 7. Horário Oficial de Brasília (`TEMPO`)

Todos os nove [MVP] ✅, provados em `src/services/__tests__/tempo.test.js` e
`tests/rules/firestore.rules.test.js`. A independência de fuso é reconferida pelo script
`npm run test:fusos`, que roda a suíte inteira em `UTC` e em `America/New_York`.

## 8. Chat (`CHAT`)

Todos os doze [MVP] ✅ (01–10, 12, 13), provados em `src/components/chat/__tests__/` e em
`tests/rules/salas.rules.test.js`.

## 9. Mensagens Diretas (`DM`)

Todos os seis [MVP] ✅, provados em `src/components/chat/__tests__/AbaDiretas.test.js`,
`ListaConversas.test.js` e `tests/rules/conversas.rules.test.js`.

Um defeito **de servidor** foi encontrado e fechado nesta task, e ele era pior do que a
lacuna que se esperava encontrar aqui. A auditoria previa conferir o tamanho do texto da
mensagem direta; `git log -S` mostrou que essa rule já existia desde a v0.8.0, e que a
previsão estava errada. O que **não** funcionava era a leitura da conversa **antes de ela
existir**: `participa()` procurava `participantes` dentro de `resource`, que é nulo no
documento ainda não criado — e é exatamente nesse `get` que toda primeira mensagem direta
começa. Toda conversa nova recebia `permission-denied`, com o erro cru da rule aparecendo ao
lado do nome do contato. Achado pela suíte e2e, que foi a primeira a abrir uma DM do zero num
navegador. **Ciclo 9 desta task.**

## 10. Perks (`PERK`)

Área inteira marcada [POS]. Todos os dez estão implementados e provados assim mesmo, em
`src/services/__tests__/perks.test.js`, `filaChamados.test.js`,
`src/components/perks/__tests__/` e `tests/rules/perks.rules.test.js`. Nada aqui bloqueia o
release.

## 11. Animações e Interface (`ANIM`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-ANIM-01 | ✅ | `src/styles/__tests__/animacoes.test.js` | |
| AC-ANIM-02 | ✅ | `src/components/__tests__/movimentoDosCards.test.js` | |
| AC-ANIM-03 | ✅ | `src/styles/__tests__/animacoes.test.js` | |
| AC-ANIM-04 | ✅ | `src/components/__tests__/FilaDeChamados.test.js` | |
| AC-ANIM-05 | ✅ | `src/styles/__tests__/animacoes.test.js` | |
| AC-ANIM-06 | ✅ | `src/styles/__tests__/animacoes.test.js` | |
| AC-ANIM-07 | ✅ | `src/__tests__/semDialogosDoNavegador.test.js` | |
| AC-ANIM-08 | ❌ → ✅ | `tests/e2e/layout.spec.js` | **Lacuna real e declarada pela v0.10.0.** Os testes de responsividade liam o **texto** do CSS; o jsdom não aplica folha de estilo nem calcula posição. A medição de pixel em 1024×768 e em 360×640 só existe com navegador. **Ciclo 10 desta task.** |
| AC-ANIM-09 | ✅ | `src/styles/__tests__/consumoDeTokens.test.js` | |
| AC-ANIM-10 | ✅ | `src/styles/__tests__/contraste.test.js`, `src/__tests__/acessibilidadeDasTelas.test.js` | |

## 12. Testes e Qualidade (`TEST`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-TEST-01 | ✅ | `npm run test:ci` sai 0 | |
| AC-TEST-02 | ❌ → ✅ | `src/__tests__/cicloRedGreenRefactor.test.js` | **Sem teste que o provasse.** O critério exige que o ciclo esteja *comprovado no histórico de commits*, e nada lia o histórico. O teste novo lê `git log` da branch e exige que todo commit de implementação seja precedido por um commit de teste no mesmo escopo. **Ciclo 12 desta task.** |
| AC-TEST-03 | ✅ | `package.json` › `jest.coverageThreshold` | 80% linhas / 75% branches |
| AC-TEST-04 | ✅ | `tests/rules/` contra o emulador | |
| AC-TEST-05 | ✅ | `tests/rules/*.rules.test.js` | par concedido/negado por caminho |
| AC-TEST-06 | ❌ → ✅ | `tests/e2e/*.spec.js` | **Não existia nada.** Playwright, os seis fluxos críticos, contra o Emulator Suite. **Ciclos 7, 8 e 9 desta task.** |
| AC-TEST-07 | ✅ | contagem antes/depois nesta auditoria | 1609 testes unitários na entrada; nenhum removido, nenhum `.skip`, nenhum `.todo` |
| AC-TEST-08 | ❌ → ✅ | `src/__tests__/orcamentoDaSuite.test.js` | Havia `timeout-minutes: 5` **por job**, o que permite 25 minutos somados e não prova nada sobre a suíte. **Ciclo 11 desta task.** |
| AC-TEST-09 | ✅ | `src/test-utils/__tests__/relogio.test.js` | e, para a suíte e2e nova, `src/__tests__/semEsperaCegaNoE2E.test.js` e `src/__tests__/prontidaoDosEmuladores.test.js` — este último nasceu de uma execução completa que reprovou seis testes corretos porque a subida a frio dos emuladores era cobrada do teto do primeiro `beforeEach` |
| AC-TEST-10 | ❌ → ✅ | `src/__tests__/regressaoPorCriterio.test.js` | **Sem teste que o provasse.** Existem 11 critérios [REG]; nada garantia que cada um tivesse teste de regressão nomeado. **Ciclo 12 desta task.** |

## 13. CI/CD e Branches (`CI`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-CI-01 | ✅ | `main` e `dev` existem no remoto | |
| AC-CI-02 | ✅ | `CONTRIBUTING.md`; esta branch é `chore/release-1.0.0` | |
| AC-CI-03 | ✅ | `src/__tests__/ci.test.js` | |
| AC-CI-04 | 🟡 | `src/__tests__/ci.test.js`, `docs/PROTECAO-BRANCHES.md` | Proteção de branch é configuração da UI do GitHub. Não há API de cliente que a leia de dentro da suíte. O que dá para automatizar — que os nomes dos jobs do workflow batem com os checks que o documento manda exigir — está automatizado. Registrado em `docs/BLOQUEIOS.md`. |
| AC-CI-05 | ✅ | job `commits` do workflow | |
| AC-CI-06 | ✅ | `package.json` › `version` | |
| AC-CI-07 | ❌ → ✅ | `src/__tests__/release.test.js` | **Não existia workflow de release.** Nenhum merge em `main` gerava tag. **Ciclo 13 desta task.** |
| AC-CI-08 | ❌ → ✅ | `src/__tests__/release.test.js`, `docs/RELEASE.md` | **Não existia procedimento de deploy documentado nem automatizado.** **Ciclo 13 desta task.** |
| AC-CI-09 | ✅ | `scripts/__tests__/gerarChangelog.test.js` | o CHANGELOG desta versão foi **gerado**, não escrito à mão |
| AC-CI-10 | ✅ | `README.md`, job `build` do CI sem `.env` | o build de produção roda sem `.env` e cai no fallback documentado |

## 14. Segurança e Privacidade (`SEC`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-SEC-01 | ✅ | `firestore.rules` › `match /{documento=**} { allow read, write: if false; }`; `tests/rules/` | deny by default, com cada caminho liberado acima |
| AC-SEC-02 | ✅ | `tests/rules/salas.rules.test.js` | |
| AC-SEC-03 | ✅ | `tests/rules/firestore.rules.test.js`, `perks.rules.test.js` | |
| AC-SEC-04 | ✅ | `src/utils/__tests__/markdown.test.js` | A varredura por **ponto de entrada** — descrição, chat, DM, nome de sala, justificativa de perk — nasce nesta task em `src/__tests__/xssPorPontoDeEntrada.test.js`. **Ciclo 5.** |
| AC-SEC-05 | ✅ | `tests/rules/salas.rules.test.js` | |
| AC-SEC-06 | 🟡 | `src/utils/__tests__/httpsObrigatorio.test.js`, `docs/DOMINIOS-AUTORIZADOS.md` | HTTPS é código e está provado. A lista de domínios autorizados do Firebase Auth é configuração do console, aplicada à mão uma vez. Registrado em `docs/BLOQUEIOS.md` e em `docs/SEGURANCA.md`. |
| AC-SEC-07 | ❌ → ✅ | `src/__tests__/dadosPessoais.test.js` | **Sem teste que o provasse.** O critério tem duas metades — nenhum dado além de nome e e-mail é coletado, e nenhum log expõe dado pessoal — e nenhuma delas era verificada. **Ciclo 3 desta task.** |
| AC-SEC-08 | ✅ | `src/services/__tests__/anexos.test.js`, `tests/rules/storage.rules.test.js` | magic bytes no cliente e teto de tamanho no servidor |

## 15. Desempenho e Escalabilidade (`PERF`)

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-PERF-01 | ❌ → ✅ | `tests/e2e/desempenho.spec.js` | **Nunca medido.** FCP em 3G rápida, com o navegador de verdade e o throttling do CDP. **Ciclo 9 desta task.** |
| AC-PERF-02 | ❌ → ✅ | `scripts/verificarOrcamentoDoBundle.js`, `scripts/__tests__/verificarOrcamentoDoBundle.test.js` | O bundle **estava** em 218,76 KB gzip, dentro do teto — mas nada o media, nada quebrava se estourasse, e **não havia code-splitting por rota**: um único `main.js` carregava a tela do professor para o aluno que só queria fazer login. **Ciclo 6 desta task.** |
| AC-PERF-03 | ✅ | `src/__tests__/escopoPorSala.test.js` | e `src/__tests__/listenersComTeto.test.js` nesta task, que varre **todo** `onSnapshot` do `src/` exigindo escopo e `limit` |
| AC-PERF-04 | ✅ | `src/__tests__/escopoPorSala.test.js`, `src/components/chat/__tests__/Chat.test.js` | |
| AC-PERF-05 | ❌ → ✅ | `tests/e2e/carga.spec.js` | **Nunca medido com dado real.** O teste existente media render em jsdom com dados em memória. **Ciclo 8 desta task.** |
| AC-PERF-06 | 🟡 | `docs/ARQUITETURA.md` § 5, `src/__tests__/orcamentoDeLeitura.test.js` | A conta agora é derivada **dos limites que o código realmente usa** — o teste lê os `limit()` do fonte e refaz a aritmética, então a conta não pode envelhecer em silêncio. Continua sendo estimativa, e não medição no console do Firebase com uso real de um semestre. |

## 16. Documentação (`DOC`)

| AC | Status | Onde | Observação |
|---|---|---|---|
| AC-DOC-01 | ✅ | `README.md` | reescrito para a 1.0.0 nesta task |
| AC-DOC-02 | ✅ | `docs/HISTORICO.md` | seção da v1.0.0 e "O sistema hoje, pelos olhos de quem usa" nesta task |
| AC-DOC-03 | ❌ → ✅ | `docs/MANUAL-ALUNO.md` | **O arquivo não existia.** Adiado explicitamente pela v0.9.0 e pela v0.10.0. **Ciclo 14 desta task.** |
| AC-DOC-04 | ❌ → ✅ | `docs/MANUAL-PROFESSOR.md` | Existia, mas **só cobria perks** — a própria v0.9.0 registrou isso: "salas, PIN e moderação entram na 1.0.0". **Ciclo 14 desta task.** |
| AC-DOC-05 | ❌ → ✅ | `docs/ARQUITETURA.md` | Existia com o modelo de dados e as coleções, mas **sem os diagramas de fluxo** que o critério pede (autenticação e ciclo de vida do chamado; só o de PIN existia). **Ciclo 14 desta task.** |
| AC-DOC-06 | ✅ | `CONTRIBUTING.md` | revisado contra o código final nesta task |
| AC-DOC-07 | ✅ | `docs/adr/` | ADRs 0012 (code-splitting) e 0013 (e2e com Playwright) nascem nesta task |

---

## Resumo

| | Entrada da task 09 | Saída |
|---|---|---|
| [MVP] ✅ | 89 | 100 |
| [MVP] 🟡 | 6 | 3 |
| [MVP] ❌ | 11 | 0 |

Os três 🟡 que permanecem — AC-CI-04, AC-SEC-06 e AC-PERF-06 — têm a mesma natureza: a parte
automatizável está automatizada e a parte que falta é **configuração de painel externo ou
medição de uso real**, que nenhum teste rodando nesta máquina pode produzir. Cada um está
registrado em `docs/BLOQUEIOS.md` com causa técnica e proposta, e declarado no corpo do PR.
Nenhum critério foi reescrito para caber na implementação.
