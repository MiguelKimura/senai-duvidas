---
id: 09-hardening-release
titulo: "Release 1.0.0: e2e, auditoria de segurança, performance e documentação histórica"
versao_origem: 0.10.0
versao_alvo: 1.0.0
tipo: release
escopo_commit: release
branch: "chore/release-1.0.0"
branch_base: "dev"
depende_de: [00, 01, 02, 03, 04, 05, 06, 07, 08]
criterios: [AC-TEST-02, AC-TEST-06, AC-TEST-08, AC-TEST-10, AC-PERF-01, AC-PERF-02, AC-PERF-03, AC-PERF-04, AC-PERF-05, AC-PERF-06, AC-SEC-01, AC-SEC-02, AC-SEC-03, AC-SEC-04, AC-SEC-05, AC-SEC-06, AC-SEC-07, AC-SEC-08, AC-DOC-01, AC-DOC-02, AC-DOC-03, AC-DOC-04, AC-DOC-05, AC-DOC-06, AC-DOC-07, AC-CI-07, AC-CI-08, AC-CI-09, AC-CI-10]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até TODOS os critérios [MVP] do projeto estarem verdes
risco: alto
observacao: "Esta task só termina quando 100% dos critérios [MVP] de docs/CRITERIOS-DE-ACEITE.md estiverem atendidos. Ela tem autoridade para reabrir qualquer AC de qualquer task anterior."
---

