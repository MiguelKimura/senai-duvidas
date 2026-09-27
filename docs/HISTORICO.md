# Histórico de Desenvolvimento

> Este documento é a memória do projeto. Cada versão registra **o que existia antes**, **que
> problema real isso causava para alunos e professores**, **que decisão foi tomada e por quê** —
> incluindo o que foi descartado — e **o que o usuário final passa a sentir na prática**.
>
> Toda task do roadmap acrescenta a sua seção aqui antes de abrir o PR. Na v1.0.0, a task 09
> fecha o documento com a seção "O sistema hoje, pelos olhos de quem usa".

---

## v0.1.0 — O protótipo que funcionou

**O que existia**

Um Create React App com Firebase, escrito durante o curso. Um aluno faz login, aperta o `+`,
descreve o problema e o card aparece na tela do professor em tempo real. Tem chat, tem anexo por
URL, tem cadastro com verificação de quem pode ser professor. Funcionou de verdade, em sala.

**Os limites que apareceram com o uso**

- **A fila dependia do relógio do aluno.** O sistema gravava `new Date().toISOString()` no
  computador de quem enviava. Nos laboratórios, muitas máquinas estão com data ou fuso errados —
  então a ordem de atendimento nunca foi confiável, e quem quisesse furar a fila só precisava
  mexer no relógio do Windows.
- **Todo mundo via tudo.** `chamados` e `chat` eram coleções globais. Não havia como separar
  turmas, cursos ou períodos.
- **O papel vinha do navegador.** `App.js` lia `localStorage.getItem('tipoUsuario')` para decidir
  se a pessoa era aluno ou professor. Duas linhas no console do navegador davam acesso à tela do
  professor.
- **`!clear` era de todos.** Qualquer aluno apagava o chat inteiro digitando um comando.
- **Imagem só por link.** O aluno tirava print do erro e não tinha onde hospedar, então acabava
  descrevendo por escrito — e o professor perdia tempo pedindo detalhe.
- **Sem nenhum teste.** Toda mudança era uma aposta.
- **Três implementações de autenticação** convivendo (`App.js`, `AuthContext.js` e `firebase.js`),
  competindo entre si — daí a tela de login que piscava.

**O que o usuário sentia**

O sistema resolvia o problema principal — o professor via as dúvidas sem ninguém levantar a mão —
mas a ordem de atendimento era imprevisível e a turma toda dividia o mesmo espaço.

---

## v0.2.0 — Fundação de testes

**O que existia**

O protótipo da 0.1.0, rodando em sala, sem um único teste. Nenhum lint, nenhum CI, nenhuma
Security Rule versionada, e a configuração do Firebase escrita no meio de `src/firebase.js`.
Cada alteração era publicada na confiança de que a pessoa que a fez tinha testado à mão as
telas que lembrou de abrir.

**O problema que isso causava**

O roadmap até a 1.0.0 mexe em autenticação, em ordenação da fila e no escopo dos dados — as
três coisas cuja quebra não aparece na tela de quem alterou o código, e sim na aula de outra
pessoa, três dias depois. Sem uma descrição executável do comportamento atual, não havia como
saber se uma correção tinha consertado o problema pretendido ou apenas trocado um erro por
outro mais silencioso.

**A decisão, e por quê**

Escrever a rede de segurança antes de qualquer funcionalidade, e escrevê-la como **testes de
caracterização**: testes que descrevem o sistema como ele é, *incluindo o que está errado*.

Essa é a parte contraintuitiva da versão. Há um teste que prova que o papel de professor sai do
`localStorage`, e portanto que duas linhas no console do navegador dão acesso à tela do
professor. Há um teste de Security Rules que prova que um aluno apaga o chamado de outro. Eles
**passam**. Não porque isso esteja certo, mas porque essa é a única forma de a task que vai
consertar cada um mostrar, no diff, que mudou o comportamento de propósito: o teste inverte de
"consegue" para "é negado", e a inversão é a prova.

O que foi descartado: a tentação de corrigir logo as falhas óbvias encontradas pelo caminho. O
papel no `localStorage` dá para tirar em vinte minutos. Corrigir ali, sem teste e no meio de uma
task de infraestrutura, teria entregado uma correção que ninguém consegue verificar, num PR que
ninguém consegue revisar. Cada falha está registrada com a task responsável, e nenhuma foi
tocada aqui.

Também ficou de fora o Vitest, que seria mais rápido: trocar o runner exige ejetar do
`react-scripts`, e essa é uma cirurgia grande para fazer antes de existir a suíte que provaria
que ela deu certo. A decisão inteira, com as alternativas, está em
[`docs/adr/0001`](adr/0001-escolha-do-harness-de-testes.md); a de branches, em
[`docs/adr/0002`](adr/0002-estrategia-de-branches-main-dev.md).

**O que entrou**

- 183 testes unitários e de componente, 89,9% de linhas e 80,5% de branches cobertas, com
  limiar que quebra o build abaixo de 80/75
- 21 testes de Security Rules contra o Firebase Emulator Suite, no projeto `demo-senai-duvidas`,
  com uma guarda que se recusa a rodar contra produção
- `firestore.rules` e `storage.rules` versionados pela primeira vez, como baseline do estado
  atual, cada permissão excessiva marcada com `TODO(task-03)`
- ESLint com `jsx-a11y` e Prettier, zero warnings toleradas
- CI no GitHub Actions: `lint` → `test` → `test-rules` → `build`, mais um job que reprova commit
  fora do padrão Conventional Commits
- config do Firebase por `REACT_APP_*`, com fallback para os valores de hoje e aviso no console
  quando o fallback é usado
- `src/styles/tokens.css`, a fonte única de cores, espaçamentos, raios, sombras e durações,
  extraída dos CSS existentes sem alterar um valor
- `README.md` reescrito, `CONTRIBUTING.md`, `CHANGELOG.md` gerado dos commits, e os dois
  primeiros ADRs

**O que o usuário sente**

Nada. Essa é a medida de sucesso desta versão: a interface, os textos e o comportamento são
exatamente os da 0.1.0. Se um aluno tivesse notado qualquer diferença, a task teria saído do
escopo.

O que muda é para quem vem depois. A partir daqui, uma alteração que quebre o login, a ordem da
fila ou a exclusão de chamado é reprovada pelo CI antes de virar PR — em vez de ser descoberta
por um professor com a turma esperando.

## v0.3.0 — Login social e sessão que não expira

**O que existia**

A 0.2.0 entregou a rede de proteção — testes, lint, CI, rules versionadas — e deixou o
comportamento do app exatamente como estava, de propósito. Entre os comportamentos fixados em
teste de caracterização estava este, em `src/App.js`:

```js
tipo: localStorage.getItem('tipoUsuario') || 'aluno'
```

**O problema que isso causava**

`localStorage` é memória do navegador do próprio usuário. Qualquer aluno abria o DevTools,
digitava `localStorage.setItem('tipoUsuario','professor')`, recarregava a página e entrava na
tela do professor — vendo a fila inteira da turma e podendo apagar o chamado de quem quisesse.
Não havia exploração a desenvolver, nem ferramenta a instalar: era uma linha digitada no
console, e ela circula entre alunos mais rápido do que qualquer correção.

Havia ainda uma segunda camada do mesmo problema, invisível na tela: as Security Rules de
`usuarios/{uid}` eram `allow read, create, update, delete: if true`. Mesmo com o front-end
correto, uma chamada avulsa ao Firestore gravava `tipo: "professor"` no próprio documento.

Em volta disso, três implementações de autenticação concorrentes — `App.js`, um
`AuthContext.js` que nenhum componente importava, e helpers soltos em `firebase.js` com um
`onAuthStateChanged` no nível do módulo — mais um quarto listener dentro de `Login.js`. Com
quatro observadores decidindo rota ao mesmo tempo, não existia um lugar onde consertar, e a
tela de login **piscava** para quem já estava logado. Os botões de Google e GitHub, por sua
vez, nem apareciam na interface: `App.js` passava as funções como props, e `Login.js` não as
recebia. Quem conseguisse autenticar por um provedor social não ganhava documento em
`usuarios/{uid}` e ficava preso na mensagem "Usuário não encontrado no banco de dados".

**Por que a correção veio antes das features**

O roadmap tinha salas, imagens, chat novo e perks pela frente — tudo mais visível para quem usa
do que uma linha de `localStorage`. A ordem foi invertida de propósito, por três razões:

1. **O dano é de aula, não de código.** Um aluno na tela do professor apaga o chamado de outro
   aluno no meio de uma atividade avaliada. Não há como desfazer aquela aula.
