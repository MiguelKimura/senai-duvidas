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

*(a preencher pela task 06)*

## v0.9.0 — Perks

*(a preencher pela task 07)*

## v0.10.0 — Acabamento e acessibilidade

*(a preencher pela task 08)*

## v1.0.0 — Primeira versão estável

*(a preencher pela task 09, incluindo a seção "O sistema hoje, pelos olhos de quem usa")*