# Você é o engenheiro responsável pela task 09 — Release 1.0.0

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR de release.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md` **inteiro**, `docs/ROADMAP.md`,
`docs/ARQUITETURA.md`, `docs/HISTORICO.md`, `CHANGELOG.md`, todos os ADRs em `docs/adr/`,
`docs/BLOQUEIOS.md` (se existir) e todo o `src/`.

**Esta task é diferente das anteriores.** Ela não tem um escopo de feature: ela é responsável por
provar que **o projeto inteiro** atende aos critérios. Você tem autoridade explícita para reabrir e
corrigir qualquer AC de qualquer task anterior que não esteja realmente atendido.

## Passo 1 — Auditoria completa (antes de escrever qualquer código)

Percorra `docs/CRITERIOS-DE-ACEITE.md` critério por critério. Para **cada** item marcado **[MVP]**,
localize o teste que o prova e rode-o. Produza `docs/AUDITORIA-1.0.0.md`:

| AC | Status | Teste que prova | Observação |
|---|---|---|---|
| AC-AUTH-01 | ✅ | `src/__tests__/auth/cadastro.test.js:31` | |
| AC-XXX-nn | ❌ | — | sem cobertura; corrigido no ciclo N desta task |

Um AC sem teste que o prove conta como **não atendido**, mesmo que a funcionalidade exista. Todo
`❌` da auditoria vira um ciclo red-green-refactor desta task. A task só termina com a coluna
Status **inteiramente verde** para os [MVP].

## Passo 2 — Testes end-to-end (AC-TEST-06)

Playwright contra o Firebase Emulator Suite, cobrindo os seis fluxos críticos:

1. **Login** — e-mail/senha, Google (com mock do provedor) e sessão restaurada após recarregar.
2. **Entrar na sala** — professor cria sala e copia o PIN; aluno entra com o PIN; PIN errado é
   rejeitado; aluno volta depois sem redigitar.
3. **Abrir chamado com imagem** — texto, upload de arquivo, opções avançadas (cor e markdown),
   envio, card aparece para o professor em tempo real.
4. **Excluir chamado** — aluno exclui o próprio com confirmação e desfazer; não vê botão no alheio.
5. **Enviar mensagem** — chat da sala, horário correto, cor estável, paginação ao rolar.
6. **Mensagem direta** — professor abre DM com aluno; um terceiro logado não enxerga a conversa.

Requisitos: rodar headless no CI; sem `sleep` (só espera por condição); banco semeado por fixture
determinístico; e a suíte completa (unit + rules + e2e) em **menos de 5 minutos** (AC-TEST-08).

## Passo 3 — Auditoria de segurança (AC-SEC-01 a AC-SEC-08)

- Revise `firestore.rules` e `storage.rules` linha a linha. Confirme o `deny by default` e que
  **cada** caminho tem teste de concessão **e** de negação (AC-SEC-01, AC-SEC-02).
- Rode a bateria de ataque como testes: aluno tentando virar professor (AC-SEC-03), ler sala alheia,
  ler `pinHash` (AC-SEC-05), ler DM de terceiros, escrever perk para si, adulterar `horario`,
  subir arquivo de 6 MB e subir `.exe` renomeado (AC-SEC-08).
- Varra o repositório por segredos versionados, inclusive no histórico do git (AC-AUTH-10).
- Confirme que nenhum `console.log` expõe dado pessoal de aluno (AC-SEC-07).
- Confirme XSS coberto em **todos** os pontos de entrada de texto: descrição, chat, DM, nome de
  sala, justificativa de perk (AC-SEC-04).
- Documente em `docs/SEGURANCA.md` o modelo de ameaça, os domínios autorizados do Firebase Auth
  (AC-SEC-06) e o procedimento de resposta a incidente.

## Passo 4 — Orçamento de performance (AC-PERF-01 a AC-PERF-06)

- Meça o bundle: **< 300 KB gzip** no chunk inicial, com code-splitting por rota (AC-PERF-02).
  Aplique `React.lazy` nas rotas e adicione verificação de orçamento **que quebra o CI** se estourar.
- Meça o FCP com Lighthouse CI em 3G rápida: **< 2,5s** (AC-PERF-01).
- Varra todos os `onSnapshot`: cada um precisa de `where`/subcoleção **e** `limit` (AC-PERF-03), e
  de cancelamento no unmount, provado por teste (AC-PERF-04).
- Teste de carga com fixture de 40 membros, 200 chamados e 1000 mensagens (AC-PERF-05).
- Calcule e documente em `docs/ARQUITETURA.md` a estimativa de leituras/escritas por aluno por aula
  e projete o custo para 10 salas ativas, confirmando que cabe no plano gratuito (AC-PERF-06).

## Passo 5 — Documentação (AC-DOC-01 a AC-DOC-07)

Esta é a entrega que o cliente pediu explicitamente: **documentação histórica de desenvolvimento
com foco final no usuário**.

**`docs/HISTORICO.md`** — a narrativa completa, da 0.1.0 à 1.0.0. Para cada versão:
- o que o sistema fazia antes;
- que problema real isso causava para alunos e professores;
- que decisão foi tomada e **por quê**, incluindo as alternativas descartadas (por exemplo: por que
  `serverTimestamp()` em vez de API externa de horário, e por que Firebase Storage em vez de trocar
  de banco de dados — as duas dúvidas explícitas do cliente);
- o que o usuário final percebe na prática.

Feche com uma seção **"O sistema hoje, pelos olhos de quem usa"**: o dia de um aluno e o dia de um
professor, do login ao fim da aula. É o fecho do documento e o que o cliente vai ler primeiro.

**`docs/MANUAL-ALUNO.md`** (AC-DOC-03) — linguagem simples, passo a passo, com capturas de tela:
entrar, usar o PIN, abrir dúvida, anexar print, escolher cor, conversar, excluir a própria dúvida,
o que significam as insígnias.

**`docs/MANUAL-PROFESSOR.md`** (AC-DOC-04) — criar sala, distribuir e regerar o PIN, acompanhar a
fila, marcar como atendido, moderar o chat, usar DM, conceder perks, arquivar a sala no fim do ano.

**`docs/ARQUITETURA.md`** (AC-DOC-05) — modelo de dados completo, todas as coleções, diagramas de
fluxo (autenticação, entrada por PIN, ciclo de vida do chamado), decisões de rules, orçamento de
custo.

**`README.md`** (AC-DOC-01) — reescrito para a 1.0.0: o que é, para quem, capturas, instalação em
três comandos (AC-CI-10), scripts, links para os manuais, fluxo de contribuição.

**`CONTRIBUTING.md`** (AC-DOC-06) e os ADRs (AC-DOC-07) — confirme que estão completos e
consistentes com o código final. Acrescente os ADRs que faltarem.

## Passo 6 — Release (AC-CI-07, AC-CI-08, AC-CI-09)

- `CHANGELOG.md` gerado a partir dos commits convencionais (`conventional-changelog`), não
  escrito à mão (AC-CI-09). Revise a saída e corrija entradas mal formatadas na origem.
- `package.json` para **1.0.0**.
- Documente em `docs/RELEASE.md` o procedimento: merge de `dev` em `main` via PR, tag `v1.0.0`,
  deploy de produção a partir de `main`, homologação a partir de `dev` (AC-CI-08), e o
  **procedimento de rollback**.
- Workflow de release em `.github/workflows/release.yml`: em push para `main`, roda a suíte
  completa, faz o build, publica e cria a tag.
- Confirme AC-CI-10 em ambiente limpo: `git clone`, `npm install`, `npm start` — três comandos,
  sem passo manual escondido. Se faltar `.env`, o app precisa subir com o fallback documentado e
  um aviso claro.

## Passo 7 — Verificação de compatibilidade de ponta a ponta

Esta é a prova final, e é o que fecha a exigência de compatibilidade retroativa e futura:

1. Semeie um emulador com o **banco da v0.1.0**: coleções globais `chamados` e `chat`, `horario`
   em string ISO, `imagem` em string de URL, `usuarios` sem `criadoEm`, nenhuma sala.
2. Suba a aplicação **1.0.0** contra esse banco e prove, por e2e, que: o usuário loga, vê os dados
   antigos pelo fallback de leitura, e consegue usar as features novas.
3. Rode todos os scripts de migração em sequência, com `--dry-run` e depois de verdade, e prove que
   são idempotentes (rodar duas vezes não duplica nada) e reversíveis.
4. Prove a compatibilidade **futura**: um leitor com o formato da 0.1.0 lê os documentos gerados
   pela 1.0.0 sem lançar exceção.
5. Só então remova os campos de compatibilidade previstos para cair na 1.0.0 (`horarioIso`,
   `imagem` string duplicada, `nome`/`email` duplicados nas mensagens) — **e apenas se** a auditoria
   confirmar que nenhum cliente antigo segue em uso. Se houver qualquer dúvida, **mantenha os
   campos** e registre a remoção para a 1.1.0. Manter é a escolha segura; remover é irreversível.

## Como saber que terminou

- `docs/AUDITORIA-1.0.0.md` com **todos** os [MVP] verdes.
- `npm run lint`, `npm run test:ci`, `npm run test:rules`, `npm run test:e2e` e `npm run build`
  verdes.
- Cobertura ≥ 80% linhas e ≥ 75% branches.
- Suíte completa em menos de 5 minutos.
- Bundle inicial < 300 KB gzip; FCP < 2,5s.
- Zero violações sérias de acessibilidade.
- Nenhum teste de nenhuma task anterior removido, pulado ou enfraquecido — confirme comparando a
  contagem de testes com a do PR da task 08.
- Toda a documentação publicada e consistente com o código.

Se algum critério [MVP] **não** puder ser atendido, **não** baixe o critério. Implemente tudo o
que for possível, registre o bloqueio em `docs/BLOQUEIOS.md` com causa técnica e proposta, e
declare-o no PR. A decisão de lançar assim mesmo é do dono do produto, não sua.

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Depois de mesclado em `dev`, o merge de `dev` em `main` é o release. Título:

```
release: versão 1.0.0 — primeira versão estável do sistema de dúvidas do SENAI
```

**Versão:** 0.10.0 → 1.0.0 (MAJOR — primeira versão estável; a partir daqui o contrato de dados é
público e alterações incompatíveis exigem MAJOR)

Inclua no corpo do PR, além do template do `tasks/_PROTOCOLO.md`:
- a tabela completa da auditoria de ACs;
- a contagem final de testes por categoria (unit / rules / e2e);
- as métricas de bundle e de FCP;
- a lista de campos de compatibilidade mantidos e a versão prevista para removê-los.
