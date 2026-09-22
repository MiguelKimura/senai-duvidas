# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui, no formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versões seguindo
[SemVer](https://semver.org/lang/pt-BR/).

> As seções de versão **não são escritas à mão** (AC-CI-09). Elas saem de
> `npm run changelog -- <base>..<head>`, que lê os assuntos dos commits convencionais do
> intervalo e os agrupa. Escrever à mão é escrever de memória no fim do trabalho, e o que
> fica de fora é justamente o que ninguém lembrou.

> node scripts/gerarChangelog.js 33f1c01..HEAD --versao 0.8.0 --data 2026-09-22

## [0.8.0] - 2026-09-22

### Adicionado

- **chat:** deriva a cor da mensagem so da semente, nunca do leitor
- **chat:** clareia a cor ate o texto se ler, e para no primeiro tom aprovado
- **chat:** poe o !clear atras do papel de professor e apaga em lote aguardado
- **chat:** escuta a conversa em janela decrescente de 50, com paginacao
- **chat:** acrescenta <a> a MESMA tranca, com rel escrito pelo sanitizador
- **chat:** mostra horario, cor estavel, selo e estado de envio no balao
- **chat:** rola sozinho para o fim, exceto para quem subiu ler o historico
- **chat:** agrupa falas seguidas do mesmo autor e oferece as anteriores
- **chat:** conta os 500 caracteres, quebra linha com Shift+Enter e nao perde texto
- **chat:** faz o fake ler campo dentro de mapa, como orderBy e where fazem
- **chat:** poe a privacidade da DM e o !clear no servidor
- **chat:** entrega a aba de diretas, com lista, contador e conversa aberta
- **chat:** monta as abas, pergunta antes do !clear e filtra o dia em vez de apagar
- **chat:** liga as telas ao chat novo e aposenta o Chat.js da v0.7.0
- **chat:** veste o chat novo e faz a mensagem entrar sem incomodar quem pediu calma

### Alterado

- **chat:** prova que a cor da mensagem nao pode depender de quem le
- **chat:** exige contraste AA verificado, e nao luminosidade escolhida no olho
- **chat:** exige papel, lote e relato de falha no !clear, e limite de 500
- **chat:** exige janela de 50 mensagens recentes e paginacao para tras
- **chat:** exige link clicavel no chat sem abrir o card do chamado
- **chat:** exige horario, selo, agrupamento e estado de envio no balao
- **chat:** alcanca os baloes pelo document, como o resto da suite faz
- **chat:** exige rolagem que acompanha sem arrancar quem esta relendo
- **chat:** exige agrupamento por autor e tempo, e o botao de anteriores
- **chat:** exige contador de 500, Shift+Enter e texto preservado na falha
- **chat:** fixa o modelo das conversas diretas e pega o unico furo que restou
- **chat:** exige que a privacidade da DM seja do servidor, nao da interface
- **chat:** fixa o fluxo inteiro da conversa direta, do contato ao contador
- **chat:** exige abas, !clear com confirmacao e meia-noite que nao destroi
- **chat:** exige estilo para o chat novo e animacao que some com movimento reduzido

> node scripts/gerarChangelog.js a95c1b7..HEAD --versao 0.7.0 --data 2026-09-21

## [0.7.0] - 2026-09-21

### Adicionado

- **chamados:** dá ao card uma paleta com contraste verificado
- **chamados:** renderiza markdown basico com lista de permissao
- **chamados:** rende a descricao conforme o formato gravado nela
- **chamados:** oferece a paleta como radiogroup com tabindex rotativo
- **chamados:** esconde cor e markdown atras de uma setinha cinza
- **chamados:** lembra a ultima cor escolhida, validando os dois lados
- **chamados:** liga o painel avancado ao modal, abaixo do anexo
- **chamados:** grava a cor escolhida e rende markdown nos dois cards

### Alterado

- **chamados:** exige paleta verificada por contraste no lugar do sorteio
- **chamados:** exige markdown basico e a lista de vetores de XSS
- **chamados:** monta o esquema executavel em pedacos no teste de XSS
- **chamados:** exige um lugar so que decide como a descricao vira pixel
- **chamados:** exige radiogroup navegavel por setas na paleta
- **chamados:** exige a setinha cinza fechada por padrao, com previa
- **chamados:** alcanca o DOM pelo documento, e nao pelo container
- **chamados:** exige lembrar a cor e desconfiar do que volta do storage
- **chamados:** exige o painel abaixo do anexo, com previa e cor lembrada
- **chamados:** passa os testes novos pelo prettier do projeto
- **chamados:** exige cor e markdown nos dois cards, sem tocar no legado
- **chamados:** prova a compatibilidade futura do campo formato

### Corrigido

- **chamados:** escreve o caminho do Windows como caminho do Windows no teste

> node scripts/gerarChangelog.js origin/dev..HEAD --versao 0.6.0 --data 2026-09-21

## [0.6.0] - 2026-09-21

### Adicionado

- **anexos:** valida o tipo do anexo pelos magic bytes do conteudo
- **anexos:** recusa arquivo acima de 5 MB e nomeia o formato pelo conteudo
- **anexos:** reduz a imagem a 1600px no cliente antes de subir
- **anexos:** sobe o anexo para a pasta da sala, com progresso e cancelamento
- **anexos:** le os dois formatos do campo imagem e apaga anexo sem orfao
- **anexos:** abre o anexo em lightbox acessivel, sem window.open
- **anexos:** anexa a imagem colada com Ctrl+V no modal
- **anexos:** entrega o campo com seletor, arrastar, colar e barra de progresso
- **anexos:** organiza o modal em secoes e reserva o id do chamado
- **anexos:** mostra miniatura e lightbox no card e apaga o anexo com o chamado
- **anexos:** aposenta uploadImage e deixa firebase.js so configurando o SDK
- **anexos:** fecha o Storage por membro da sala, com teto e formato
- **anexos:** oferece upload so onde ele tem para onde ir
- **anexos:** preenche anexo a partir do imagem antigo, sem tocar no original

### Alterado

- **anexos:** exige que o tipo do anexo venha do conteudo, nao da extensao
- **anexos:** exige os quatro formatos, a extensao real e o teto de 5 MB
- **anexos:** exige reducao para 1600px preservando a proporcao
- **anexos:** exige upload escopado por sala, com progresso e cancelamento
- **anexos:** exige leitura dupla do campo imagem e exclusao sem orfaos
- **anexos:** exige lightbox acessivel no lugar do window.open
- **anexos:** exige colar a captura de tela direto no modal
- **anexos:** exige as tres entradas de imagem no campo de anexo do modal
- **anexos:** exige o modal em secoes e o id do chamado reservado na abertura
- **anexos:** exige miniatura, lightbox e exclusao de anexo no card
- **anexos:** exige que excluir um chamado nao varra o caminho legado
- **anexos:** exige a aposentadoria do uploadImage orfao de firebase.js
- **anexos:** exige rules de Storage por membro, com teto e formato no servidor
- **anexos:** exige que o upload so apareca dentro de uma sala
- **anexos:** exige a migracao opcional que preenche anexo sem tocar em imagem

> node scripts/gerarChangelog.js origin/dev..HEAD --versao 0.5.0 --data 2026-09-21

## [0.5.0] - 2026-09-21

### Adicionado

- **salas:** gera o PIN de 6 dígitos com Web Crypto e o resume com sal por sala
- **salas:** ensina o fake de Firestore a filtrar, paginar e recusar escrita
- **salas:** cria a sala com PIN sorteado, resumido e único entre as ativas
- **salas:** entra na sala pelo PIN, com recusa genérica e tentativa contada
- **salas:** regera PIN, remove aluno, arquiva a sala e lista as salas de cada um
- **rules:** endurece o banco por caminho e escopa chamados e chat por sala
- **salas:** monta a tela de criação com o PIN em destaque e cópia num clique
- **salas:** monta a tela de entrada por PIN, sem ramo que denuncie a sala
- **salas:** lista as salas de cada um, com contagens só para o dono
- **salas:** prende chamados e chat à sala, com teto e fallback para o legado
- **salas:** abre a sala pelo vínculo e dá ao dono o painel da turma
- **salas:** põe as quatro rotas de sala no mapa, ao lado das duas antigas
- **migracao:** copia o acervo global para a Turma Geral, sem apagar nada

### Alterado

- **salas:** exige PIN de 6 dígitos sorteado por Web Crypto e resumido com sal
- **lint:** declara globalThis, que o preset react-app ainda não conhece
- **salas:** exige where, limit e recusa de escrita do fake de Firestore
- **salas:** exige sala criada com PIN único e sem o PIN em claro no banco
- **salas:** exige entrada por PIN com erro genérico e limite de tentativas
- **salas:** exige regeração de PIN, remoção de aluno, arquivamento e lista paginada
- **salas:** exige a tela de criação com PIN em destaque e cópia num clique
- **salas:** nomeia o retorno de render como o lint do projeto exige
- **salas:** exige entrada por PIN com recusa que não revela nada
- **salas:** exige a lista de salas com contagens, PIN novo e arquivamento
- **salas:** exige chamados e chat presos à sala, com fallback para o legado
- **salas:** exige que a porta da sala decida pelo vínculo, não pelo papel global
- **salas:** exige as quatro rotas novas sem aposentar as duas antigas
- **migracao:** exige migração idempotente, reversível e não destrutiva

### Descontinuado

- **salas:** as coleções globais `chamados` e `chat` continuam existindo e continuam sendo
  lidas quando a pessoa não está em sala nenhuma — é o **fallback de leitura** que impede a
  tela vazia no meio da migração. Elas, as rotas `/aluno` e `/professor` e o campo `nome`
  dos documentos (hoje gravado junto com `autorNome`) saem na **1.0.0**.

### Segurança

- **BREAKING (dado, não API)** **salas:** `chamados` e `chat` passam a viver em
  `salas/{salaId}/...`. Um aluno da sala A não lê nem escreve nada da sala B, e isso é
  provado por teste de rules em `tests/rules/salas.rules.test.js`, caminho a caminho, com o
  par concedido/negado.
- **salas:** o PIN **nunca** é gravado em claro. O documento da sala não tem segredo nenhum;
  o resumo SHA-256 e o sal moram em `salas/{salaId}/segredo/pin`, que só o dono lê. O
  professor vê o número uma vez, na criação ou na regeração (AC-SEC-05).
- **salas:** `indicePins/{pin}` permite apenas `get` de documento específico, nunca `list`:
  varrer o índice para descobrir PINs válidos é impossível pela rule, não por obscuridade.
- **salas:** tentativas de PIN limitadas a 5 em 5 minutos por usuário, com a janela validada
  pelo servidor (AC-SALA-12).
- **rules:** o banco passa a negar tudo por padrão e a liberar caminho a caminho (AC-SEC-01).

> node scripts/gerarChangelog.js origin/dev..HEAD --versao 0.4.0 --data 2026-09-20

## [0.4.0] - 2026-09-20

### Adicionado

- **tempo:** implementa paraData com leitura dupla de Timestamp e string ISO
- **tempo:** exibe data e hora no fuso de Brasília com Intl
- **tempo:** implementa formatarRelativo com corte em uma hora
- **tempo:** implementa comparar e o comparador componível da fila
- **tempo:** ensina o fake de Firestore as duas fases do serverTimestamp
- **tempo:** grava o horário com serverTimestamp em chamados e mensagens
- **tempo:** usa a meia-noite de Brasília no reset do chat
- **tempo:** nega no servidor todo horario que não venha de serverTimestamp
- **tempo:** migra horarioIso nos documentos que o autor não vai reabrir

### Alterado

- **tempo:** exige leitura dupla de horario em paraData
- **tempo:** exige exibição em America/Sao_Paulo no formato brasileiro
- **tempo:** exige rótulo relativo para evento recente e absoluto acima de 1h
- **tempo:** exige ordem por horário com pendente no fim e critério componível
- **tempo:** exige as duas fases do serverTimestamp no fake de Firestore
- **tempo:** inverte a caracterização do relógio do cliente para o do servidor
- **tempo:** prova que mexer no relógio da máquina não move a fila
- **tempo:** exige "enviando…" no card enquanto o servidor não carimba
- **tempo:** exige a meia-noite de Brasília no reset do chat
- **tempo:** exige que o servidor recuse horario que não seja request.time
- **tempo:** exige a migração idempotente de horarioIso
- **tempo:** prova a leitura do horario pelos dois formatos, nos dois sentidos

### Descontinuado

- **tempo:** `horarioIso` nasce já com data de morte marcada: é a ponte para o cliente que
  ainda lê `horario` com `new Date()` e será removido na **1.0.0**, quando não houver mais
  versão anterior em sala. Até lá, `scripts/migrar-horarios.js --dry-run` mostra quantos
  documentos ainda dependem dele.

### Corrigido

- **BREAKING (dado, não API)** **tempo:** `horario` deixa de ser a string ISO do relógio do
  aluno e passa a ser o `Timestamp` que o **servidor** carimba. Era assim que um relógio
  adiantado furava a fila — de propósito ou sem querer — e um atrasado nunca era atendido.
  A leitura aceita os dois formatos, permanentemente nesta versão; as Firestore Rules
  passam a **negar** qualquer `horario` que não seja `request.time`.

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
