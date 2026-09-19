---
id: 07-perks
titulo: "Perks do professor: premiação, prioridade na fila e animação"
versao_origem: 0.8.0
versao_alvo: 0.9.0
tipo: feat
escopo_commit: perks
branch: feat/perks-do-professor
branch_base: dev
depende_de: [00-fundacao-testes, 01-auth-oauth-sessao, 02-tempo-brasilia, 03-salas-pin, 06-chat-overhaul-dm]
criterios: [AC-PERK-01, AC-PERK-02, AC-PERK-03, AC-PERK-04, AC-PERK-05, AC-PERK-06, AC-PERK-07, AC-PERK-08, AC-PERK-09, AC-PERK-10, AC-CHAMADO-03, AC-SEC-03]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: medio
observacao: "O cliente classificou como 'não essencial agora'. Só entre nesta task com as anteriores verdes."
---

# Você é o engenheiro responsável pela task 07 — Perks

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md`, `docs/ARQUITETURA.md`
e todo o `src/`. Tasks 00 a 06 entregaram harness, auth, tempo do servidor, salas, anexos,
opções do card e o chat com DMs.
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O que o cliente pediu

> "Opção do professor dar perks aos alunos (ex.: prioridade no atendimento). Isso não é essencial
> agora, mas queria perks tipo o do Call of Duty, pra ter animações legais, e funcionaria como uma
> premiação que o professor pode dar a um aluno."

Duas leituras importantes:

1. **É gamificação pedagógica.** O professor premia quem ajudou um colega, entregou no prazo,
   resolveu sozinho. O valor está no reconhecimento público, não na mecânica.
2. **A animação faz parte do requisito, não é enfeite.** "Tipo Call of Duty" quer dizer: aparece em
   tela cheia, com peso, e o aluno sente que ganhou algo. Uma notificação discreta não atende.

Ao mesmo tempo: sala de aula tem 40 pessoas e um projetor. A animação precisa ter botão de pular,
respeitar `prefers-reduced-motion` e vir com som **desativado por padrão** (AC-PERK-04, AC-PERK-08).

## Critérios de aceite deste escopo

- AC-PERK-01 — professor concede perk a aluno da sua sala, com tipo e justificativa opcional.
- AC-PERK-02 — perk **"Prioridade no Atendimento"** move os chamados do aluno para o topo da fila
  dentro da sua faixa de prioridade.
- AC-PERK-03 — validade configurável (ex.: 7 dias) com expiração pelo **horário do servidor**.
- AC-PERK-04 — concessão dispara **animação de premiação em tela cheia** para o aluno, com som
  opcional desativado por padrão.
- AC-PERK-05 — perk vira **insígnia** no card do chamado e no chat.
- AC-PERK-06 — vitrine "Minhas conquistas" com perks ativos e histórico dos expirados.
- AC-PERK-07 — só professores concedem ou revogam, garantido por **Firestore Rules**.
- AC-PERK-08 — animação respeita `prefers-reduced-motion` e pode ser desativada nas preferências.
- AC-PERK-09 — ordenação da fila com perks **determinística e testada**.
- AC-PERK-10 — log de auditoria: quem concedeu, para quem, quando e por quê.
- AC-CHAMADO-03 — fila ordenada por horário crescente. **[REG]** — agora composta com prioridade.
- AC-SEC-03 — nenhuma escalada de privilégio pelo cliente.

## Modelo de dados

```
salas/{salaId}/perks/{perkId}
  alunoUid, alunoNome
  tipo: "prioridade" | "destaque" | "colaborador" | "resolvedor"
  nivel: 1..3
  justificativa: string | null
  concedidoPor, concedidoPorNome
  concedidoEm (serverTimestamp)
  expiraEm (timestamp | null)     <- null = permanente
  revogadoEm (timestamp | null)
  visualizadoEm (timestamp | null) <- controla o disparo da animação, uma vez só

salas/{salaId}/auditoriaPerks/{eventoId}    <- append-only (AC-PERK-10)
  acao: "conceder" | "revogar" | "expirar"
  perkId, alunoUid, atorUid, em, detalhes
