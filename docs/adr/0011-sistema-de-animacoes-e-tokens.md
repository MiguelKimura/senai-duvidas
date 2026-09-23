# ADR 0011 — Uma camada de movimento, um arquivo de tokens, e o vermelho da marca mais escuro

- **Status:** aceita
- **Data:** 2026-09-23
- **Versão:** 0.10.0
- **Contexto da task:** `tasks/08-animacoes-a11y.md`
- **Critérios:** AC-ANIM-01 a AC-ANIM-10, AC-CHAMADO-04, AC-CHAMADO-06, AC-CHAMADO-09, AC-CHAMADO-10

## Contexto

O cliente pediu duas coisas, com estas palavras:

> "Melhorar as animações do site (em geral)."
> "Auto delete da própria dúvida (caso ela já tenha sido resolvida): isso já
> existe, mas é bom revisar."

O primeiro pedido parece de acabamento. Não é. Cada task de 02 a 07 entregou a
animação mínima do próprio escopo, e cada uma escolheu a duração e a curva na
hora: `0.3s` no chat, `150ms` no campo de anexo, `0.45s` e `1.2s` na premiação,
mais alguns `0.3s` crus espalhados. Nenhuma estava errada sozinha; juntas, elas
fazem a interface parecer montada por seis pessoas que não se falaram. E,
o que é mais grave, cada folha trazia o próprio bloco de
`prefers-reduced-motion` — quatro blocos, cada um cobrindo a própria folha e
nenhum cobrindo a seguinte. Movimento involuntário dispara enjoo e crise
vestibular em parte das pessoas; uma folha esquecida é alguém passando mal
durante a aula.

O segundo pedido é sobre confiança. O que existia era um botão vermelho que
apagava a dúvida e o print anexado no primeiro clique, sem perguntar e sem
volta.

Ao arrumar o primeiro, a auditoria do AC-ANIM-10 encontrou um problema que
ninguém tinha procurado: **a identidade visual do projeto reprova em
contraste**.

## Decisão

### 1. Uma camada de movimento, e um bloco de `prefers-reduced-motion` só

`src/styles/animacoes.css`, carregado uma vez por `index.css`, tem duas coisas
e apenas duas: a supressão global e os quadros e classes que toda tela
compartilha (entrada escalonada, saída de card, fade-slide de modal e de rota,
esqueleto, estados de botão).

A supressão usa seletor universal e `!important` — o único `!important` do
arquivo, e deliberado: a preferência da pessoa vence qualquer especificidade
que uma task futura venha a inventar. Sem ele, uma regra mais específica
escrita depois reintroduz o movimento sem ninguém notar.

Onde o movimento é decidido em JavaScript, e não por `transition`, quem
responde é `hooks/useMovimentoReduzido.js`, que lê a mesma consulta de mídia. É
o caso da premiação em tela cheia (AC-PERK-04), que tem um cronômetro: quem
pediu menos movimento precisa de **mais** tempo de leitura, não de um card que
some em dois segundos e meio.

**Três durações, e não uma por componente:** `--dur-rapida: 150ms` (o realce que
segue o dedo), `--dur-media: 220ms` (um card entrando na fila), `--dur-lenta:
300ms` (modal e rota, o teto que o AC-ANIM-01 permite). As curvas seguem a
assimetria que a documentação de movimento do Material e do WAI descrevem pelo
mesmo motivo físico: o que **chega** desacelera, porque precisa ser lido no
fim; o que **sai** acelera, porque já não interessa.

O que fica fora da faixa tem nome próprio e motivo declarado, cobrado em
`styles/__tests__/animacoes.test.js`: `--dur-celebracao` e `--dur-brilho` são o
pedido literal do cliente ("tipo o do Call of Duty"), e 300ms não entregam
aquilo; `--dur-desfazer` é a janela de arrependimento do AC-CHAMADO-04.

**Só `transform` e `opacity`** (AC-ANIM-06). São as duas propriedades que o
navegador resolve na composição, sem recalcular layout. Animar `height` numa
fila de 200 cards recalcula a página a cada quadro, e é a diferença entre a
lista rolar e a lista travar. O teste varre todas as folhas e reprova quem
transiciona outra coisa — inclusive `all`, que arrasta layout junto sem
ninguém pedir.

### 2. O arquivo de tokens deixa de ser decoração

A task 00 extraiu `tokens.css` dos CSS existentes e provou, com teste, que
nenhum valor tinha sido inventado. O que ela não podia fazer — a regra era
"nenhuma mudança visual" — era trocar os literais pelos `var(--token)` nos
componentes. Seis versões depois, `#ff0000` continuava literal em seis folhas,
`gray` em sete lugares do chat, `white` em quatro grafias.