2. **Toda feature futura depende do papel.** Salas precisam saber quem é professor; perks
   precisam saber quem é professor *daquela sala*. Construir qualquer uma delas sobre um papel
   falsificável seria construir sobre a mesma falha, multiplicada por quatro telas.
3. **A correção só fica barata agora.** Mudar a origem do papel obriga a ajustar todo código
   que o consome. Com quatro telas é uma tarde; com doze, é uma refatoração de risco.

**O que foi decidido**

O papel passa a vir do Firestore, exigindo que **duas** fontes concordem: `usuarios/{uid}.tipo`
e `autorizados/{email}.Tipo`. `autorizados` é mantida à mão no console do Firebase e tem
escrita negada pelas rules — é a única das duas que o cliente não consegue forjar. As quatro
autenticações viraram uma: `src/contexts/AuthContext.jsx`, com as chamadas ao SDK isoladas em
`src/services/auth.js` e a decisão de papel em `src/services/perfilUsuario.js`. `App.js` ficou
sendo só roteamento. A mesma regra foi levada para o servidor, em `firestore.rules`, com as
funções `ehAutenticado()`, `ehDono()` e `ehProfessor()`.

O raciocínio completo, com as alternativas, está em
`docs/adr/0003-fonte-unica-de-verdade-para-papel-do-usuario.md`.

**O que foi descartado**

- **Custom claims no token do Firebase.** É a solução tecnicamente melhor — o papel viajaria
  assinado, sem leitura extra. Exige Cloud Functions com plano Blaze, que pede cartão de
  crédito, e o projeto precisa caber no plano gratuito. Fica registrado como caminho futuro.
- **Bloquear a professora legada cujo e-mail saiu de `autorizados`.** Seria o mais rígido, e
  transformaria um erro de cadastro numa aula perdida na porta da sala. Ela entra **como
  aluna**, com aviso na tela e registro em log para o administrador reconciliar.
- **Endurecer as rules de `chamados` e `chat` junto.** Derrubaria o app em produção: essas
  coleções ainda não têm escopo de sala. Ficou para a task 03, que reusa as funções auxiliares
  criadas aqui.
- **Apagar `tipo` de `usuarios/{uid}` e usar só `autorizados`.** Quebraria as contas de
  professor que já existem.

**O que o usuário sente na prática**

- **O aluno** vê dois botões novos na tela de login — "Entrar com Google" e "Entrar com GitHub"
  — e entra sem criar mais uma senha. No primeiro acesso o perfil é criado sozinho, em vez de
  "Usuário não encontrado no banco de dados". A tela de login não pisca mais.
- **Quem já estava logado** continua logado: fechar a aba, dar Ctrl+F5, perder a rede um minuto
  ou desligar o computador não pedem senha de novo, e ficar a tarde inteira com a aba aberta
  não desloga mais (`browserLocalPersistence`, com renovação automática de token).
- **Todo mundo** passa a ver um botão "Sair" em todas as telas autenticadas — o laboratório é
  máquina compartilhada, e até aqui a única forma de sair era limpar o navegador.
- **Erro de login** vira frase em português dentro do formulário, no lugar do `alert()` com o
  código cru do Firebase. E-mail já cadastrado por outro método agora explica o que fazer.
- **O aluno que tentar o truque do `localStorage`** simplesmente continua na tela do aluno.

## v0.4.0 — Horário oficial

**O que existia**

A fila de atendimento ordenada pelo relógio do computador do aluno. `TelaAluno.js` gravava
`new Date().toISOString()`, `Chat.js` gravava `new Date()`, e as duas telas exibiam com
`toLocaleString()` — o fuso da máquina, qualquer que fosse.

**O problema que isso causava**

Nos laboratórios as máquinas são compartilhadas e reimageadas, e data, hora ou fuso
frequentemente estão errados. O resultado aparecia de dois jeitos, e o segundo é pior:

- **Sem ninguém fazer nada.** O aluno da máquina adiantada passava na frente de quem chegou
  antes. O da máquina atrasada afundava no fim e não era atendido enquanto a aula durasse —
  e não parecia erro do sistema, parecia que o professor não tinha chegado lá.
- **De propósito.** Adiantar o relógio do Windows é um clique. Não havia nada a explorar: o
  campo que ordenava a fila era escrito pelo cliente, e o servidor aceitava qualquer valor.

Além disso, a meia-noite que limpava o chat era a da máquina. Numa máquina configurada em
UTC, a conversa da turma sumia às 21h.

**A decisão, e o que foi descartado**

O horário passa a ser carimbado pelo **servidor**, com o `serverTimestamp()` do Firestore, e
as Firestore Rules passam a **negar** qualquer `horario` que não seja `request.time` — porque
não basta o cliente ser correto quando qualquer pessoa pode escrever a requisição à mão pelo
DevTools. Todo tempo do app entra e sai por `src/services/tempo.js`.

O palpite natural era **consultar uma API pública de horário de Brasília**, e ele foi
descartado — é a decisão mais contraintuitiva desta versão, e o motivo é simples: **não
resolveria nada**. Quem carimbaria o documento com a resposta da API ainda seria o cliente,
então o valor continuaria falsificável, agora com mais passos. De quebra, seria uma segunda
rede para cair no meio da aula e mais latência em cada envio. O `serverTimestamp()` é atômico
com a própria escrita, não depende de rede extra e não custa cota nenhuma. O raciocínio
completo está no ADR `docs/adr/0004-serverTimestamp-como-autoridade-de-tempo.md`.

Também foi descartado **migrar os documentos antigos**: existe dado em produção com `horario`
em string ISO, e migração destrutiva de campo de ordenação não tem volta se falhar no meio.
`paraData()` entende os dois formatos, permanentemente nesta versão.

O preço da decisão é a latência do carimbo: entre apertar "enviar" e o servidor confirmar, o
documento local vem sem horário. O card mostra **"enviando…"** nesse intervalo — em vez de um
horário provisório errado que depois muda sozinho —, e fica no fim da fila, sem pular de
posição, até a confirmação chegar.

O risco é o cliente que ainda não atualizou: `horario` mantém o nome e muda de tipo, e a
versão anterior faria `new Date(...)` nele e escreveria "Invalid Date" no card, calada. Por
isso a v0.4.0 grava **também** `horarioIso`, a mesma data em string ao lado. É campo de
transição, com data de morte marcada na 1.0.0.

**O que o usuário sente na prática**

- **A fila fica na ordem certa.** Quem enviou primeiro aparece primeiro, independentemente do
  relógio de cada máquina — e mexer no relógio do Windows não move mais ninguém de lugar.
- **Todo mundo vê o mesmo horário**, no fuso de Brasília e no formato `dd/mm/aaaa HH:mm`,
  mesmo que a máquina esteja configurada em outro fuso.
- **Eventos recentes ganham rótulo em português** — "agora mesmo", "há 3 minutos" — e acima de
  uma hora voltam a mostrar data e hora, que é quando o relativo para de informar.
- **Ao enviar**, o card aparece imediatamente com "enviando…" no lugar do horário, e assume a
  posição definitiva quando o servidor confirma.
- **O chat some à meia-noite de Brasília**, e não às 21h de uma máquina em UTC.

## v0.5.0 — Salas com PIN

**O que existia**

Duas coleções globais, desde a primeira versão: `chamados` e `chat`. Todo mundo escrevia nas
mesmas duas, e todo mundo lia as mesmas duas. O professor de mecânica recebia as dúvidas de
informática na mesma fila; o aluno do noturno lia a conversa do matutino, incluindo o que tinha
sido falado sobre prova. Um aluno digitava `!clear` e apagava a conversa da escola inteira.

As rules não tinham como impedir nada disso. Negar leitura exigiria que o banco soubesse o que é
uma turma, e ele não sabia — o máximo que dava para escrever era "precisa estar logado", e era
isso que estava escrito.

**O que foi decidido, e por quê**

A sala virou uma coleção de verdade, e os dados passaram a morar **dentro** dela:
`salas/{salaId}/chamados` e `salas/{salaId}/chat`. A alternativa era um campo `salaId` nos
documentos globais, com `where` na consulta — e foi descartada porque, com campo, o isolamento
depende de alguém lembrar de filtrar. Com subcoleção, o caminho **é** o escopo: uma consulta à
sala A não tem como devolver um documento da sala B, nem por descuido de quem escreve a query.
O raciocínio inteiro está no ADR 0005.

O PIN foi a parte delicada. Seis dígitos são um milhão de combinações: pouco para um script,
muito para alguém adivinhar de primeira. Três decisões saíram daí (ADR 0006):

1. **O PIN nunca é gravado em claro.** O banco guarda só um resumo SHA-256 com sal, e guarda
   num documento separado — porque as rules do Firestore **não escondem campo**: se o resumo
   morasse no documento da sala, os quarenta alunos da turma o leriam junto com o nome dela.
