# ADR 0004 — `serverTimestamp()` como autoridade de tempo

- **Status:** aceita
- **Data:** 2026-09-20
- **Versão:** 0.4.0
- **Contexto da task:** `tasks/02-tempo-brasilia.md`
- **Critérios:** AC-TEMPO-01 a AC-TEMPO-09, AC-CHAMADO-03

## Contexto

A fila de atendimento é o produto. O professor atende na ordem em que as
dúvidas chegaram, e até a v0.3.0 essa ordem era decidida pelo relógio do
computador de quem enviava:

```js
// TelaAluno.js
horario: new Date().toISOString()

// Chat.js
horario: new Date()
```

Nos laboratórios do SENAI as máquinas são compartilhadas, reimagens acontecem,
e data, hora ou fuso frequentemente estão errados. Isso produzia dois erros
distintos, e o segundo é pior que o primeiro:

1. **Sem intenção nenhuma.** O aluno da máquina com o relógio adiantado passa
   na frente de quem chegou antes. O da máquina atrasada afunda no fim da fila
   e não é atendido enquanto a aula durar. Ninguém percebe que houve erro —
   parece que o professor é que não chegou lá.

2. **Com intenção.** Adiantar o relógio do Windows é um clique. Não havia nada
   a explorar: o campo que ordenava a fila era escrito pelo cliente, e a única
   regra que o Firestore aplicava era `allow write: if true`.

Agrava que os dois lados também **exibiam** com `toLocaleString()`, que usa o
fuso da máquina. Uma máquina em UTC mostrava o horário três horas à frente do
que a turma inteira estava vendo no relógio da parede.

## Decisão

**O instante de todo dado gravado é decidido pelo servidor do Firestore, com
`serverTimestamp()`, e nunca pelo cliente.** Em volta dessa decisão:

1. **Uma porta única.** `src/services/tempo.js` concentra escrita, leitura,
   formatação, comparação e as contas de calendário. Nenhum componente chama
   `new Date()` para gravar e nenhum formata data por conta própria.

2. **O servidor recusa o resto.** As Firestore Rules passam a exigir
   `request.resource.data.horario == request.time`. Não basta o cliente ser
   correto: o campo é escrito por uma requisição, e quem abrir o DevTools
   escreve a requisição que quiser. A regra fecha o buraco onde ele existe.

3. **A exibição é sempre em `America/Sao_Paulo`**, via `Intl.DateTimeFormat`
   com o identificador IANA — não com offset fixo. O horário de verão
   brasileiro está suspenso desde 2019, mas suspensão é decreto, não lei da
   física. Um `-03:00` escrito à mão passaria a errar em silêncio durante
   quatro meses por ano se o decreto mudasse; `Intl` acompanha a base IANA
   junto com o navegador.

4. **A ordenação final é do app, não do Firestore.** O `orderBy` do Firestore
   ordena por **tipo** antes de ordenar por valor: toda string ISO da v0.1.0
   cairia depois de todo `Timestamp` novo, independentemente do instante. Quem
   decide a ordem é `criarComparadorPorHorario()`, que entende os dois
   formatos. O comparador aceita um critério anterior, para a task 09 compor
   `prioridade desc, horario asc` sem reescrevê-lo.

## O que foi descartado

**Consultar uma API pública de horário de Brasília.** É o palpite natural, e
seria pior em todos os eixos:

- **Não resolveria o problema.** Quem carimbaria o documento com a resposta da
  API ainda seria o cliente. Um aluno que quisesse furar a fila mandaria o
  valor que quisesse no lugar da resposta — voltaríamos ao mesmo lugar, com
  mais passos.
- **Introduziria uma dependência que cai no meio da aula.** O Firestore já é
  uma rede da qual o app depende; uma segunda rede é uma segunda chance de
  falhar, e o modo de falha é o pior possível: o aluno aperta "enviar" e não
  acontece nada.
- **Custaria latência em cada envio**, para obter um dado que a escrita já
  produz de graça.

`serverTimestamp()` é atômico com a escrita, autoritativo, não depende de rede
extra e não custa cota.

**Migrar os documentos antigos para `Timestamp`.** Descartado: existem
documentos em produção com `horario` em string ISO, e uma migração destrutiva
de campo de ordenação não tem volta se der errado no meio. A leitura dupla em
`paraData()` é **permanente** nesta versão — aceita `Timestamp`, string ISO,
`Date` e o objeto `{seconds, nanoseconds}` de um `Timestamp` serializado.

## Consequências

**O preço: a latência do carimbo.** Com escrita otimista, o Firestore entrega o
documento local com `horario: null` antes de o servidor confirmar. O card mostra
**"enviando…"** nesse intervalo, e não um horário provisório errado que depois
muda sozinho. `comparar()` manda os pendentes para o **fim**, empatados entre
si — como `Array.prototype.sort` é estável, a ordem de chegada desempata e o
card de quem acabou de enviar não fica pulando de posição.

**O risco: o cliente que ainda não atualizou.** `horario` mantém o nome e muda
de tipo, e um campo que muda de tipo é pior do que um campo removido, porque
não explode: `new Date(timestamp)` devolve `Invalid Date`, e a v0.3.0 escreveria
isso no card, calada, durante a aula. A mitigação é o campo aditivo
`horarioIso` — a mesma data em string, ao lado —, preenchido pelo cliente do
próprio autor na confirmação do carimbo e, para os documentos de quem não volta
a entrar, por `scripts/migrar-horarios.js`. O campo sai na **1.0.0**, quando não
houver mais versão anterior em sala.

**O efeito colateral bom:** a meia-noite que reseta o chat passa a ser a de
Brasília. Antes era `setHours(24, 0, 0, 0)` — a meia-noite da máquina —, então
numa máquina em UTC o chat da turma sumia às 21h.
