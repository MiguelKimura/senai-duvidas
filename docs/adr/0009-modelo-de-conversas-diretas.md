# ADR 0009 — Modelo das conversas diretas, janela do chat e o fim do `!clear` aberto

- **Status:** aceita
- **Data:** 2026-09-21
- **Versão:** 0.8.0
- **Contexto da task:** `tasks/06-chat-overhaul-dm.md`
- **Critérios:** AC-CHAT-01 a AC-CHAT-13, AC-DM-01 a AC-DM-06, AC-PERF-03, AC-PERF-06

## Contexto

O chat da v0.7.0 era a peça mais antiga do app: ela vinha quase intacta do
protótipo da v0.1.0, enquanto tudo em volta — papel, tempo, sala, anexo — já
tinha sido reescrito. Quatro problemas dele são estruturais, e cada um pede uma
decisão diferente.

**1. O `!clear` não tinha dono.** Qualquer aluno digitava cinco letras e apagava
a conversa da escola inteira. A deleção era um `forEach(async ...)` que
disparava as chamadas sem aguardar nenhuma: uma falha no meio do caminho não
aparecia para ninguém, e o campo limpava do mesmo jeito.

**2. A leitura não tinha teto útil.** A consulta era crescente com `limit`, o
que devolve as mensagens **mais antigas**. Numa sala em novembro isso é a
conversa de março: documentos que ninguém vai ler, pagos por cada aluno cada
vez que a tela abre, enquanto a mensagem de agora não cabe na janela.

**3. A cor caía no leitor.** `gerarCorParaUsuario(mensagem.email || usuarioEmail)`
— sem e-mail na mensagem, a cor saía do e-mail de **quem estava olhando**. A
mesma mensagem tinha uma cor em cada máquina da sala.

**4. A meia-noite apagava o banco.** Um `setTimeout` de até 24 horas chamava
`deleteDoc` em cada mensagem. Ele não sobrevivia a um refresh, usava a
meia-noite da máquina do aluno, e o que ele destruía não voltava.

## Decisão

### 1. A conversa direta é um documento com `participantes`, e a rule lê esse array

```
salas/{salaId}/conversas/{conversaId}          conversaId = "uidA_uidB", uids ORDENADOS
  participantes: [uidA, uidB]
  participantesNomes: {uidA, uidB}
  ultimaMensagem: {texto, horario, autorUid}
  naoLidas: {uidA: 0, uidB: 3}
  └── mensagens/{mensagemId}
```

```
allow read, write: if request.auth.uid in resource.data.participantes;
```

O `conversaId` é derivado dos dois uids **ordenados**, não sorteado. Isso é o
que torna "abrir a conversa com fulano" uma operação idempotente: os dois lados
calculam o mesmo id sem consultar nada, e não existe o caso de duas conversas
paralelas entre as mesmas duas pessoas porque cada um clicou primeiro.

**O que foi descartado:** guardar as DMs numa coleção única com campos `de` e
`para`. Ela exige duas consultas para montar a caixa de entrada (as que eu
mandei e as que recebi) e uma rule com `resource.data.de == uid ||
resource.data.para == uid`, que o Firestore não consegue satisfazer numa
listagem só. O array com `array-contains` resolve as duas coisas de uma vez.

**A amarração que isto cria, e que precisa ser dita:** a rule só protege a
listagem se o cliente consultar exatamente com
`where('participantes', 'array-contains', uid)`. O Firestore avalia a rule
contra a **consulta**, não contra os documentos que ela devolveria — uma
consulta sem esse filtro é negada inteira, mesmo que só fosse devolver
conversas da própria pessoa. Isso é bom (não há como vazar por engano) e é uma
pegadinha (a consulta e a rule precisam ser mudadas juntas). Está fixado em
`tests/rules/conversas.rules.test.js`, que prova o `permission-denied` de um
terceiro autenticado tanto no `get` do documento quanto na `query` da coleção.

### 2. `ultimaMensagem` e `naoLidas` são desnormalizados de propósito

Montar a lista de conversas a partir das subcoleções custaria uma consulta por
conversa só para descobrir qual foi a última mensagem — N leituras para
desenhar uma tela que ainda não abriu conversa nenhuma. Com os dois campos no
documento da conversa, a lista inteira sai de **uma** consulta, já ordenável por
`ultimaMensagem.horario` (AC-DM-06) e já com o contador (AC-DM-05).

**O preço, explícito:** cada mensagem enviada custa duas escritas em vez de uma
— a mensagem e a atualização do documento pai. É a troca certa aqui porque a
lista de conversas é lida muito mais vezes do que uma DM é escrita, e porque o
plano gratuito do Firebase é bem mais generoso com escrita (20 000/dia) do que
o volume de DMs de uma turma vai exigir.

### 3. A janela do chat é decrescente, começa em 50 e cresce a pedido

```js
query(colecao, orderBy('horario', 'desc'), limit(Math.min(janela, teto)))
```