2. **Quem confere o PIN é o servidor.** O cliente propõe a entrada e a rule refaz o resumo. O
   aluno nunca lê o segredo, e um cliente adulterado não ganha nada com isso.
3. **A recusa é sempre a mesma frase.** PIN que não existe, PIN de sala arquivada e PIN
   regerado produzem a mesma mensagem. Qualquer diferença transformaria a tela num oráculo
   respondendo "este número é PIN de alguém?".

O que foi **descartado** pelo caminho:

- **Um contador de membros no documento da sala.** Estava no modelo da task e saiu: mantê-lo
  honesto exigiria que todo aluno pudesse escrever no documento da sala, e quem pode somar 1
  pode somar 500. A contagem passou a ser uma consulta com teto.
- **Gerar o PIN no script de migração.** Ele teria que imprimir o número em algum lugar, e esse
  lugar é o histórico do terminal, o log do CI e o print que alguém manda no grupo. A sala
  migrada nasce sem PIN, e o professor gera o dele no app.
- **Apagar as coleções globais na mesma versão.** Elas ficam como backup vivo até a 1.0.0, e o
  app cai nelas quando a pessoa não está em sala nenhuma. É o que impede a tela vazia para quem
  abrir o app no meio da migração.

**O limite que ficou registrado**

O teto de tentativas de PIN é por usuário. Quem criar contas novas contorna o limite, e as
rules não conseguem manter contador por IP nem por sala sozinhas. A causa e a proposta — uma
Cloud Function que faça a conferência e mantenha os contadores — estão em `docs/BLOQUEIOS.md`.

**O que o usuário sente na prática**

- **O professor** cria a sala em três campos, vê o PIN em letra grande e copia com um clique.
  Ele dita o número para a turma uma vez, em fevereiro. Na lista de salas ele vê quantos
  entraram e quantos chamados estão abertos em cada uma. Se um aluno sair da turma, ele clica em
  remover — e o PIN é trocado no mesmo gesto, porque o aluno removido tem o número anotado no
  caderno. Em dezembro, arquiva a sala: ela vira somente leitura, e ninguém mais entra.
- **O aluno** digita o PIN uma vez. Depois disso, abre o app e clica no nome da sala — de março
  a novembro. A fila que ele vê é a da turma dele, e o chat também.
- **Os dois** continuam vendo exatamente as mesmas duas telas de antes. Nada foi repaginado: o
  que mudou foi de onde vêm os dados.

## v0.6.0 — Imagens do computador

**O que existia**

Um campo de texto e uma instrução: "Digite o URL da imagem". Funcionava — e é
regressão declarada, continua funcionando —, mas resolvia o problema de quem
**já tem** a imagem na internet.

O aluno em aula não tem. Ele aperta PrintScreen porque o erro está na tela
dele, e o que ele tem é uma captura na área de transferência ou um arquivo na
pasta de Downloads. Sem lugar para hospedar, ele acabava descrevendo o erro por
escrito — "deu erro no código" — e o professor gastava metade do atendimento
pedindo detalhe, com mais trinta e nove alunos na fila.

Havia mais duas coisas quebradas de um jeito silencioso. O ícone de olho do
card chamava `window.open(url, '_blank')`, e em boa parte dos laboratórios o
bloqueador de pop-up vem ligado por política de imagem do Windows: o aluno
clicava e **nada acontecia**. Sem aviso, sem janela, sem erro — só um clique
que não fazia nada. E uma URL externa que tivesse saído do ar virava o
quadradinho de imagem quebrada do navegador, que não explica nada a ninguém.

**A dúvida do cliente, respondida**

O pedido chegou assim: *"mudar o banco de dados pra permitir imagens, porque o
Firebase é burocrático com imagem"*.

**Não trocamos de banco, e não precisava.** A premissa está meio certa: o
**Firestore** realmente não guarda binário grande — o limite é 1 MB por
documento, e um print de tela cheia passa disso. Mas isso não é uma limitação
do Firebase. O **Firebase Storage** foi feito exatamente para isso, já estava
inicializado em `src/firebase.js` desde a primeira versão, já tem cota no mesmo
plano gratuito e já compartilha a mesma sessão de login. Havia até uma função
`uploadImage` no código, escrita durante o curso, que **nenhuma tela chamava**.

Trocar de banco custaria semanas e jogaria fora três coisas que já funcionam: o
login com Google e GitHub, as Security Rules por sala e o tempo real que faz o
card aparecer na tela do professor enquanto o aluno ainda digita. E o banco
novo teria o mesmo problema pela frente, porque guardar imagem dentro de linha
de banco é ruim em qualquer banco — a resposta certa, em qualquer stack, é um
armazenamento de objetos ao lado. O raciocínio inteiro, com as alternativas que
foram pesadas e descartadas, está no ADR 0007.

**O que foi decidido, e por quê**

- **O binário no Storage, o endereço no Firestore**, em
  `salas/{salaId}/chamados/{chamadoId}/{arquivo}`. O caminho é por sala porque
  a rule de leitura precisa poder perguntar "quem está pedindo é membro desta
  sala?" — e um caminho global não teria sala no caminho para perguntar sobre.
  O anexo passou a ser privado da turma; antes, o caminho `imagens/{arquivo}`
  era legível por qualquer pessoa logada que soubesse o nome do arquivo.
- **O nome do arquivo é sorteado, não carimbado com a hora.** O relógio das
  máquinas de laboratório está errado — foi o assunto inteiro da v0.4.0 — e uma
  turma que manda print no mesmo minuto colide. Colidir no Storage é
  sobrescrever o anexo de outra pessoa, sem ninguém perceber.
- **O tipo do arquivo é lido dos primeiros bytes, não da extensão.** Extensão e
  o `type` que o navegador declara saem os dois do **nome** do arquivo, e o
  nome é exatamente o que quem renomeia um `.exe` para `.png` controla. Um
  `.exe` renomeado é recusado sem subir byte nenhum.
- **A compressão é requisito, não otimização.** Lado maior limitado a 1600px,
  que é o que basta para ler uma mensagem de erro de compilador num print de
  tela cheia. Isso é banda da rede do laboratório e é cota do Storage — uma
  conta que a seção 8 do `ARQUITETURA.md` fecha em ~1,2 GB por ano para as dez
  salas do alvo, dentro dos 5 GB gratuitos.
- **O campo `imagem` não mudou de forma.** A versão grava os **dois**: `imagem`
  como sempre, e `anexo` em objeto ao lado. O chamado aberto em março continua
  exibindo o print dele depois do deploy, sem migração e sem janela de
  indisponibilidade. `imagem` só sai na 1.0.0.

O que foi **descartado** pelo caminho:

- **Imagem em base64 dentro do documento.** Cabe só se a imagem for pequena, e
  o pior nem é o limite: o `onSnapshot` da fila baixaria as imagens dos 200
  chamados a cada abertura do app, porque elas estariam nos documentos. A conta
  de leitura do Firestore é por documento, mas a de rede é por byte — e a rede
  é a do laboratório.
- **Um serviço externo de imagem.** Print de erro de aluno é dado da escola, e
  "quem mais pode ver isso?" precisa ter resposta. Num serviço externo a
  resposta é "quem tiver o link", e o link não expira.
- **Aceitar `image/*` na rule.** `image/svg+xml` passa por `image/*` e é um
  documento XML com `<script>` dentro. A lista é dos quatro formatos, escrita
  por extenso.
- **Recomprimir GIF.** Um canvas desenha um quadro só: o aluno subiria a
  animação e receberia de volta a imagem parada. GIF acima de 5 MB é recusado
  com uma mensagem que diz o que fazer no lugar.

**O limite que ficou registrado**

Se o upload conclui e o navegador fecha antes de o chamado ser criado, o
arquivo fica no bucket sem documento apontando para ele. É o órfão que sobrou —
o caminho normal (excluir o chamado) apaga o anexo junto. Varrer o bucket
periodicamente é trabalho de pós-1.0.0: um arquivo de ~300 KB não justifica uma
Cloud Function agora.

E a validação por magic bytes **não é antivírus**: ela garante que o arquivo
começa como imagem. Um PNG válido com dado escondido depois passa. Varredura de
conteúdo é serviço pago, e está fora do escopo declarado.

**O que o usuário sente na prática**

- **O aluno** aperta PrintScreen e cola direto no modal com Ctrl+V — sem salvar
  arquivo, sem procurar pasta. Se preferir, arrasta o arquivo para dentro do
  modal ou clica em "Escolher imagem". Vê uma barra de progresso enquanto sobe
  e pode cancelar no meio, sem fechar o modal. Se a rede do laboratório cair, a
  mensagem diz o que fazer e **o texto que ele já digitou continua lá** — não
  precisa escrever tudo de novo.
