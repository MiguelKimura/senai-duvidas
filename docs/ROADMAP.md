# Roadmap de Release — rumo à v1.0.0

Estado inicial: **v0.1.0** (protótipo funcional, sem testes, sem salas, horário do cliente,
Firestore aberto, branch única).

Alvo: **v1.0.0** — todos os critérios [MVP] de `docs/CRITERIOS-DE-ACEITE.md` atendidos,
suíte unitária + integração + e2e verde, documentação histórica e manuais de uso publicados.

Cada linha da tabela corresponde a **um arquivo de task** em `tasks/`, feito para ser rodado
como uma sessão one-shot independente.

---

## Visão geral

| Versão | Task | Escopo | ACs cobertos | Depende de |
|---|---|---|---|---|
| 0.2.0 | `00-fundacao-testes.md` | Fundação: harness de testes, emuladores, lint, CI, branches `main`/`dev`, tokens de design | TEST, CI, DOC-01, DOC-06 | — |
| 0.3.0 | `01-auth-oauth-sessao.md` | Google + GitHub, sessão persistente, papel via Firestore, rotas protegidas | AUTH, SESSAO, SEC-03, SEC-06 | 0.2.0 |
| 0.4.0 | `02-tempo-brasilia.md` | Horário autoritativo do servidor no fuso de Brasília | TEMPO | 0.3.0 |
| 0.5.0 | `03-salas-pin.md` | Salas do professor, PIN de 6 dígitos, escopo de dados por sala, rules | SALA, SEC-01/02/05, PERF-03 | 0.4.0 |
| 0.6.0 | `04-upload-imagens.md` | Upload de arquivo, drag & drop, colar, compressão, lightbox, Storage rules | IMG, SEC-08, CHAMADO-08 | 0.5.0 |
| 0.7.0 | `05-cor-card-markdown.md` | Setinha cinza de opções avançadas, paleta de cores, markdown sanitizado | COR, SEC-04 | 0.6.0 |
| 0.8.0 | `06-chat-overhaul-dm.md` | Chat reescrito, horários, cores estáveis, paginação, abas e DMs | CHAT, DM | 0.7.0 |
| 0.9.0 | `07-perks.md` | Perks, prioridade na fila, animação de premiação, auditoria | PERK, CHAMADO-03 | 0.8.0 |
| 0.10.0 | `08-animacoes-a11y.md` | Sistema de animações, toasts, acessibilidade, responsividade, revisão do auto-delete | ANIM, CHAMADO-04/05/09/10 | 0.9.0 |
| **1.0.0** | `09-hardening-release.md` | E2E, orçamento de performance, auditoria de segurança, docs históricas e manuais, release | PERF, SEC, DOC, TEST-06 | 0.10.0 |

---

## Detalhe por versão

### v0.2.0 — `chore: fundação de testes e CI`
**Por que primeiro:** sem harness de teste não existe red-green-refactor. Esta task é a única
que pode escrever código de produção mínimo; todas as seguintes dependem dela.

Entregas: Jest/RTL configurado em modo CI, Firebase Emulator Suite, `@firebase/rules-unit-testing`,
ESLint + Prettier, `.github/workflows/ci.yml`, branches `main`/`dev` com proteção documentada,
`CONTRIBUTING.md`, `CHANGELOG.md`, tokens de design em `src/styles/tokens.css`, e **testes de
caracterização** que fixam o comportamento atual (a rede de segurança das próximas tasks).

Critério de saída: `npm run test:ci` verde com a suíte de caracterização cobrindo login, lista de
chamados, criação, exclusão e chat.

---

### v0.3.0 — `feat: login social e sessão persistente`
**Por que agora:** identidade é pré-requisito de salas, DMs e perks. Hoje há três implementações
concorrentes de auth (`App.js`, `AuthContext.js`, `firebase.js`) e o papel vem do `localStorage` —
uma falha de segurança que precisa cair antes de qualquer feature nova.

Entregas: `AuthContext` único, botões Google/GitHub, resolução de papel só via Firestore,
`RotaProtegida`, persistência local com renovação de token, erros em português.

Critério de saída: usuário fecha o navegador, reabre e continua logado; aluno não vira professor
alterando `localStorage`.

---

### v0.4.0 — `fix: horário autoritativo do servidor`
**Por que antes das salas:** a ordenação da fila é o coração do produto e hoje depende do relógio
do aluno. Mudar isso depois de escopar por sala significaria migrar dados duas vezes.

Entregas: `src/services/tempo.js`, `serverTimestamp()` em toda escrita, formatação em
`America/Sao_Paulo`, leitura retrocompatível de `horario` em string, testes com relógio mockado.

