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

*(a preencher pela task 02)*

## v0.5.0 — Salas com PIN

*(a preencher pela task 03)*

## v0.6.0 — Imagens do computador

*(a preencher pela task 04)*

## v0.7.0 — Opções avançadas do card

*(a preencher pela task 05)*

## v0.8.0 — Chat novo e mensagens diretas

*(a preencher pela task 06)*

## v0.9.0 — Perks

*(a preencher pela task 07)*

## v0.10.0 — Acabamento e acessibilidade

*(a preencher pela task 08)*

## v1.0.0 — Primeira versão estável

*(a preencher pela task 09, incluindo a seção "O sistema hoje, pelos olhos de quem usa")*