```

## A ordenação (AC-PERK-09) — a parte que exige mais rigor

A fila é o que o professor realmente usa. Uma ordenação não determinística aqui gera briga em sala.
Implemente como **função pura e testada exaustivamente**, em `src/services/filaChamados.js`:

```js
ordenarFila(chamados, perksAtivosPorUid, agoraServidor) -> chamados ordenados
```

Regra, nesta ordem exata:

1. Chamados **não atendidos** antes dos atendidos.
2. **Prioridade descendente** — nível do perk de prioridade ativo do autor (sem perk = 0).
3. **Horário do servidor ascendente** — o mais antigo primeiro, dentro da mesma faixa.
4. **Desempate por `chamadoId`** ascendente — garante ordem estável e idêntica em todos os
   dispositivos, mesmo com timestamps iguais.
5. Chamados com horário **pendente** (`serverTimestamp` não confirmado) vão para o fim
   (comportamento herdado da task 02, AC-TEMPO-06).

Perk expirado **não** conta: compare `expiraEm` com o horário do **servidor**, nunca com
`new Date()` do cliente — senão o aluno adianta o relógio e estende o próprio perk.

Escreva um teste de propriedade: para 1000 listas embaralhadas com perks aleatórios, a ordenação
produz sempre o mesmo resultado, independentemente da ordem de entrada.

## A animação (AC-PERK-04, AC-PERK-08)

- Dispara quando o aluno carrega a sala e existe perk com `visualizadoEm == null`.
- Tela cheia, 2 a 3 segundos: nome do perk, ícone, nível, justificativa e quem concedeu.
- Só `transform` e `opacity` (AC-ANIM-06); nada de animar `width`, `height` ou `top`.
- **Botão de pular sempre visível**, e a animação fecha com `Esc`.
- Com `prefers-reduced-motion: reduce`, mostra um card estático com a mesma informação.
- Som: arquivo curto, `<audio>` com `muted` por padrão, ligado só se o usuário optar nas
  preferências. Nunca toca automaticamente no primeiro carregamento.
- Ao terminar (ou ao pular), grava `visualizadoEm` — **a animação nunca repete**.

Preferências do usuário ficam em `usuarios/{uid}.preferencias` = `{ animacoes: bool, som: bool }`,
campo aditivo com padrão seguro (`animacoes: true`, `som: false`).

## Integração

- **Task 03:** perks vivem na sala; professor precisa ser o dono **daquela** sala (AC-PERK-07).
- **Task 02:** `concedidoEm` e `expiraEm` pelo servidor; comparação de expiração com horário do
  servidor.
- **Task 06:** insígnia ao lado do nome no chat, usando o ponto de extensão deixado em
  `Mensagem.jsx`.
- **Task 08 (animações):** as durações e curvas vêm dos tokens; o polimento final é lá.
- **`TelaProfessor`/`TelaAluno`:** a lista passa a usar `ordenarFila()` — substitua o
  `problemasList.sort((a,b) => a.horario - b.horario)` atual, mantendo o teste de regressão de
  AC-CHAMADO-03 verde para o caso "nenhum perk ativo".

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `ordenarFila` sem perks = ordem por horário crescente (idêntica a hoje) |
| 2 | Perk de prioridade nível 1 sobe o chamado acima dos sem perk |
| 3 | Nível 2 sobe acima do nível 1 |
| 4 | Dentro da mesma prioridade, o mais antigo vem primeiro |
| 5 | Timestamps iguais desempatam por `chamadoId`, de forma estável |
| 6 | Perk expirado pelo horário do servidor não conta |
| 7 | Relógio do cliente adiantado **não** estende perk expirado |
| 8 | Atendidos vão para o fim |
| 9 | Pendentes vão para o fim |
| 10 | Propriedade: 1000 embaralhamentos produzem a mesma saída |
| 11 | **Rule:** aluno não consegue criar perk para si mesmo |
| 12 | **Rule:** professor de outra sala não concede perk nesta sala |
| 13 | **Rule:** auditoria é append-only (update e delete negados) |
| 14 | Conceder perk grava evento de auditoria |
| 15 | Revogar perk grava evento e remove o efeito da fila |
| 16 | Perk não visualizado dispara a animação uma vez |
| 17 | Depois de visualizado, não dispara de novo |
| 18 | Com `prefers-reduced-motion`, mostra card estático |
| 19 | Som não toca sem opt-in |
| 20 | Insígnia aparece no card e no chat |
| 21 | Vitrine separa ativos de expirados |

## Compatibilidade

- **Retroativa:** salas sem nenhum perk funcionam exatamente como na 0.8.0 — a fila sem perks tem
  que produzir **a mesma ordem** de antes. Esse é o teste de regressão mais importante desta task.
- **Futura:** `preferencias` em `usuarios/{uid}` e a subcoleção `perks` são aditivos. Um cliente da
  0.8.0 que não conheça perks continua lendo os chamados e ordenando por horário — degradação
  aceitável (ele só não vê a prioridade). Prove com teste.
- **Migração:** nenhuma. Ausência de perk é o estado padrão.

## Restrições

- **Produção:** a animação não pode bloquear o uso do app; se o áudio ou o asset falhar, ela degrada
  para o card estático sem lançar exceção.
- **Escalabilidade:** perks ativos de uma sala cabem em uma consulta só
  (`where('expiraEm','>',agora)` + `limit`), carregada uma vez por sessão e mantida em memória —
  nunca uma consulta por chamado renderizado (AC-PERF-03).
- **Pedagógico:** a justificativa aparece para o aluno premiado; considere torná-la visível para a
  turma apenas se o professor marcar "anunciar para a sala", para não expor quem não foi premiado.

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md`, `docs/MANUAL-PROFESSOR.md` (crie ou amplie: como e quando
conceder perks) e `docs/adr/0010-modelo-de-perks-e-ordenacao-da-fila.md`.

## Pull Request

Contra `dev`:

```
feat(perks): adiciona premiações do professor com prioridade na fila e animação de concessão
```

**Versão:** 0.8.0 → 0.9.0 (MINOR — aditivo)