Enquanto o literal estiver espalhado, o arquivo de tokens não é fonte de
verdade: mudar `--cor-primaria` não muda um pixel. Esta versão troca os 130 e
poucos literais por `var(--token)` e acrescenta o teste que faltava —
`styles/__tests__/consumoDeTokens.test.js` proíbe **qualquer** cor literal fora
de `tokens.css`, com uma exceção nomeada (a amostra da paleta, cuja fonte de
verdade é `utils/paleta.js`).

Com isso, `tokens.test.js` precisou mudar de invariante. Ele exigia que todo
valor de token aparecesse literalmente em algum CSS legado — o que provava a
extração e **se destruía sozinho** no instante em que as folhas parassem de
escrever literais. Passou a comparar com uma foto congelada dos valores da
v0.1.0. Mesma pergunta, resposta que não depende do estado atual das folhas.

### 3. O vermelho da marca escurece: `#ff0000` → `#d60000`

Esta é a decisão que mais custa explicar, e a menos negociável.

Branco sobre `#ff0000` dá **4,0:1**. O piso da WCAG AA para texto normal é
4,5:1. Isso significa que **todo rótulo de botão do aplicativo** — entrar,
cadastrar, enviar, excluir, o `+` de novo chamado, o botão do chat — estava
abaixo do mínimo. Não é uma questão de gosto nem de rigor excessivo: numa sala
com projetor ligado e monitores de laboratório, é a diferença entre ler o botão
e adivinhar onde ele está.

Três saídas foram consideradas:

- **texto escuro sobre o vermelho.** Passa na conta e é ilegível na prática:
  quase-preto sobre vermelho saturado vibra;
- **tratar o rótulo como texto grande**, que tem piso de 3:1. Rótulo de botão
  não tem 24px, e forçá-lo a ter mudaria todo o layout;
- **escurecer o vermelho.** É o que foi feito.

`#d60000` é o vermelho **mais claro** que passa em três pares ao mesmo tempo:
branco sobre ele (5,44:1), ele como texto sobre branco (5,44:1) e ele como
texto sobre a página cinza-clara (4,95:1). Escurecer menos reprova o terceiro
par; escurecer mais tira do vermelho o que faz dele vermelho. O número não foi
escolhido por gosto — foi resolvido pela desigualdade, e a conta está em
`styles/__tests__/contraste.test.js`, par a par, com o arquivo e o seletor onde
cada um acontece.

Na mesma passagem: `--cor-erro` deixa de ser `red` e vira `#c62828` — que não é
tom novo, é o que `BotaoSair.css` já praticava; `--cor-texto-discreto` deixa de
ser `gray` (3,4:1 sobre o cinza do chat) e vira `#666`; nasce
`--cor-texto-forte`, o `#1a1a1a` que `utils/paleta.js` já usava, no lugar do
`#000000` do card.

A varredura achou de brinde dois defeitos que nenhuma revisão manual pegaria,
porque um dura meio segundo e o outro depende de `:hover`: o "Carregando..." do
login era **branco sobre a página cinza-clara** (1,1:1 — texto invisível), e o
`:hover` do botão "Cancelar" da confirmação escurecia o fundo mantendo o texto
escuro (2,2:1).

### 4. A tabela de contraste é escrita à mão, e isso é a decisão

Extrair os pares automaticamente do CSS exigiria resolver a cascata e a árvore
do documento, e o jsdom não aplica folha de estilo. Uma extração automática
erraria o fundo e aprovaria o par errado — e um teste de contraste que aprova o
errado é pior do que nenhum.

A tabela é a leitura humana do CSS, conferida pela máquina, e cada linha traz
**onde** aquele par acontece. O par que ninguém consegue apontar na tela é par
imaginário. O guarda contra o envelhecimento dela é um teste que exige que todo
token de cor apareça em algum par ou esteja numa lista de exceções com motivo
escrito.

### 5. `jest-axe` cobre um terço, e o teste à mão cobre o resto

Onze telas passam pelo `axe`, exigindo zero violação **crítica ou séria**.
Moderadas e leves entram no relatório e não reprovam, pela razão de sempre: um
piso que reprova tudo vira um piso que alguém desliga.

O que o `axe` não cobre é o que exige julgamento — ordem de tabulação, prisão
de foco, se o rótulo faz sentido —, e nada disso é acidente. Essas coisas têm
testes próprios, escritos à mão, em `ConfirmarAcao.test.js`, `Modal.test.js`,
`Lightbox.test.js`, `Toast.test.js` e `Chat.test.js`. Somados, os dois lados
são a auditoria; sozinho, o `axe` dá uma aprovação que não significa nada.

O contraste fica **desligado** dentro do `axe`, porque o jsdom leria preto sobre
transparente em toda tela. Quem mede contraste é o teste dos tokens.