- **O professor** vê a miniatura no próprio card, e sabe de relance quais
  chamados trazem print. Clica e a imagem abre grande **na própria página**,
  inclusive nas máquinas que bloqueiam pop-up. Esc fecha.
- **Os dois** continuam podendo colar um link, como sempre. E se o link estiver
  fora do ar, aparece um aviso legível no lugar do ícone quebrado.
- **Quem tem chamado antigo** não sente nada: o print continua aparecendo. Essa
  é a parte que ninguém percebe, e é a que mais trabalho deu.

## v0.7.0 — Opções avançadas do card

**O que existia**

O modal de novo chamado tinha duas coisas: um `textarea` e um campo para colar o link de uma
imagem. A cor do card não era escolhida por ninguém — ela saía de uma linha em `TelaAluno.js`:

```js
const novaCor = `hsl(${Math.random() * 360}, 70%, 80%)`;
```

O matiz era sorteado a cada chamado. A descrição ia para a tela como texto puro, sem formatação
nenhuma.

**O problema que isso causava**

- **A cor era loteria.** Às vezes o card saía num azul claro agradável, às vezes num amarelo
  quase branco onde o texto some. Ninguém tinha escolhido aquilo e ninguém conseguia corrigir:
  não há o que ajustar num `Math.random()`. E, como o texto do card usa a cor definida no CSS,
  o contraste entre os dois nunca foi verificado — o sorteio podia cair em qualquer lugar.
- **A cor não servia para nada.** Numa fila de quarenta chamados, uma cor escolhida é um jeito
  barato de o aluno marcar o próprio card e o professor achá-lo de relance. Sorteada, ela é só
  ruído visual.
- **A descrição não tinha como se organizar.** Um erro de compilador colado no meio de uma frase
  vira uma linha ilegível. "Já tentei X, Y e Z" quer ser uma lista, e virava um parágrafo.

**O que o cliente pediu**

> "O menu de abrir um chamado é bem simples: tem a parte de escrever sobre o problema e o campo
> pra colar link de imagem. Eu queria uma setinha em cinza que, quando aberta, mostrasse opções
> de cor para o card."

O pedido é tanto sobre o que aparece quanto sobre o que **não** aparece. O aluno com pressa
precisa continuar abrindo o modal, escrevendo e enviando sem topar com opção nenhuma.

**A decisão**

1. **`<details>`/`<summary>` nativo, fechado por padrão.** Foco, Enter, Espaço, estado e o
   triângulo já vêm prontos e corretos no navegador; reimplementar isso em React só criaria a
   chance de errar em algum deles. O `aria-expanded` é declarado por cima do nativo porque o
   critério o exige nominalmente e porque `<summary>` ainda é anunciado de formas diferentes
   pelos leitores de tela em uso.

2. **Nove cores, com o contraste verificado por teste.** A paleta em `src/utils/paleta.js` traz
   cada cor com o seu par de texto, e um teste percorre a lista inteira exigindo 4,5:1 pela
   fórmula de luminância relativa do WCAG. O valor da paleta não está em ela existir — está em
   a próxima cor bonita e ilegível reprovar o CI antes de chegar à aula.

3. **A cor virou um radiogroup, não nove botões.** Nove botões soltos são nove paradas de `Tab`
   e nove anúncios de "botão" sem dizer que são alternativas da mesma escolha. Com o radiogroup,
   um `Tab` entra, as setas escolhem e um `Tab` sai.

4. **Markdown por biblioteca, sanitizado por lista de permissão.** `marked` faz o parse,
   `dompurify` tranca. A decisão inteira está no ADR 0008; o resumo é que um parser de markdown
   escrito à mão com expressões regulares é onde nascem os XSS, e que enumerar o que é perigoso
   é uma corrida que se perde — a lista diz o que **pode** existir, e o resto some.

5. **O campo `formato`.** Todo chamado gravado até a v0.6.0 é texto puro, e texto puro tem `*`,
   `_` e `#` dentro: caminhos do Windows com `*.log`, "# 12 travou". Interpretar o legado como
   markdown mudaria, sem aviso, o que está escrito num card que já está na tela de alguém.
   `formato` ausente significa "texto", e é isso que preserva o banco inteiro sem migração
   nenhuma.

**O que foi descartado**

- **Escrever o parser de markdown à mão.** Parece pequeno — quatro `replace` com expressão
  regular — e é exatamente onde nascem os XSS: basta uma ordem de substituição errada para o
  texto já escapado voltar a ser HTML.
- **Permitir links e imagens no markdown.** A imagem do chamado é o anexo, que passa por
  validação de tipo e sobe para o Storage da sala (ADR 0007). Uma `<img>` escrita na descrição
  apontaria para qualquer servidor da internet e entregaria a ele o IP de toda a turma ao
  carregar; um link traria phishing junto. Nesta versão, nenhum dos dois.
- **Mover o campo de link da imagem para dentro do painel.** Simplificaria a tela principal e
  encareceria o fluxo que mais acontece. Colar um link continua custando os mesmos cliques.
- **Guardar a cor preferida no perfil do Firestore.** Custaria uma escrita por chamado, uma
  leitura por abertura do modal e uma rule nova, para guardar uma cor. Ela ficou no
  `localStorage`; trocar de computador recomeça do zero, e recomeçar são dois cliques.
- **Interpretar o legado como markdown e aceitar o estrago.** Seria uma linha a menos de código
  e uma mudança silenciosa em chamados que já existem.

**O que o usuário sente**

- **O aluno com pressa** não sente nada: abre, escreve, envia. A setinha cinza está lá embaixo e
  não pede atenção.
- **O aluno que abre a setinha** escolhe a cor do próprio card numa paleta em que todas as
  opções são legíveis, vê a prévia do card mudando enquanto digita, e não precisa reescolher a
  cor no chamado seguinte.
- **Quem escreve o erro em três linhas** vê as três linhas. Quem cola uma mensagem de compilador
  entre crases vê a mensagem separada do resto da frase.
- **Quem usa teclado ou leitor de tela** alcança tudo: a setinha por `Tab`, o painel por `Enter`,
  as cores pelas setas, cada uma anunciada pelo nome.
- **Quem pediu menos movimento ao sistema operacional** vê o painel abrir sem animação.
- **Quem tem chamado antigo na fila** não sente nada — e essa é, de novo, a parte que ninguém
  percebe e a que mais trabalho deu.

## v0.8.0 — Chat novo e mensagens diretas

**O que existia**

O chat era a peça mais velha do app. Enquanto papel, tempo, sala e anexo foram sendo reescritos
uma task por vez, `Chat.js` continuou praticamente o arquivo do protótipo da v0.1.0 — a task 03
mudou em que coleção ele lia, e parou aí.

**Os problemas reais, e o que cada um custava**

- **`!clear` era de todo mundo.** Qualquer aluno digitava cinco letras e apagava a conversa da
  turma. E a deleção era um `forEach(async doc => deleteDoc(...))`: as chamadas saíam sem que
  nenhuma fosse aguardada, entao uma falha no meio do caminho não aparecia para ninguém. O campo
  limpava do mesmo jeito, e quem apagou ficava achando que tinha dado certo.
- **A conversa inteira era baixada, na ordem errada.** A consulta cortava em 300, mas cortava
  *crescente* — o que devolve as 300 mensagens **mais antigas** da sala. Em novembro, isso é a
  conversa de março: trezentos documentos que ninguém vai ler, pagos por cada aluno cada vez que
  a tela abria, enquanto a mensagem de agora nem cabia na janela. Pior: o `<Chat/>` ficava no
  rodapé das duas telas e assinava o listener **com o painel fechado**, o dia inteiro.
- **A cor da mensagem dependia de quem estava olhando.** `mensagem.email || usuarioEmail` — sem
  e-mail gravado na mensagem, a cor saía do e-mail do **leitor**. A mesma fala tinha uma cor em
  cada máquina do laboratório.
- **Nenhum horário na tela**, embora `horario` fosse gravado desde sempre.
- **A meia-noite apagava o banco.** Um `setTimeout` de até 24 horas chamava `deleteDoc` em cada
  mensagem. Não sobrevivia a um refresh, usava a meia-noite da máquina do aluno, e o que
  destruía não voltava.
- **Sem limite de tamanho, sem rolagem automática, sem agrupamento, sem distinção entre
  professor e aluno** — e sem nenhuma forma de conversar em particular.

**As decisões, e por quê** (detalhe no ADR 0009)

