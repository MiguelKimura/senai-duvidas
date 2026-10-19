# ADR 0005 — Modelo de dados escopado por sala

- **Status:** aceita
- **Data:** 2026-09-21
- **Versão:** 0.5.0
- **Contexto da task:** `tasks/03-salas-pin.md`
- **Critérios:** AC-SALA-01 a AC-SALA-10, AC-SEC-01, AC-SEC-02, AC-PERF-03, AC-PERF-06

## Contexto

`chamados` e `chat` eram coleções globais desde a v0.1.0. Consequências que
apareceram em sala:

- O professor de mecânica recebia as dúvidas de informática na mesma fila.
- O aluno do noturno lia a conversa do matutino, inclusive o que tinha sido
  dito sobre prova e nota.
- `!clear`, digitado por qualquer aluno, apagava a conversa da escola inteira.
- As rules não tinham como negar leitura a ninguém: negar exigiria uma noção de
  "turma" que o banco não tinha. `allow read: if request.auth != null` era o
  máximo que dava para escrever, e é o que estava escrito.

Havia três formas de introduzir essa noção:

1. **Campo `salaId` nos documentos globais**, com `where('salaId', '==', ...)`.
2. **Subcoleções da sala**: `salas/{salaId}/chamados`.
3. **Um banco por turma** (projetos Firebase separados).

## Decisão

**Subcoleções de `salas/{salaId}`.**

Contra a opção 1: com campo, o isolamento depende de o cliente lembrar de
filtrar. A rule pode exigir `resource.data.salaId == ...`, mas a consulta sem
`where` continua sendo uma consulta válida que a rule precisa recusar — e
recusar consulta é a parte mais frágil de escrever rules: erra-se em silêncio.
Com subcoleção, o caminho **é** o escopo. Uma consulta a
`salas/A/chamados` não tem como devolver um documento da sala B, nem por
descuido de quem escreve a query, nem por bug de índice.

Contra a opção 3: um projeto por turma multiplica configuração, cota, deploy e
credencial por dez. Para dez salas, é caro; para o professor que quer duas
turmas, é absurdo.

Decisões que acompanham:

1. **O papel dentro da sala é do vínculo, não do `AuthContext`.** Ser professor
   no SENAI não é ser professor **desta** sala. `salas/{id}/membros/{uid}.papel`
   é a autoridade, e é o que a rule consulta. Um professor que digite a URL da
   sala de um colega recebe a mesma recusa que um estranho (AC-SEC-02).

2. **Um espelho `usuarios/{uid}/salas/{salaId}`** para montar a lista de salas
   de cada pessoa. A pergunta "de quais salas eu sou membro?" não tem resposta
   barata a partir de `membros`: exigiria varrer as salas de todo mundo. O
   espelho é desnormalização deliberada, escrita pelo dono do próprio
   documento, e nunca é a autoridade sobre nada.

3. **Nenhum contador desnormalizado na sala.** `totalMembros` chegou a estar no
   modelo da task e foi descartado: mantê-lo honesto exigiria que todo aluno
   pudesse escrever no documento da sala ao abrir um chamado, e quem pode somar
   1 pode somar 500 — ou zerar. A contagem é feita por consulta com `limit`, o
   que cabe folgado no alvo do projeto (AC-PERF-06).

4. **Todo listener tem `limit`.** 200 chamados e 300 mensagens por sala. A fila
   cresce o ano letivo inteiro; sem corte, abrir o app em novembro custaria
   novembro inteiro (AC-PERF-03).

5. **Fallback de leitura, com prazo.** Sem `salaId`, as telas leem as coleções
   globais. É o que impede a tela vazia no meio da migração. Sai na 1.0.0.

## Consequências

**Boas**

- O isolamento é estrutural, não uma condição que alguém pode esquecer.
- As rules ficam legíveis: cada subcoleção tem uma pergunta só — "é membro?".
- O custo por sala é previsível, e a conta está em `docs/ARQUITETURA.md`.

**Ruins, e aceitas**

- **Consulta entre salas fica impossível** sem `collectionGroup`. "Quantos
  chamados abertos há na escola?" passa a exigir um índice de grupo de coleção,
  que ninguém precisou ainda.
- **O espelho pode divergir.** Removido da sala, o aluno fica com o espelho
  apontando para uma sala que não abre — ninguém escreve no documento de outra
  pessoa, nem o professor. A lista de salas descarta o cartão que não responde.
- **A migração é obrigatória.** Dado global não aparece em sala nenhuma por
  conta própria. Daí `scripts/migrar-para-salas.js` e o fallback de leitura.

## Alternativas descartadas

- **Campo `salaId` nas coleções globais** — isolamento dependente de filtro no
  cliente, e rules que precisam recusar consultas em vez de documentos.
- **Um projeto Firebase por turma** — custo operacional desproporcional.
- **Contador desnormalizado de membros e de chamados** — exigiria dar escrita
  no documento da sala a quem não é dono.