**O que foi descartado:** paginar com cursor (`startAfter`). Ele leria só as 50
novas por página e seria mais barato num cenário de muitas páginas, mas traz
duas coisas que este chat não paga: um segundo conjunto de resultados fora do
`onSnapshot` — que não recebe edição nem deleção em tempo real e sai de
sincronia com a janela viva — e um cursor que expira quando a mensagem-âncora é
apagada pelo `!clear`. Com o teto de 300 por sala, a janela crescente custa no
pior caso seis releituras por aula e mantém **uma** fonte de verdade na tela.

**Uma ressalva honesta.** O `orderBy` do Firestore ordena por TIPO antes de
ordenar por valor: `Timestamp` vem antes de `string`. Uma mensagem da v0.1.0
com `horario` em string ISO não se intercala com as novas na ordenação do
servidor — ela é alcançada pela paginação, e a ordem que a tela mostra é
decidida no cliente por `criarComparadorPorHorario`, como em toda tela do app.

### 4. O painel fechado não escuta nada

O chat só assina o `onSnapshot` quando o painel está aberto. Antes, toda tela de
toda pessoa mantinha um listener de chat o dia inteiro, com o painel fechado —
era a maior fonte de leitura do app, e a maioria das telas nunca abre o chat.

### 5. A cor sai do autor, e a luminosidade é corrigida até o contraste passar

`corUsuario(seed)` usa hash determinístico do **`autorUid`**. Não existe
fallback para o usuário logado: um documento sem autor identificável recebe uma
cor neutra, nunca a cor de quem está lendo. Mensagem legada sem `autorUid`
deriva do `email` gravado — caminho legado, testado, e igualmente independente
do leitor.

A cor sorteada não é aceita de cara: a luminosidade é clareada em passos até
`razaoContraste()` (task 05) aprovar ≥ 4.5 contra o texto. É verificação, não
olhômetro — `src/utils/__tests__/corUsuario.test.js` percorre 1000 uids
sintéticos afirmando o mínimo AA.

### 6. A meia-noite virou filtro de exibição, não deleção

O dia corrente é calculado com `mesmoDiaEmBrasilia()` sobre
`services/tempo.js`, verificado no carregamento e rearmado por um temporizador
que **não escreve no banco** — ele troca uma data no estado e nada mais.

A promessa visível ao usuário é a mesma de antes: *o chat começa limpo a cada
dia*. O que mudou é que o histórico não é mais destruído para cumpri-la — ele
fica atrás do botão "Ver dias anteriores". Mais barato, reversível, e a
meia-noite é a de Brasília, não a da máquina do aluno.

Uma consequência a registrar: uma mensagem **sem `horario` nenhum** não pode
ser provada como de hoje, então ela não aparece na visão do dia — fica no
histórico. Mensagem recém-enviada, ainda sem o carimbo do servidor, é o caso
oposto e conta como de hoje (`estaPendente`), senão a própria fala que a pessoa
acabou de escrever piscaria e sumiria enquanto o servidor responde.

### 7. O `!clear` é do professor, e quem decide isso é o servidor

A autorização mora na rule: só o professor dono da sala deleta mensagens. A
interface pergunta antes — apagar a conversa da turma é irreversível e não pode
acontecer por um Enter de reflexo — e a deleção vai em `writeBatch` de no
máximo 500, **aguardando cada lote** e relatando falha parcial.

A confirmação na tela não é a proteção; ela é conforto. A proteção é a rule, e é
por isso que o teste que vale está em `tests/rules/salas.rules.test.js`: um
aluno que fale direto com o SDK, sem passar pela nossa tela, recebe
`permission-denied`.

## Consequências

**Boas**

- A DM é privada por construção: nenhum filtro de interface é a única barreira.
- A leitura por aluno por aula cai de O(todas as mensagens) para O(50 + novas),
  e cai a zero com o painel fechado.
- O histórico da turma deixa de ser destruído todo dia.
- A cor de uma mensagem é a mesma em qualquer máquina, para sempre.

**Ruins, ou pelo menos caras**

- Cada mensagem direta custa duas escritas.
- A consulta das conversas e a rule estão amarradas pelo `array-contains`:
  mudar uma sem a outra derruba a listagem inteira.
- A janela crescente relê a janela toda ao paginar, em vez de só a página nova.

## Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| DMs numa coleção só, com `de`/`para` | Rule com `||` não cobre listagem; exige duas consultas para a caixa de entrada |
| `conversaId` sorteado | Deixa nascer duas conversas entre as mesmas duas pessoas |
| Paginar com `startAfter` | Sai de sincronia com o `onSnapshot`; cursor expira no `!clear` |
| Continuar apagando o chat à meia-noite | Destrói histórico, depende do relógio da máquina, não sobrevive a refresh |
| `!clear` protegido só pela interface | É exatamente o defeito que esta versão corrige |
| Esconder a DM só por filtro de query | O terceiro que fale direto com o SDK lê tudo |