- **A autorização do `!clear` mudou de lugar, não de forma.** Ela saiu da tela e foi para a
  Firestore Rule: só o professor dono da sala deleta mensagens. A confirmação que aparece na
  interface é conforto — serve para ninguém apagar a conversa da turma por um Enter de reflexo.
  Ela **não** é a proteção. Um aluno que fale direto com o SDK, sem passar pela nossa tela,
  recebe `permission-denied`, e é esse o teste que vale.

  Vale registrar por que isso é um bom exemplo: durante sete versões o `!clear` pareceu
  protegido porque *a tela nao oferecia o comando de forma visível*. Autorização que mora no
  cliente não é autorização — é sinalização. O cliente inteiro está na mão de quem usa.
- **A janela virou decrescente, começa em 50 e só cresce a pedido.** E o painel fechado deixou
  de escutar qualquer coisa. Juntas, as duas coisas derrubam o custo de chat de uma sala de
  ~24 000 para ~2 000 leituras por dia letivo.
- **A cor sai do `autorUid`, sem fallback nenhum para o leitor**, e a luminosidade é clareada em
  passos até o contraste passar em AA — verificado contra 1000 uids sintéticos, não escolhido
  no olho.
- **A meia-noite virou filtro de exibição.** A promessa visível é a mesma de antes — *o chat
  começa limpo a cada dia* — mas cumpri-la deixou de custar o histórico da turma.
- **A conversa direta é um documento com `participantes`**, e o id sai dos dois uids ordenados.
  A rule lê o array; a listagem usa `array-contains`. Privacidade por construção, não por
  filtro de interface.

**O que foi descartado**

- **Paginar com cursor (`startAfter`).** Mais barato em muitas páginas, mas cria um segundo
  conjunto de resultados fora do `onSnapshot` — que não recebe edição nem deleção em tempo
  real — e um cursor que expira quando a mensagem-âncora é apagada pelo `!clear`.
- **Continuar apagando o chat à meia-noite**, agora com o horário certo. Resolveria o fuso e
  manteria a destruição do histórico, que era o problema maior.
- **DMs numa coleção única com `de`/`para`.** A rule precisaria de um `||` que o Firestore não
  consegue satisfazer numa listagem, e a caixa de entrada custaria duas consultas.
- **Deixar a privacidade da DM por conta do filtro de query.** É exatamente o erro que o
  `!clear` custou sete versões para ensinar.
- **Escrever um sanitizador próprio para os links do chat.** O da task 05 já existia; os links
  passaram pela **mesma** tranca, que ganhou `<a>` com `rel="noopener noreferrer"` escrito pelo
  sanitizador — não pelo texto de quem digitou.

**O que o usuário sente**

- **O aluno** vê a hora de cada mensagem, a mesma cor para a mesma pessoa em qualquer máquina,
  falas seguidas agrupadas sem repetir o nome, e quem é professor com selo. O chat abre no fim
  da conversa; se ele subiu para reler, nada o arranca de lá — aparece um botão de "novas
  mensagens". A mensagem que ele envia aparece na hora, marcada como enviando.
- **O aluno com dúvida que não quer expor para a turma** abre a aba "Diretas" e fala só com o
  professor.
- **O professor** chama um aluno em particular sem constranger ninguém, vê quantas mensagens não
  lidas tem em cada conversa, e as conversas ordenadas pela mais recente.
- **A turma** não perde mais a conversa por causa de um aluno entediado — e não perde mais o
  histórico à meia-noite: o chat continua "começando limpo" todo dia, mas o de ontem está a um
  clique.
- **Quem pediu menos movimento ao sistema operacional** vê as mensagens entrarem sem animação.
- **A escola** paga menos: o chat deixou de ser o gargalo da cota de leitura do Firebase.

## v0.9.0 — Perks

**O que existia**

Nada disso. A fila era uma coisa só — `problemasList.sort((a, b) => a.horario - b.horario)` — e o
professor não tinha instrumento nenhum de reconhecimento. Quando um aluno parava o próprio
trabalho para ajudar um colega, o que sobrava era um "valeu" no meio da aula, que ninguém além
dos dois ouvia.

**O que o cliente pediu**

> "Opção do professor dar perks aos alunos (ex.: prioridade no atendimento). Isso não é essencial
> agora, mas queria perks tipo o do Call of Duty, pra ter animações legais, e funcionaria como uma
> premiação que o professor pode dar a um aluno."

O pedido parece ser sobre animação. Não é — ele é sobre **reconhecimento público**, e a animação
é a forma que o cliente conhece de fazer reconhecimento parecer importante. Entregar a animação
sem a insígnia, a vitrine e o registro seria entregar o efeito sem o valor.

**As decisões, e o que foi descartado**

- **Quatro tipos, e só um mexe na fila.** Prioridade no Atendimento muda a ordem; Destaque,
  Colaborador e Resolvedor são reconhecimento puro. Se toda premiação furasse a fila, o professor
  não teria como elogiar quem ajudou um colega sem, de quebra, atrasar o atendimento de outra
  pessoa.
- **A ordenação virou função pura, com desempate por id do chamado.** A fila é o que o professor
  realmente usa, e uma ordem não determinística ali gera briga em sala. `ordenarFila` é testada
  com 1000 embaralhamentos da mesma lista, e produz sempre a mesma saída. **Descartado:**
  `localeCompare` no desempate — o resultado dele depende da tabela ICU do navegador, e o Chrome
  do laboratório poderia discordar do Firefox do professor sobre dois ids.
- **A validade é conferida contra um "agora" com piso no servidor.** Comparar `expiraEm` com
  `new Date()` devolveria a decisão ao relógio da máquina, que nos laboratórios está errado com
  frequência e é editável por qualquer aluno. Como o SDK do Firestore não expõe o relógio do
  servidor, o app usa o maior `Timestamp` que já viu vindo dele como piso do instante corrente.
  Atrasar o relógio não revive perk vencido; adiantá-lo só encurta o próprio.
  **Descartado:** consultar uma API pública de horário — continuaria falsificável, porque quem
  aplicaria a resposta seria o cliente.
- **Revogar é um campo, não um `delete`.** O perk sai da fila e vai para o histórico da vitrine.
  Apagá-lo reescreveria o passado da turma, e o `delete` está negado na rule por isso.
- **A premiação e o registro dela são uma escrita só** (`writeBatch`). Um log escrito *depois* do
  perk pode não ser escrito nunca — a rede do laboratório cai, a aba fecha —, e um perk sem evento
  é um privilégio sem dono declarado.
- **Uma consulta de perks por sala, nunca uma por card.** **Descartado:** resolver o perk dentro
  do card, que seria a linha mais curta de escrever e custaria 200 leituras por abertura do app
  no alvo declarado do projeto.
- **A animação nasceu com três travas**, porque o ambiente é uma sala com 40 pessoas e um
  projetor: botão de pular sempre visível (e `Esc`), card estático para quem pediu
  `prefers-reduced-motion`, e som **desligado por padrão**.

**O que ficou por resolver, e está declarado**

- **A justificativa é legível por toda a turma.** As rules do Firestore liberam ou bloqueiam o
  documento inteiro, nunca campo por campo. O "anunciar para a sala" controla o que a interface
  exibe, não o que o banco entrega — e o `docs/MANUAL-PROFESSOR.md` diz isso com todas as letras,
  para que o professor escreva a justificativa sabendo disso.
- **Dois chamados com o mesmo horário podem ter trocado de posição** em relação à v0.8.0, onde a
  ordem entre eles vinha do snapshot. É o preço do determinismo que o AC-PERK-09 exige, e a ordem
  antiga nunca foi garantida — era estável por acidente.
- **A expiração não é um evento.** Nenhum processo marca o perk como expirado no servidor; ele
  deixa de contar na leitura. A ação `"expirar"` existe na auditoria e nada a produz ainda — ela
  espera uma Cloud Function, que este projeto não tem.

**O que o usuário sente na prática**

- **O aluno premiado** abre a sala e recebe a premiação em tela cheia, com o tipo, o nível, a
  justificativa e o nome de quem concedeu — **uma vez só**, e com o botão de pular à mão desde o
  primeiro quadro. Depois disso, a insígnia fica ao lado do nome dele no card e no chat, e a
  premiação entra na vitrine "Minhas conquistas", que guarda também as que já venceram.
- **O aluno que não quer a tela cheia** desmarca uma caixa na própria sala. E quem já pediu menos
  movimento ao sistema operacional não precisa nem disso: a premiação vira um card parado, com a
  mesma informação e sem cronômetro.
- **O professor** ganha um painel acima da fila onde conceder é um gesto de dez segundos, sem
  sair da tela que ele está olhando, e onde ele revoga o que concedeu por engano.