Critério de saída: teste que adianta o relógio do cliente em 3 horas e prova que a fila não muda.

---

### v0.5.0 — `feat: salas do professor com PIN`
**Por que é o divisor de águas:** a partir daqui os dados deixam de ser globais. É a maior
migração do roadmap e a que mais exige cuidado com compatibilidade.

Entregas: modelo `salas/{salaId}` com subcoleções `membros`, `chamados`, `chat`; PIN de 6 dígitos
único; entrada por PIN com limitação de tentativas; vínculo permanente do aluno; arquivamento
ao fim do ano; Firestore Rules completas com testes; script de migração dos dados legados para
uma sala "Turma Geral 2026".

Critério de saída: teste de rules provando que aluno da sala A recebe `permission-denied` ao ler
a sala B.

---

### v0.6.0 — `feat: upload de imagens do computador`
Entregas: `ServicoAnexos` com upload para Storage, drag & drop, colar da área de transferência,
validação de MIME por magic bytes, compressão no cliente, barra de progresso, lightbox, limpeza
de anexos órfãos na exclusão do chamado, Storage Rules com teste.

Critério de saída: chamado antigo com `imagem` em string de URL continua renderizando (AC-IMG-13).

---

### v0.7.0 — `feat: opções avançadas do card`
Entregas: disclosure cinza acessível no modal, paleta com contraste garantido, markdown básico
com sanitização, preview ao vivo, fallback para cor automática.

Critério de saída: teste de XSS provando que `<img src=x onerror=alert(1)>` na descrição não
executa nada.

---

### v0.8.0 — `feat: chat com DMs`
Entregas: reescrita do `Chat` em componentes menores, horários, cor determinística por usuário,
agrupamento, paginação de 50, envio otimista, `!clear` restrito a professor com confirmação,
abas Sala/Diretas, threads de DM com rules próprias, contador de não lidas, animações.

Critério de saída: teste de rules provando que um terceiro não lê a DM entre professor e aluno.

---

### v0.9.0 — `feat: perks do professor`
Entregas: modelo `salas/{salaId}/perks/{uid}`, concessão e revogação por professor, expiração pelo
horário do servidor, ordenação `prioridade desc, horarioServidor asc`, animação de premiação em
tela cheia com respeito a `prefers-reduced-motion`, insígnias, vitrine de conquistas, auditoria.

Critério de saída: teste determinístico da ordenação da fila com e sem perk.

---

### v0.10.0 — `feat: animações e acessibilidade`
Entregas: camada de animação sobre os tokens, transições de rota e modal, stagger de cards,
skeletons, substituição de `alert()`/`window.open()` por toast e modal, responsividade de 360px a
1920px, navegação completa por teclado, auditoria de contraste, revisão do auto-delete com
confirmação e animação de saída.

Critério de saída: auditoria de acessibilidade automatizada sem violações críticas.

---

### v1.0.0 — `release: primeira versão estável`
Entregas: e2e em Playwright dos seis fluxos críticos, orçamento de bundle aplicado no CI,
auditoria final de rules, `docs/HISTORICO.md` completo, `MANUAL-ALUNO.md`, `MANUAL-PROFESSOR.md`,
`ARQUITETURA.md`, ADRs, `CHANGELOG.md` gerado, tag `v1.0.0`, deploy de produção a partir de `main`.

Critério de saída: **todos** os ACs [MVP] verdes; nenhum [REG] quebrado desde a v0.1.0.

---

## Pós-1.0.0 (backlog)

| Versão | Escopo |
|---|---|
| 1.1.0 | ACs [POS] restantes: DM aluno↔aluno, indicador de digitando, múltiplas salas por aluno |
| 1.2.0 | Modo offline com fila de envio (AC-PERF-07) |
| 1.3.0 | Painel do professor com métricas de atendimento (tempo médio de resposta, dúvidas por tópico) |
| 1.4.0 | Notificações push e PWA instalável |
| 2.0.0 | Multi-instituição (várias unidades do SENAI no mesmo deploy) — **BREAKING CHANGE** no modelo de dados |

---

## Regra de versionamento

| Mudança | Incremento |
|---|---|
| Correção sem alterar contrato | PATCH (`0.x.Y`) |
| Nova feature retrocompatível | MINOR (`0.X.0`) |
| Alteração incompatível no modelo de dados ou nas rotas | MAJOR — antes da 1.0.0, MINOR com `BREAKING CHANGE:` no rodapé do commit |

Enquanto o projeto estiver em `0.y.z`, a API é considerada instável, mas **os dados não são**:
toda task de migração precisa entregar leitura retrocompatível, conforme a DoD.
