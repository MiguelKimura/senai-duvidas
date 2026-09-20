# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui, no formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versões seguindo
[SemVer](https://semver.org/lang/pt-BR/).

> As seções de versão **não são escritas à mão** (AC-CI-09). Elas saem de
> `npm run changelog -- <base>..<head>`, que lê os assuntos dos commits convencionais do
> intervalo e os agrupa. Escrever à mão é escrever de memória no fim do trabalho, e o que
> fica de fora é justamente o que ninguém lembrou.

> node scripts/gerarChangelog.js origin/dev..HEAD --versao 0.3.0 --data 2026-09-20

## [0.3.0] - 2026-09-20

### Adicionado

- **auth:** traduz os erros do Firebase para português sem vazar o código
- **auth:** cria usuarios/{uid} no primeiro acesso, sempre como aluno
- **auth:** resolve o papel exigindo usuarios e autorizados de acordo
- **auth:** isola o Firebase Auth em services/auth.js com persistência local
- **auth:** implementa o provider único com papel resolvido pelo Firestore
- **auth:** adiciona RotaProtegida com os quatro estados de acesso
- **auth:** liga os botões de Google e GitHub e mostra o erro no formulário
- **auth:** reduz o App a roteamento e apaga as duas autenticações restantes
- **sessao:** adiciona o botão Sair nas telas do aluno e do professor
- **auth:** grava criadoEm e provedor no cadastro por e-mail e senha
- **auth:** liga o cadastro ao tradutor único e tira o alert
- **auth:** leva a regra do papel para o servidor com ehAutenticado e ehProfessor
- **auth:** nega a exclusão de usuarios/{uid} pelo cliente
- **seguranca:** força https fora do localhost e documenta os domínios autorizados

### Alterado

- **auth:** exige mensagem em português para todo erro do Firebase
- **auth:** exige documento de usuário no primeiro login social
- **auth:** exige concordância entre usuarios e autorizados para ser professor
- **auth:** exige persistência local configurada antes de qualquer login
- **auth:** descreve o provider único que substitui as três autenticações
- **auth:** exige estado de carregamento explícito na rota protegida
- **auth:** reescreve a caracterização do login para o desenho da task 01
- **auth:** inverte a caracterização do App, do contexto órfão e do firebase.js
- **sessao:** exige botão Sair em toda tela autenticada
- **auth:** inverte a lacuna do criadoEm registrada pela task 00
- **auth:** exige tradutor único e nenhum alert também no cadastro
- **auth:** proíbe e-mail e documento de autorizados no console
- **auth:** exige dono e autorizacao no servidor para usuarios/{uid}
- **auth:** exige que ninguém apague usuarios/{uid} pelo cliente
- **auth:** prova que criadoEm e provedor são campos aditivos
- **seguranca:** exige redirecionamento para https fora do localhost
- **seguranca:** exige que index.js chame o guarda antes de montar

### Corrigido

- **auth:** tira e-mail e documento de autorizados do console

### Segurança

- **BREAKING** **auth:** o papel do usuário deixa de ser lido do `localStorage` e passa a vir
  exclusivamente do Firestore (`usuarios/{uid}.tipo` **e** `autorizados/{email}.Tipo`, que
  precisam concordar). Quem escrevia `tipoUsuario` no navegador para abrir a tela do professor
  deixa de conseguir. Nenhum dado precisa ser migrado: a chave antiga é apagada no logout e
  ignorada na leitura.
- **auth:** as Firestore Rules de `usuarios/{uid}` deixam de ser `if true`. Só o dono escreve o
  próprio documento, só vira professor quem está em `autorizados`, a leitura exige sessão e a
  exclusão pelo cliente é negada.
- **seguranca:** o app redireciona HTTP para HTTPS fora de `localhost`.
- **auth:** `verificarPermissao` para de registrar e-mail e documento de `autorizados` no console.

### Problemas conhecidos desta versão

- `chamados` e `chat` continuam como coleções globais e com rules abertas. Endurecê-las agora
  quebraria o app; é a task 03, que reusa as funções `ehAutenticado()` e `ehProfessor()`
  introduzidas aqui.
- A lista de domínios autorizados do Firebase Auth é configuração de console e **precisa ser
  aplicada à mão** — veja `docs/DOMINIOS-AUTORIZADOS.md`. Por isso o AC-SEC-06 fica 🟡.

## [0.2.0] - 2026-09-20

### Adicionado

- **infra:** implementa fábricas, relógio determinístico e render com provedores
- **infra:** adiciona fakes em memória de firestore, auth, app e storage
- **config:** le a config do firebase do ambiente e avisa no fallback
- **rules:** versiona o baseline das security rules do estado atual
- **estilos:** extrai os tokens de design dos CSS existentes
- **changelog:** gera a seção da versão a partir dos commits convencionais

### Alterado

- **infra:** estabelece o harness mínimo de jest e react testing library
- **infra:** descreve o contrato dos helpers de teste antes de implementá-los
- **infra:** especifica o fake de firestore e de auth usado pela suíte unitária
- **auth:** caracteriza o login por e-mail e senha
- **auth:** caracteriza o cadastro e o portão de permissão de professor
- **chamados:** caracteriza a tela do aluno e fixa as falhas da v0.1.0
- **chamados:** caracteriza a tela do professor e seu poder irrestrito
- **chat:** caracteriza o chat e faz o jsdom preservar hsl
- **testes:** troca toHaveStyle vacuoso por corDeFundo nos cards
- **config:** especifica a config do firebase por REACT_APP_ com fallback
- **auth:** caracteriza o roteamento e o papel vindo do localStorage
- **infra:** cobre os helpers do firebase, o AuthContext orfao e o rodape
- **testes:** exige 80% de linhas e 75% de branches para o build passar
- **lint:** configura eslint com jsx-a11y e prettier, zero warnings
- **rules:** descreve o estado inseguro das rules antes de versioná-las
- **infra:** fixa as portas do firebase emulator suite
- **estilos:** exige que os tokens sejam extração, não redesenho
- **ci:** amarra os nomes dos jobs aos checks da proteção de branch
- **infra:** adiciona o pipeline lint, test, rules e build no github actions
- **changelog:** descreve a geração do changelog a partir dos commits

### Corrigido

- **lint:** declara es2021 no override dos testes de rules

## [0.1.0] - 2026-03-01

Protótipo funcional, escrito antes de existir teste, lint ou CI. Registrado aqui de forma
retroativa para que o `[0.2.0]` tenha de onde partir — a v0.1.0 nunca foi versionada com
changelog.

### Adicionado

- **auth:** cadastro e login por e-mail e senha, com o papel (`aluno`/`professor`) lido do
  documento `usuarios/{uid}` e guardado no `localStorage`
- **auth:** validação de professor contra a coleção `autorizados/{email}`
- **chamados:** tela do aluno com fila de dúvidas em tempo real, criação por modal e
  exclusão do próprio chamado
- **chamados:** tela do professor, com poder de excluir qualquer chamado
- **chamados:** cor de fundo do card derivada do e-mail do autor, estável entre sessões
- **img:** anexo de imagem por URL, com ícone de visualização no card
- **chat:** chat global da turma, com cor de balão por e-mail e o comando `!clear`
- **infra:** integração com Firebase (Auth, Firestore e Storage) e deploy na Vercel

### Problemas conhecidos desta versão

Nenhum foi corrigido na 0.2.0 — todos estão **fixados em testes de caracterização**, para que
as tasks 01 a 09 os mudem de forma consciente e comprovada:

- o papel do usuário vem do `localStorage`, então trocá-lo no navegador vira acesso de
  professor (falha de segurança — task 02)
- `horario` é `new Date().toISOString()` do relógio do cliente, que nos laboratórios está
  frequentemente errado (task 05)
- `chamados` e `chat` são coleções globais, sem escopo de sala: toda turma divide a mesma
  fila e a mesma conversa (tasks 01 e 06)
- `!clear` apaga o chat inteiro para qualquer usuário (task 06)
- a config do Firebase estava fixa no código-fonte (corrigido na 0.2.0)
- `onSnapshot` sem `where` nem `limit` em coleção inteira (task 07)

[0.3.0]: https://github.com/MiguelKimura/senai-duvidas/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/MiguelKimura/senai-duvidas/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MiguelKimura/senai-duvidas/releases/tag/v0.1.0