- **A turma inteira** vê por que um chamado está acima dos outros: a insígnia aparece no card. Um
  chamado que fura a fila sem explicação parece erro do sistema — ou favorecimento.
- **A sala sem nenhuma premiação** — que é toda sala existente no dia do deploy — funciona
  exatamente como na v0.8.0. Essa é a garantia mais testada desta versão.

## v0.10.0 — Acabamento e acessibilidade

**O que existia**

Sete tasks entregaram toda a funcionalidade do produto: salas com PIN, anexo de imagem, cor e
markdown no card, chat reescrito com conversas diretas, perks. Cada uma entregou também a
animação mínima do próprio escopo — e escolheu a duração e a curva na hora.

**Os limites que apareceram com o uso**

- **Seis vocabulários de movimento.** `0.3s` no chat, `150ms` no campo de anexo, `0.45s` e `1.2s`
  na premiação, mais alguns `0.3s` crus espalhados. Nenhuma escolha estava errada sozinha; juntas,
  faziam a interface parecer montada por seis pessoas que não se falaram.
- **Quatro blocos de `prefers-reduced-motion`, e nenhum cobrindo o vizinho.** Cada folha trazia o
  próprio, cobrindo os próprios seletores. Quem pede menos movimento ao sistema operacional faz
  isso porque movimento involuntário dispara enjoo e crise vestibular — uma folha esquecida é
  alguém passando mal no meio da aula.
- **O arquivo de tokens era decoração.** A task 00 extraiu `tokens.css` dos CSS existentes e
  provou, com teste, que não tinha inventado valor nenhum. O que ela não podia fazer — a regra era
  "nenhuma mudança visual" — era trocar os literais pelos `var(--token)`. Seis versões depois,
  `#ff0000` continuava literal em seis folhas e `gray` em sete lugares do chat. Mudar
  `--cor-primaria` não mudava um pixel.
- **A identidade visual reprovava em contraste, e ninguém tinha medido.** Branco sobre `#ff0000`
  dá 4,0:1; o piso da WCAG AA para texto normal é 4,5:1. Todo rótulo de botão do aplicativo estava
  abaixo do mínimo.
- **A exclusão da própria dúvida não perguntava nada.** Um clique, e a dúvida ia embora com o
  print do erro junto. O botão fica logo abaixo do texto do card, numa fila que rola.
- **O modal de novo chamado não era um diálogo.** Uma `<div>` sobre a tela, sem papel, sem nome
  acessível, sem `Esc` e sem prisão de foco — e é o único diálogo do app que o aluno abre para
  digitar. Quem navega por teclado escrevia a dúvida e não alcançava o "Concluir".
- **Três listas, três respostas diferentes para "ainda não sei".** A fila de chamados ganhou
  esqueleto nesta mesma versão; a lista de salas e a de conversas continuavam afirmando que
  estavam vazias antes de o banco responder.

**O que foi decidido, e por quê** *(detalhes em `docs/adr/0011-sistema-de-animacoes-e-tokens.md`)*

- **Uma camada de movimento só**, em `src/styles/animacoes.css`, com um `@media
  (prefers-reduced-motion: reduce)` universal e `!important` — o único do arquivo, e deliberado:
  a preferência da pessoa precisa vencer qualquer especificidade que uma task futura invente.
  Três durações canônicas (150/220/300ms) e três curvas; o que sai da faixa tem nome próprio e
  motivo declarado, cobrado por teste.
- **Só `transform` e `opacity`.** São as duas propriedades que o navegador resolve na composição.
  Animar `height` numa fila de 200 cards recalcula a página a cada quadro — é a diferença entre a
  lista rolar e a lista travar. O teste varre as folhas e reprova quem transiciona outra coisa,
  inclusive `all`.
- **As folhas passaram a consumir os tokens**, com um teste que proíbe qualquer cor literal fora
  de `tokens.css`. Sem isso, a correção de contraste passaria no teste (que lê os tokens) e
  deixaria a tela reprovada (que lê o CSS).
- **O vermelho da marca escureceu: `#ff0000` → `#d60000`.** É a mudança visual mais perceptível
  desde a v0.1.0, e é a menos negociável. `#d60000` é o vermelho mais claro que passa em três
  pares ao mesmo tempo — branco sobre ele, ele sobre branco e ele sobre a página cinza.
  **Descartado:** texto escuro sobre o vermelho (passa na conta e vibra na tela); tratar rótulo de
  botão como "texto grande" para cair no piso de 3:1 (rótulo não tem 24px); e abrir exceção no
  critério, que seria reescrever o AC para caber na implementação.
- **A exclusão pergunta, e tem volta.** Confirmação com o foco no botão **seguro** — quem aperta
  Enter de reflexo cancela, em vez de apagar — e, depois dela, exclusão otimista: o card sai da
  fila na hora e a gravação fica adiada por cinco segundos enquanto o toast oferece "Desfazer".
  Desfazer não recria nada, porque nada chegou a sair. **Descartado:** `window.confirm()`, pela
  mesma razão de sempre — em parte dos laboratórios ele vem suprimido por política do Windows e
  devolve `false` em silêncio.
- **"Marcar como atendido" para o professor**, ao lado de excluir. É o que ele queria quando
  apagava: tirar o chamado da frente sem perder o histórico da turma.
- **Quatro pontos de corte** (480, 768, 1024, 1440), com teste que reprova quem inventar um
  quinto.

**O que a auditoria achou, e ninguém tinha visto**

- **"Carregando..." no login era branco sobre a página cinza-clara** — 1,1:1, texto literalmente
  invisível. Dura meio segundo, e é por isso que nenhuma revisão manual pegou.
- **O `:hover` do botão "Cancelar"** da confirmação escurecia o fundo mantendo o texto escuro:
  2,2:1.
- **A lista de chamados vazava por baixo da tela — exatamente na resolução do laboratório.** As
  telas de sala são uma coluna de `height: 95vh` e pediam `height: calc(100vh - 120px)` para a
  lista de dentro: duas contas sobre a mesma janela, a de dentro maior. Na 1024×768 do SENAI a
  coluna tem 730px e o conteúdo pedia 776, e o botão `+`, que é `position: fixed`, cobria o último
  card. Num monitor de 1080px a conta fecha — o defeito só aparecia na tela onde o app roda de
  verdade.

**O que ficou por resolver, e está declarado**

- **Os testes de responsividade leem o texto do CSS, não o layout.** Eles provam que a regra
  existe e está no ponto de corte combinado; não provam que um pixel caiu onde deveria. O jsdom
  não aplica folha de estilo. Medir de verdade é escopo do `test:e2e` (Playwright) na v1.0.0.
- **A tabela de pares de contraste é escrita à mão.** Extrair os pares do CSS exigiria resolver a
  cascata e a árvore do documento, e uma extração automática erraria o fundo e aprovaria o par
  errado. O guarda contra o envelhecimento dela é outro teste, não a disciplina de quem edita.
- **`jest-axe` pega cerca de um terço das barreiras reais.** O resto — ordem de tabulação, prisão
  de foco, se o rótulo faz sentido — exige julgamento e tem teste escrito à mão. Os dois lados
  somados são a auditoria; o `axe` sozinho daria uma aprovação que não significa nada.
- **O tom exato do manual de identidade da escola não foi consultado.** Se houver um, a troca é
  uma linha em `tokens.css` — desde que o tom novo passe em `contraste.test.js`.

**O que o usuário sente na prática**

- **O aluno que clica em "Excluir" por engano** vê uma pergunta com "Cancelar" já em foco, e, se
  confirmar, ainda tem cinco segundos e um botão "Desfazer" no aviso. A dúvida com o print do erro
  deixou de ser perdível num toque.
- **Quem abre o app numa rede lenta** vê cartões cinzas com a forma do que está vindo, em vez de
  ler "Você ainda não está em nenhuma sala. Peça o PIN ao professor" e sair procurando o professor
  de uma turma em que já está.
- **Quem navega por teclado** alcança tudo: o modal de novo chamado prende o foco, `Esc` fecha, e
  o foco volta para o botão que o abriu. Todo elemento interativo tem anel de foco visível.
- **Quem pediu menos movimento** ao Windows tem o app inteiro parado, e não só quatro telas.
- **O professor no laboratório** vê a fila em duas colunas, usando a largura da tela, e o último
  card deixou de ficar escondido atrás do botão `+`.
- **No celular**, o chat deixa de ser uma caixinha de 320×440 flutuando e vira painel de tela
  cheia — e o teclado virtual parou de subir por cima do campo de digitação.
- **Todo mundo** vê o mesmo vermelho, um pouco mais escuro, legível com o projetor ligado.

