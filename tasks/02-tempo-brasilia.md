---
id: 02-tempo-brasilia
titulo: "Horário autoritativo do servidor no fuso de Brasília"
versao_origem: 0.3.0
versao_alvo: 0.4.0
tipo: fix
escopo_commit: tempo
branch: "fix/horario-servidor-brasilia"
branch_base: "dev"
depende_de: [00-fundacao-testes, 01-auth-oauth-sessao]
criterios: [AC-TEMPO-01, AC-TEMPO-02, AC-TEMPO-03, AC-TEMPO-04, AC-TEMPO-05, AC-TEMPO-06, AC-TEMPO-07, AC-TEMPO-08, AC-TEMPO-09, AC-CHAMADO-03]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: alto
observacao: "Migração de dado sensível: a ordem da fila depende disso. Leitura dupla obrigatória."
---

# Você é o engenheiro responsável pela task 02 — Horário Oficial

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md` e todo o `src/`.
As tasks 00 e 01 já entregaram harness de testes, emuladores, CI e o `AuthContext` único.
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O problema que você está resolvendo

A fila de atendimento é o coração do produto: o professor atende na ordem em que as dúvidas
chegaram. Hoje essa ordem é definida pelo **relógio do computador do aluno**:

- `TelaAluno.js` grava `horario: new Date().toISOString()`.
- `Chat.js` grava `horario: new Date()`.
- `TelaAluno.js` e `TelaProfessor.js` ordenam por esse campo e exibem com `toLocaleString()`.

Nos laboratórios do SENAI, as máquinas frequentemente estão com data, hora ou fuso errados. Um
aluno com o relógio adiantado fura a fila sem querer; um com o relógio atrasado nunca é atendido.
E qualquer aluno pode furar a fila de propósito mudando o relógio do Windows.

O palpite natural seria chamar uma API pública de horário de Brasília. **Não faça isso.** O
Firestore já carimba o horário no servidor com `serverTimestamp()`: é autoritativo, atômico com a
escrita, não depende de rede extra, não cai no meio da aula e não custa nada (AC-TEMPO-09).
Uma API externa de horário ainda seria carimbada pelo cliente — ou seja, ainda falsificável.

## Critérios de aceite deste escopo

- AC-TEMPO-01 — horário de chamados e mensagens vem do servidor (`serverTimestamp()`), nunca do
  relógio do usuário.
- AC-TEMPO-02 — alterar manualmente o relógio da máquina não altera a posição na fila.
- AC-TEMPO-03 — exibição sempre em `America/Sao_Paulo`, seja qual for o fuso da máquina.
- AC-TEMPO-04 — formato brasileiro (`dd/mm/aaaa HH:mm`) e rótulos relativos ("há 3 minutos") para
  eventos recentes.
- AC-TEMPO-05 — `src/services/tempo.js` é a **única** fonte de horário; nenhum componente chama
  `new Date()` diretamente para gravar dados.
- AC-TEMPO-06 — enquanto o `serverTimestamp()` não confirma, a UI mostra "enviando…" em vez de um
  horário provisório errado.
- AC-TEMPO-07 — o reset do chat à meia-noite usa a meia-noite de Brasília, não a da máquina.
- AC-TEMPO-08 — registros antigos com `horario` em string ISO continuam lidos e ordenados. **[REG]**
- AC-TEMPO-09 — nenhuma chamada a API externa de horário.
- AC-CHAMADO-03 — fila ordenada por horário de envio crescente. **[REG]**

## Desenho pedido

`src/services/tempo.js`, a única porta de entrada e saída de tempo do app:

```js
carimboServidor()              // FieldValue.serverTimestamp() — para gravar
paraData(valor)                // Timestamp | string ISO | Date | null -> Date | null  (leitura dupla)
formatarDataHora(valor)        // "19/09/2026 14:32" em America/Sao_Paulo
formatarHora(valor)            // "14:32"
formatarRelativo(valor)        // "há 3 minutos" (< 1h); acima disso, data e hora absolutas
comparar(a, b)                 // comparador estável para ordenação; pendente vai para o FIM
estaPendente(valor)            // true enquanto serverTimestamp não resolveu
proximaMeiaNoiteBrasilia(agora)// próxima meia-noite em America/Sao_Paulo, em UTC
```

Use `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` — não implemente offset na mão
(o horário de verão brasileiro está suspenso, mas pode voltar; `Intl` acompanha a base IANA).

Aplique em: `TelaAluno.js`, `TelaProfessor.js`, `Chat.js` e qualquer escrita futura.

## Ponto delicado: a latência do `serverTimestamp()`

Com escrita otimista, o Firestore devolve o documento local com `horario: null` antes de o servidor
confirmar. Trate assim:

- `estaPendente()` → o card mostra **"enviando…"** no lugar do horário (AC-TEMPO-06).
- `comparar()` manda pendentes para o **fim** da lista, de forma estável (o card do próprio autor
  não pode ficar pulando de posição).
- Quando o servidor confirma, o `onSnapshot` reemite e o card assume a posição definitiva com
  transição suave (sem salto abrupto).

## Integração

- **Task 00:** os testes de caracterização assertam horário vindo do cliente. Atualize as asserções
  conscientemente, explicando no commit. Nunca apague o teste.
- **Task 03 (salas):** os chamados vão virar subcoleção de sala; mantenha o nome do campo `horario`
  para que a migração de sala não precise mexer em tempo ao mesmo tempo.
- **Task 08 (chat):** vai consumir `formatarHora()` para o horário de cada mensagem (AC-CHAT-01).
- **Task 09 (perks):** a ordenação passa a ser `prioridade desc, horario asc` — deixe `comparar()`
  composável para receber um critério anterior.
- **Firestore Rules:** adicione validação de que `horario` gravado é `request.time` (isto é, veio de
  `serverTimestamp()`), com teste provando que gravar um timestamp arbitrário é negado.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `paraData` converte `Timestamp`, string ISO, `Date` e `null` |
| 2 | `formatarDataHora` devolve horário de Brasília com a máquina em `America/New_York` |
| 3 | `formatarRelativo` devolve "há 3 minutos" e cai para absoluto acima de 1h |
| 4 | `comparar` ordena crescente e joga pendentes para o fim, de forma estável |
| 5 | Criar chamado grava `serverTimestamp()`, não `new Date()` |
| 6 | Relógio do cliente adiantado em 3h **não** muda a ordem da fila |
| 7 | Card com horário pendente mostra "enviando…" |
| 8 | Lista mista de `Timestamp` e string ISO ordena corretamente (retrocompat) |
| 9 | `proximaMeiaNoiteBrasilia` acerta com a máquina em outro fuso |
| 10 | Rule nega gravação de `horario` que não seja `request.time` |

Teste tempo com `jest.useFakeTimers()` e `setSystemTime()`; nunca com `sleep`. Rode pelo menos um
teste com `TZ=America/New_York` no ambiente para provar a independência de fuso (AC-TEST-09).

## Compatibilidade

- **Retroativa (crítica):** existem documentos em produção com `horario` como **string ISO**.
  `paraData()` aceita ambos os formatos e há teste com coleção mista. **Não rode migração
  destrutiva**: a leitura dupla é permanente nesta versão.
- **Futura:** a gravação passa a ser `Timestamp`. Um cliente antigo que faça
  `new Date(chamado.horario)` receberia um objeto `Timestamp` e produziria `Invalid Date`. Mitigue
  gravando **também** `horarioIso` (string, derivada no servidor por trigger ou preenchida na
  confirmação do cliente) durante esta versão, e documente que o campo será removido só na 1.0.0,
  depois que todos os clientes tiverem atualizado. Escreva o teste que prova a leitura pelo formato
  antigo.
- **Migração:** `scripts/migrar-horarios.js`, idempotente, com `--dry-run`, que preenche `horarioIso`
  onde faltar. Nunca apaga o campo original. Documente como reverter.

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md` (explique por que `serverTimestamp()` e não API externa — é a
decisão mais contraintuitiva do roadmap) e `docs/adr/0004-serverTimestamp-como-autoridade-de-tempo.md`.

## Como saber que terminou

Lint, `test:ci`, `test:rules` e `build` verdes; todos os ACs cobertos; suíte roda igual com
`TZ=UTC` e `TZ=America/New_York`; nenhum `new Date()` sobrando em caminho de escrita (comprove com
`grep -rn "new Date()" src/` e justifique cada ocorrência remanescente).

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Título:

```
fix(tempo): usa horário do servidor em vez do relógio do cliente na ordenação dos chamados
```

**Versão:** 0.3.0 → 0.4.0 (MINOR — correção com mudança aditiva no modelo de dados)