### 6. A exclusão passa a perguntar, e passa a ter volta

Confirmação obrigatória (AC-CHAMADO-04) com foco inicial no botão **seguro** —
quem aperta Enter de reflexo cancela, em vez de apagar. Depois da confirmação,
a exclusão é **otimista**: o card sai da fila na hora, com animação de saída, e
a gravação fica adiada por cinco segundos enquanto o toast oferece "Desfazer".
Desfazer não recria documento nenhum, porque nada chegou a sair.

Não é `window.confirm()` pela mesma razão que o visualizador de anexo não é
`window.open()`: em parte dos laboratórios do SENAI as duas vêm suprimidas por
política do Windows, e `confirm()` suprimido devolve `false` em silêncio — a
ação simplesmente nunca acontece, e ninguém descobre por quê.

Para o professor, "marcar como atendido" (AC-CHAMADO-06) entra ao lado de
excluir. É o que ele queria quando apagava: tirar o chamado da frente sem
perder o histórico da turma. `atendido` é campo **aditivo** — chamado sem ele
conta como aberto — e `ordenarFila` já mandava o atendido para o fim desde a
v0.9.0.

### 7. Quatro pontos de corte, e o laboratório é o alvo

480px, 768px, 1024px e 1440px, com um teste que reprova qualquer folha que
invente um quinto. Cada ponto de corte novo é uma combinação a mais para
conferir à mão, e a lista cresce sozinha se ninguém a guardar.

O achado mais caro desta parte não é de celular, é do laboratório. As duas
telas de sala são uma coluna de `height: 95vh` e pediam
`height: calc(100vh - 120px)` para a lista de dentro — duas contas sobre a
mesma janela, a de dentro maior. Na 1024×768 do SENAI a coluna tem 730px e o
conteúdo pedia 776: a lista vazava por baixo e o botão `+`, que é
`position: fixed`, cobria o último card. Num monitor de 1080px a conta fecha, e
é por isso que ninguém nunca viu o defeito — ele só aparece exatamente na tela
onde o app roda de verdade.

## Consequências

**Positivas**

- Mudar a identidade visual passou a ser uma linha. Antes era uma caçada por
  seis arquivos, com uma cópia esquecida garantida.
- A preferência por menos movimento vale no app inteiro, e não folha a folha.
- A exclusão deixou de ser irreversível. O aluno que clica errado tem cinco
  segundos e um botão.
- Contraste, cores literais, pontos de corte, diálogos de navegador e
  violações do `axe` passaram a ter guarda automática. Nenhum deles volta em
  silêncio.

**Negativas e riscos**

- **O vermelho da marca mudou.** É a mudança visual mais perceptível desde a
  v0.1.0, e alguém vai notar. O argumento é de acessibilidade, está
  documentado aqui e medido em teste; se a escola quiser o tom exato do manual
  de identidade dela, a troca agora é uma linha em `tokens.css` — desde que o
  tom novo passe em `contraste.test.js`.
- A tabela de contraste é manual e pode envelhecer. O guarda contra isso é
  outro teste, não a disciplina de quem edita.
- `jest-axe` é lento em jsdom: o arquivo de auditoria tem teto de 60s por
  teste, contra os 5s da suíte. É o preço de rodar 90 regras sobre a árvore
  inteira sem as otimizações que o navegador dá ao `axe`.
- Os testes de responsividade leem o **texto** do CSS, não o layout. Eles
  provam que a regra existe e está no ponto de corte combinado; não provam
  que um pixel caiu onde deveria. Medir de verdade é escopo do `test:e2e`
  (Playwright) na v1.0.0.

## Alternativas descartadas

- **Uma biblioteca de animação (Framer Motion, React Spring).** Traria 30kB+
  de bundle para um app que roda em máquina de laboratório e precisa de
  `npm ci && npm run build` limpo. O que este projeto anima cabe em
  `@keyframes` e `transition`.
- **Manter `#ff0000` e abrir exceção no AC-ANIM-10.** Seria reescrever o
  critério para caber na implementação, que é exatamente o que o protocolo do
  projeto proíbe.
- **Virtualização da fila** em vez de paginação. Paginar é mais simples,
  combina melhor com o `onSnapshot` e reduz leituras (AC-PERF-03). A
  virtualização volta à mesa se 200 cards deixarem de ser o teto.
- **`<dialog>` nativo com `showModal()`.** Ainda não está nas duas últimas
  versões de todos os navegadores da lista de compatibilidade do projeto, e a
  tela do laboratório é justamente a desatualizada. Por isso a prisão de foco
  é `hooks/useDialogoModal.js`, compartilhado pelos três diálogos.