## v1.0.0 — Primeira versão estável

**O que existia**

Dez versões de funcionalidade, todas entregues e todas testadas: salas com PIN, fila de
chamados com horário do servidor, anexo de imagem, cor e markdown no card, chat reescrito com
conversas diretas, premiações, acabamento e acessibilidade. A suíte tinha 1609 testes
unitários e 228 de Security Rules, e estava verde.

Uma versão estável, porém, não é a soma das anteriores. É a afirmação de que **o projeto
inteiro** atende ao que foi combinado — e essa é uma afirmação que só a auditoria produz.
Esta versão começou por ela: percorrer `docs/CRITERIOS-DE-ACEITE.md` critério por critério,
localizar o teste que prova cada um e **rodá-lo**, sob uma regra dura: *um AC sem teste que o
prove conta como não atendido, ainda que a funcionalidade exista na tela*.

**O que a auditoria encontrou**

Onze critérios [MVP] entraram como ❌. Nenhum era funcionalidade faltando; quase todos eram a
mesma coisa — algo que funcionava sem que nada garantisse que continuaria funcionando. A
tabela completa está em [`AUDITORIA-1.0.0.md`](AUDITORIA-1.0.0.md); estes são os que valem ser
contados:

- **O cliente não validava o tamanho da descrição.** O servidor recusava descrição vazia ou
  acima de 1000 caracteres, mas a tela só tinha um `if (!descricao) return;`. O aluno que
  colasse um log de 4000 caracteres via o modal fechar sem erro — e o chamado não aparecer.
  Dois lugares discordando, e o aluno recebendo o silêncio.
- **O bundle estava dentro do orçamento e isso não significava nada.** 218,76 KB gzip, abaixo
  dos 300 do critério. Mas **nada media** esse número e **nada quebrava** se ele dobrasse — e
  não havia divisão por rota: um único `main.js` fazia o aluno baixar a tela do professor
  para conseguir ver o campo de e-mail.
- **FCP e carga nunca tinham sido medidos.** O teste de carga media render em jsdom com dados
  em memória, que é medir outra coisa.
- **Não havia suíte end-to-end.** Nenhum fluxo do sistema tinha prova em navegador de verdade.
- **O orçamento de tempo da suíte era por job.** `timeout-minutes: 5` em cada um dos cinco
  jobs permite 25 minutos somados, e não diz nada sobre o conjunto.
- **Nada lia o histórico de commits**, embora o AC-TEST-02 exija o ciclo red-green-refactor
  comprovado ali. E nada garantia que cada um dos onze critérios [REG] tivesse teste de
  regressão nomeado.
- **Não existia workflow de release.** Nenhum merge em `main` gerava tag, e o procedimento de
  deploy — e o de voltar atrás — não estava escrito em lugar nenhum.
- **O AC-SEC-07 não tinha prova.** Ele tem duas metades — nenhum dado além de nome e e-mail é
  coletado, e nenhum log expõe dado pessoal — e nenhuma das duas era verificada.
- **A responsividade era lida no texto do CSS.** O jsdom não aplica folha de estilo nem
  calcula posição; não existe, dentro do Jest, pixel para medir. Estava declarado como
  bloqueio B-002 desde a v0.10.0.
- **Três manuais faltando ou desatualizados.** O manual do aluno não existia — adiado pela
  v0.9.0 e de novo pela v0.10.0 —, o do professor cobria só as premiações, e o README dizia
  "Versão atual: 0.5.0" com o pacote em 0.10.0.

Duas lacunas **de servidor** apareceram junto, as duas registradas em versões anteriores com
a remissão explícita "fica para a task 09": a rule de criação de chamado aceitava `formato` e
`cor` sem olhar, e a de mensagem direta não conferia o tamanho do texto.

**O que foi decidido, e por quê**

- **Playwright contra o Emulator Suite**, sobre o **build de produção** — não o dev server,
  que serve módulos sem minificação e mediria um artefato que nunca chega ao aluno. Seis
  fluxos críticos em navegador: login com sessão restaurada, o ciclo do PIN com duas pessoas,
  abrir chamado com print e excluir com desfazer, chat da sala, mensagem direta com um
  terceiro logado sem acesso, e a 1.0.0 lendo o banco da v0.1.0.
  **Descartado:** Cypress, porque não expõe o CDP de forma direta — e é por ele que se faz o
  throttling de 3G rápida e se lê o First Contentful Paint. Detalhes no ADR 0013.
- **Divisão do bundle por rota**, com `React.lazy` nas oito telas e um `Suspense` só em volta
  de todas. O inicial caiu de 218,76 para **172,77 KB gzip**, com 13 pedaços sob demanda. E,
  mais importante que o número: `scripts/verificarOrcamentoDoBundle.js` **reprova o CI** se
  ele estourar. Um orçamento sem alarme é uma frase num documento.
  **Descartado:** dividir por biblioteca (`vendor`), que melhora o cache entre deploys e não
  reduz o primeiro carregamento; e ejetar o Create React App, que custaria a manutenção da
  configuração inteira para sempre. Detalhes no ADR 0012.
- **Varreduras que olham o código, e não uma lista escrita à mão.** É o padrão que esta versão
  repetiu em seis lugares, porque lista à mão envelhece em silêncio: todo `onSnapshot` do
  `src/` precisa ter escopo, `limit` e cancelamento; todo `dangerouslySetInnerHTML` precisa
  morar num arquivo que importe o sanitizador; toda escrita precisa ter seus campos na lista
  de dados pessoais declarados **com o motivo escrito**, e a lista não pode ter sobra; o
  orçamento de leitura é derivado dos `limit()` do fonte, e não copiado do documento.
  Cada varredura tem uma asserção que prova que ela **enxerga** — varredura que aprova o vazio
  não prova nada.
- **O ciclo red-green-refactor passou a ser lido no `git log`.** O AC-TEST-02 pede o ciclo
  comprovado no histórico; agora um teste exige que todo commit de implementação seja
  precedido por um commit de teste no mesmo escopo, e o job `commits` do CI verifica a ordem,
  não só o formato da mensagem.
- **O orçamento de tempo passou a ser da suíte inteira**: `scripts/orcamentoDaSuite.js` soma
  as três e reprova se o total passar de cinco minutos.
- **Os campos de compatibilidade ficam.** O plano previa remover `horarioIso`, a `imagem` em
  string e os `nome`/`email` duplicados nas mensagens nesta versão. **Não foram removidos** —
  ver a seção seguinte.

**As duas dúvidas do cliente, revisitadas**

As duas perguntas explícitas do cliente foram respondidas nas versões em que apareceram, e a
resposta continua de pé na 1.0.0. Vale repeti-las aqui porque são as duas decisões que mais
parecem erradas à primeira vista.

*"Por que não consultar uma API de horário de Brasília?"* — Porque **não resolveria nada**.
Quem carimbaria o documento com a resposta da API ainda seria o cliente, e o valor continuaria
falsificável, agora com mais passos. Seria também uma segunda rede para cair no meio da aula.
O `serverTimestamp()` do Firestore é atômico com a própria escrita, não depende de rede extra,
não custa cota, e — o ponto decisivo — as Security Rules **recusam** qualquer `horario` que
não seja `request.time`. A fila deixou de ser ordenável por quem adianta o relógio do Windows.
(v0.4.0, ADR 0004.)

*"Mudar o banco de dados pra permitir imagens, porque o Firebase é burocrático com imagem"* —
**Não trocamos de banco, e não precisava.** A premissa está meio certa: o *Firestore* não
guarda binário grande, porque o limite é 1 MB por documento. Mas isso não é limitação do
Firebase: o **Firebase Storage** foi feito exatamente para isso, já estava inicializado no
código desde a primeira versão, tem cota no mesmo plano gratuito e compartilha a mesma sessão
de login. Trocar de banco custaria semanas e jogaria fora o login social, as rules por sala e
o tempo real — e o banco novo teria o mesmo problema pela frente, porque guardar imagem dentro
de linha de banco é ruim em qualquer banco. (v0.6.0, ADR 0007.)

**O que ficou por resolver, e está declarado**

- **Os campos de compatibilidade não foram removidos, e isso é a decisão.** O plano da 1.0.0
  previa derrubar `horarioIso`, a `imagem` em string e os `nome`/`email` duplicados nas
  mensagens. A condição para remover era a auditoria confirmar que nenhum cliente antigo segue
  em uso — e ela **não tem como confirmar isso**: não há telemetria de versão de cliente, e um
  navegador de laboratório com a aba aberta desde antes do deploy é exatamente o cenário do
  projeto. Manter é reversível; remover não é. A remoção fica registrada para a **1.1.0**,
  depois de uma versão inteira de convivência observada.
- **Três critérios continuam 🟡**, e os três pela mesma razão: a parte automatizável está
  automatizada e o que falta é configuração de painel externo ou medição de uso real, que
  nenhum teste rodando nesta máquina produz. São a proteção de branch do GitHub (AC-CI-04), a
  lista de domínios autorizados do Firebase Auth (AC-SEC-06) e a conta de custo, que é
  estimativa derivada do código e não medição de um semestre no console (AC-PERF-06). Os três
  estão em [`BLOQUEIOS.md`](BLOQUEIOS.md) com causa e proposta.
- **`autorizados` tem leitura pública** (B-006, novo nesta versão). O cadastro consulta a
  lista antes de existir sessão, e uma rule não consegue liberar leitura a quem ainda não
  está autenticado sem liberá-la a todo mundo. A autorização em si está fechada — ninguém se
  acrescenta à lista, e a rule reconfere o papel a cada escrita. O que vaza é a lista de
  e-mails dos professores, não o poder. Fechar exige custom claim, que exige Admin SDK, que
  exige um servidor que este projeto não tem.
- **`Modal.css` continua estilizando todo botão do aplicativo** (B-005). O CSS do Create React
  App é global, e um `button { flex: 1 }` sem escopo alcança o app inteiro — foi ele que, num
  painel de 440px, deu 170px de altura ao botão "Ver dias anteriores" e 162 à conversa. A
  correção certa é escopar a regra em `.modal`, o que trocaria a aparência de todos os botões
  do sistema na véspera do release, sem teste de regressão visual que segure. Fica para a
  1.1.0; o desfazer pontual em `Chat.css` está no lugar, com teste.
- **O deploy existe no workflow e não tem credencial para rodar** (B-004). A tag é criada e o
  release é publicado; o passo de publicar o site espera um segredo que só quem administra o
  projeto pode cadastrar.

**O que o usuário sente na prática**

- **O aluno que cola um log gigante na dúvida** recebe uma frase dizendo o que está errado, em
  vez de ver o modal fechar e o chamado não aparecer.
- **A turma inteira abrindo o site ao mesmo tempo, no minuto em que a aula começa**, baixa 47
  KB a menos cada uma para chegar à tela de login — e não baixa mais a tela do professor para
  isso. Numa rede de laboratório compartilhada, o que se economiza não é o tempo de um
  download; é a contenção de quarenta downloads simultâneos no mesmo enlace.
- **Quem usa o chat numa aula inteira** vê a conversa ocupar o painel, e não três mensagens
  com um botão invisível de 170px embaixo.
- **Ninguém percebe as outras mudanças desta versão, e é esse o ponto.** Uma versão de
  estabilização que se faz notar falhou: o que ela entrega é a garantia de que o que já
  funcionava não vai parar de funcionar sem alguém ser avisado por um teste vermelho.

---

## O sistema hoje, pelos olhos de quem usa

> Esta seção fecha o documento. Ela não fala de decisão técnica nenhuma: descreve o dia de um
> aluno e o dia de um professor, do login ao fim da aula, como o sistema realmente se comporta
> na versão 1.0.0.

### O dia da Ana, aluna do 2º ano de Mecânica

**7h50, primeira aula do ano.** Ana senta na máquina 14 e abre o site. Entra com a conta do
Google — a mesma do celular, sem senha nova para decorar. A tela diz "Minhas salas" e está
vazia. O professor escreveu seis dígitos no quadro; ela clica em **Entrar com PIN**, digita, e
a sala "Mecânica 2º ano" aparece.

Isso acontece **uma vez**. Em setembro, Ana abre o site e a sala já está lá.

**8h20.** O torno trava no meio do exercício. Antes, Ana levantaria a mão e esperaria — sem
saber se o professor a viu, sem poder continuar. Agora ela aperta `PrintScreen`, clica no
botão **+**, cola o print com `Ctrl+V` e escreve o que aconteceu. Em Opções avançadas escolhe
verde, a cor que a turma combinou para "máquina parada". Conclui.

O card aparece na tela do professor **no mesmo segundo**, com o print junto. Ana volta a
trabalhar no que dá para adiantar.

**8h23.** Ela olha a fila e vê que o Bruno abriu uma dúvida parecida às 8h11, e que a
descrição dele traz uma frase que ela não tinha notado. Ela tenta, e funciona. Clica em
**Excluir** no próprio card, confirma, e o aviso "Desfazer" fica cinco segundos no rodapé — se
ela tivesse se enganado, bastava um clique. Não se enganou. O nome dela sai da fila, e o
professor vai direto para quem ainda precisa.

**9h40.** Dúvida de uma frase só, que não merece um card. Ana abre o chat da turma e pergunta.
O nome dela sai sempre na mesma cor — desde fevereiro, em toda mensagem —, e o professor tem
um selo ao lado do dele, então ninguém confunde a resposta dele com o palpite de um colega.

**10h15.** Uma tela cheia aparece: **Colaborador, nível 1**, com a justificativa do professor.
Ana aperta **Pular** — a aula está corrida — e a insígnia fica ao lado do nome dela nos cards
e no chat, e guardada em "Minhas conquistas". A animação não repete na próxima vez que ela
abrir a sala. Se incomodasse, ela poderia desligá-la de vez nas preferências; o som já nasce
desligado.

**11h30, fim da aula.** Ana clica em **Sair** — a máquina é compartilhada, e o próximo aluno
não abre o sistema no nome dela. Amanhã, na máquina 7, ela entra de novo e tudo está no lugar.

O que Ana **não** vê, e é o que mais importa: a hora do card dela é a do servidor, não a do
relógio daquela máquina — que está três horas adiantado desde a última reimagem. Sem isso, ela
teria ido para o fim da fila sem que nada parecesse errado.

### O dia do Carlos, professor de Mecânica

**Fevereiro, primeira aula.** Carlos cria a sala: nome, turma, ano letivo. O sistema mostra o
PIN de seis dígitos com um aviso claro — **ele aparece uma vez só**. Carlos copia, escreve no
quadro e anota na agenda. O sistema não guarda o número, só um resumo dele; nem ele, nem a
coordenação, nem o suporte conseguem recuperá-lo. Se perder, gera outro em um clique, e quem
já entrou continua dentro.

**Uma sala para o ano inteiro.** Não há nada a fazer no começo de cada aula.

**8h20, laboratório cheio.** Carlos abre a sala no computador da bancada. A fila está à
frente dele, em ordem de chegada, com nome, descrição e print. Ele não precisa varrer a sala
com os olhos nem interpretar quem levantou a mão primeiro — e as cores que a turma combinou
dizem, de longe, o que é máquina parada e o que é dúvida de conteúdo.

Ele atende a Ana, marca **Atendido** no card e segue. Não há caixa de diálogo perguntando se
é isso mesmo: uma confirmação a cada atendimento atrapalharia justamente a hora em que ele
está circulando pela sala.

**9h10.** Duas dúvidas iguais na fila — alguém abriu duas vezes. Carlos exclui a duplicata; a
confirmação aparece, e o Desfazer fica cinco segundos.

**10h15.** O Bruno parou o próprio exercício para desatolar a colega ao lado. Carlos abre o
painel **Premiações**, escolhe Colaborador, nível 1, sete dias, e escreve uma justificativa
curta. Ele sabe — porque o manual diz isso na primeira página da seção — que **a turma
consegue ler a justificativa**, e escreve como se fosse lida. O que for reservado vai pelo
canal que a escola já usa.

**10h40.** O chat descarrilha em memes. Carlos apaga as mensagens e segue; se fosse o caso,
`!clear` limparia a conversa inteira — e só funciona para ele.

**10h50.** Precisa avisar uma aluna sobre a entrega atrasada, e isso não é da turma. Ele abre
uma **conversa direta**. Ninguém mais lê aquilo — nem outro professor, nem outro aluno. O
contrário também vale, e é deliberado: a conversa direta entre dois alunos da sala dele não é
acessível a ele.

**Novembro, última aula.** Carlos **arquiva** a sala. Ela vira somente leitura: ninguém entra
mais com o PIN, ninguém abre dúvida nova, e **tudo o que houve continua visível** — a fila do
ano, o chat, as conquistas de cada aluno. Em fevereiro ele cria a sala da turma nova, que
começa vazia, sem herdar a fila do ano anterior.

O que Carlos **não** vê: um aluno tentou entrar na sala da outra turma chutando PINs, e parou
na quinta tentativa. Outro trocou o próprio tipo para "professor" no navegador e o servidor
recusou a escrita. Nenhuma das duas coisas chegou até ele, e é assim que deveria ser.
