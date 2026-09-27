# Bloqueios conhecidos

> Limites técnicos que uma task encontrou, não conseguiu resolver dentro do
> escopo dela, e resolveu da melhor forma possível — com a causa e a proposta
> escritas aqui, em vez de silenciosamente reduzidas.
>
> Uma entrada só sai daqui quando a task que a fecha entrega o teste que prova
> que ela foi fechada.

---

## B-001 — O limite de tentativas de PIN é por usuário, não por origem

- **Versão:** 0.5.0 (task 03)
- **Critério afetado:** AC-SALA-12
- **Estado:** implementado com a alternativa mais segura possível no modelo atual

### O limite

`tentativasPin/{uid}` guarda o contador e a janela, e a rule valida as duas
coisas com o relógio do servidor: 5 tentativas em 5 minutos, e a janela só
reinicia depois de vencida. Isso **funciona** contra o cenário real de sala de
aula — o aluno que tenta adivinhar o PIN da turma do colega —, e funciona
porque a contagem e o tempo são do servidor, não do cliente.

O que ele não cobre: **um atacante que crie contas novas**. Cada conta ganha a
própria janela de cinco tentativas. Com cadastro aberto por Google, criar
contas é barato, e um milhão de combinações dividido por cinco são 200 mil
contas — inviável na mão, viável com script.

### Por que não foi resolvido nesta task

As Security Rules não conseguem manter um contador por IP nem por sala:

1. **Não há acesso ao IP.** `request` não expõe origem. Não existe expressão de
   rule que diga "esta requisição veio da mesma máquina da anterior".
2. **Um contador por sala seria escrito por quem ataca.** Para contar as
   tentativas de uma sala, o documento do contador precisaria ser gravável por
   qualquer um que tente entrar — inclusive para zerá-lo. Quem pode somar 1
   pode gravar 0.
3. **Rules não têm estado próprio.** Elas leem e validam documentos; não
   mantêm nada por conta.

### O que foi feito, então

- Contador por usuário, com janela validada pelo servidor (o que **é**
  possível em rules, e é a maior parte da defesa real).
- Leitura do índice de PINs amarrada a uma tentativa recém-contada
  (`pinTentado` + `ultimaTentativaEm`): sem a amarra, dava para consultar o
  índice sem nunca contar tentativa, e o contador seria decoração.
- `indicePins` sem `list`: não há como varrer o índice; é preciso já saber o
  número para perguntar por ele.
- Regeração de PIN em um clique, para o professor fechar a porta quando
  desconfiar.

### Proposta para fechar

Uma **Cloud Function** `entrarComPin(pin)` que:

1. Faça a conferência do resumo no servidor, como a rule faz hoje.
2. Mantenha um contador por **sala** e outro por **IP de origem** — ambos em
   documentos que só a Function escreve, o que resolve o item 2 acima.
3. Aplique atraso progressivo (100 ms, 200 ms, 400 ms…) por origem, tornando a
   varredura cara mesmo com muitas contas.
4. Devolva a mesma mensagem genérica de hoje, para não virar oráculo.

O modelo já está desenhado para essa troca: quem confere o PIN **já é o
servidor**, e o cliente já não lê o segredo. Migrar significa mover a
conferência da rule para a Function e apertar a rule de `membros` para aceitar
apenas escrita vinda dela. Nenhum dado muda de forma.

**Custo de não fazer agora:** o ataque exige criar centenas de milhares de
contas para varrer o espaço, e produz um rastro visível no console do Firebase
Auth. Para o uso previsto — dez salas, um semestre —, o risco aceito é
consciente, e a mitigação operacional é o professor regerar o PIN.

---

## B-002 — A responsividade é provada no texto do CSS, não no pixel

- **Versão:** 0.10.0 (task 08)
- **Critério afetado:** AC-ANIM-08
- **Estado:** **FECHADO na v1.0.0** por `tests/e2e/layout.spec.js`

> **Como foi fechado.** A proposta desta entrada era exatamente `npm run test:e2e`
> num navegador com layout real, e é o que a v1.0.0 entregou.
> `tests/e2e/layout.spec.js` abre as duas resoluções que importam — 1024×768 e
> 360×640 —, afirma `scrollWidth <= clientWidth` em cada tela, e compara os
> retângulos do último card e do botão flutuante. Foi ele que pegou o defeito do
> painel de chat descrito em B-005, que nenhuma leitura de CSS pegaria.
>
> Continua **em aberto** o item 4 da proposta original: a imagem de referência por
> viewport, para regressão visual. Ela não é exigida por critério nenhum, e a falta
> dela é o que torna B-005 caro de fechar. O texto abaixo fica como registro do que
> o limite era e de por que ele existia.

### O limite

`src/styles/__tests__/responsividade.test.js` lê as folhas de estilo **como
texto**. Ele prova que a regra que evita o problema existe, que ela está no
ponto de corte combinado, e que ninguém inventou um quinto ponto de corte no
caminho. O que ele não prova é que um pixel caiu onde deveria.

A razão é do ambiente, não de preguiça: o jsdom não aplica folha de estilo nem
calcula layout. `getComputedStyle` ali devolve o valor declarado inline, não o
resultado da cascata — não existe, dentro do Jest, largura de elemento para
medir. Um teste que afirmasse "o card cabe em 360px" estaria afirmando algo que
o ambiente não tem como saber, e um teste que aprova o que não mediu é pior do
que nenhum.

### O que ficou provado, então

- Nenhuma folha inventa um ponto de corte fora dos quatro combinados (480,
  768, 1024, 1440);
- o chat vira painel de tela cheia abaixo de 768px;
- o diálogo ocupa a tela inteira abaixo de 480px;
- nenhuma largura fixa passa de 360px, que é o compromisso de não haver
  rolagem lateral;
- as duas telas de sala deixaram de se dimensionar por `calc(100vh - 120px)`
  dentro de uma coluna de `height: 95vh`.

Esse último item é o argumento de que o teste vale apesar do limite: **foi ele
que pegou o defeito**. Duas contas sobre a mesma janela, a de dentro maior —
na 1024×768 do laboratório a coluna tem 730px e o conteúdo pedia 776. A lista
vazava por baixo e o botão `+`, que é `position: fixed`, cobria o último card.
Num monitor de 1080px a conta fecha, e é por isso que ninguém nunca tinha visto
o defeito: ele só aparece exatamente na tela onde o app roda de verdade.

### Proposta para fechar

`npm run test:e2e` (Playwright), previsto para a v1.0.0, roda num navegador com
layout real. Fechar este item é um arquivo de teste que, para cada um dos dois
tamanhos que importam:

1. abre a página no viewport exato (1024×768 e 360×640);
2. afirma `document.documentElement.scrollWidth <= clientWidth` — a ausência de
   rolagem lateral, que é o defeito de celular;
3. afirma que o último card da fila não fica coberto pelo botão flutuante,
   comparando os dois retângulos — o defeito de laboratório;
4. tira uma imagem de referência por viewport, para a regressão visual.

Nada no código precisa mudar para isso acontecer: o que falta é o navegador,
não a folha de estilo.

**Custo de não fazer agora:** uma regressão de layout que não passe por
nenhuma das regras guardadas acima entra sem ser vista, e só aparece quando
alguém abrir o app na tela do laboratório. A mitigação até lá é a conferência
manual nas duas resoluções antes do release.

---

## B-003 — Dez turmas em aula no mesmo dia não cabem na cota gratuita de leitura

- **Versão:** 1.0.0 (task 09)
- **Critério afetado:** AC-PERF-06
- **Estado:** medido, documentado e projetado; o teto do plano gratuito não é
  atingido no alvo declarado

### O limite

A conta está em `docs/ARQUITETURA.md` § 5 e é derivada dos `limit()` que o código
usa de verdade — `src/__tests__/orcamentoDeLeitura.test.js` refaz a aritmética e
confere o documento contra ela.

O número: uma abertura de tela numa sala de novembro, com a fila no alvo de 200
chamados, custa **296 leituras**. Quarenta alunos abrindo duas vezes por aula são
80 aberturas por turma, ou 23 680 leituras por turma por dia letivo. A cota do
plano Spark é de **50 000 leituras por dia**.

| Turmas em aula no mesmo dia | Novembro (fila cheia) |
|---|---|
| 2 | 47 360 ✅ |
| 3 | 71 040 ❌ |
| 10 | 236 800 ❌ |

Em março, com a fila curta, a mesma conta dá 74 leituras por abertura e caberiam
oito turmas. **A capacidade não é um número: ela é função do tamanho da fila, e a
fila cresce o ano letivo inteiro.**

O termo que domina é sempre o mesmo: a fila de chamados, com 200 de 296 leituras.

### Por que não foi resolvido nesta task

A correção é conhecida e é a mesma que a v0.8.0 aplicou ao chat: trocar o
`limit(200)` fixo por uma **janela decrescente e crescente sob demanda**, como
`hooks/useMensagens` faz. Não foi feita aqui por três razões, e nenhuma delas é
de esforço:

1. **A fila é crescente por requisito.** O AC-CHAMADO-03 pede o mais antigo
   primeiro. Uma janela decrescente entrega os 30 mais **recentes** — que é o fim
   da fila, não o começo. Inverter isso muda a ordem da tela que a turma usa para
   ser atendida, e essa é a tela que não pode mudar de véspera de release.
2. **O `orderBy` do Firestore ordena por tipo antes de valor.** Os chamados da
   v0.1.0 têm `horario` em string ISO e os novos têm `Timestamp`; uma janela
   ordenada pelo servidor separaria os dois grupos em vez de intercalá-los, e é
   exatamente por isso que hoje a ordenação é feita no cliente, por
   `criarComparadorPorHorario`. Paginar pelo servidor exige a migração de
   `horario` concluída em todos os documentos.
3. **A paginação da tela já existe e não resolve.** `FilaDeChamados` mostra 30
   cards por vez (`CHAMADOS_POR_PAGINA`), mas o **listener** traz 200. Reduzir a
   leitura é mudar o listener, não a tela.

### Proposta para fechar (1.1.0)

1. Rodar `scripts/migrar-horarios.js` em produção até `horarioIso` não ser mais
   necessário e todo `horario` ser `Timestamp` — o script já existe, é idempotente
   e reversível.
2. Trocar o listener da fila por janela: `orderBy('horario', 'asc') + limit(30)`,
   crescendo de 30 em 30 até o teto de 200, com o mesmo desenho de
   `useMensagens`. Com a migração concluída, o `orderBy` do servidor passa a ser
   confiável, e a ordem crescente é a que o critério pede.
3. Custo estimado depois da mudança: 2 + 3 + 1 + 30 + 40 + 50 = **126 leituras por
   abertura**, ou 10 080 por turma por dia. Dez turmas em aula no mesmo dia dariam
   100 800 — ainda acima de 50 000, o que leva ao item 4.
4. Cortar o termo dos perks, que hoje lê 120 documentos por abertura para
   decorar a fila: filtrar por `where('revogadoEm', '==', null)` e `limit(40)`
   deixa a conta em **46 leituras**, ou 3 680 por turma por dia, e **dez turmas
   passam a caber em 36 800**.

### O que o dono do produto precisa decidir

A alternativa a tudo acima é o **plano Blaze**, em que a leitura excedente custa
US$ 0,06 por 100 000 documentos. As 236 800 leituras do pior caso custariam cerca
de **US$ 0,11 por dia letivo** — uns 22 dólares no ano. A decisão de pagar dois
dígitos de dólar por ano em vez de mexer na ordenação da fila é do dono do
produto, não da sessão que escreveu isto.

**Custo de não fazer agora:** se dez turmas usarem o app no mesmo dia com as filas
cheias, as leituras param no meio da tarde e o app passa a mostrar erro de
carregamento para todo mundo até a virada do dia. A mitigação operacional é a que
já existe e é boa: o professor exclui os chamados atendidos, e cada chamado
excluído sai da conta de todas as aberturas seguintes.

---

## B-004 — O deploy existe no workflow e não tem credencial para rodar

- **Versão:** 1.0.0 (task 09)
- **Critério afetado:** AC-CI-08
- **Estado:** automatizado até onde a automação alcança; a credencial é ação de dono

### O limite

`.github/workflows/release.yml` publica em produção a partir de `main`, e
`.github/workflows/homologacao.yml` publica um canal de pré-visualização a partir de
`dev`, no **mesmo** projeto Firebase (`senai-duvidas`, plano Spark — não há orçamento
para um segundo projeto). Os dois funcionam e nenhum dos dois pode rodar até que duas
coisas existam, e nenhuma delas é criável por uma sessão de automação:

| O que falta | Onde se cria | Nome esperado |
|---|---|---|
| O projeto Firebase, referenciado duas vezes | console do Firebase | variáveis `FIREBASE_PROJETO_PRODUCAO` **e** `FIREBASE_PROJETO_HOMOLOGACAO`, ambas com o id de `senai-duvidas` |
| Conta de serviço com papel de deploy | IAM do projeto | segredo `FIREBASE_SERVICE_ACCOUNT` |

Criar projeto no Firebase exige uma conta Google com faturamento associado e
aceitação de termos; gerar a chave da conta de serviço exige papel de
administrador no projeto. Não há API que a sessão possa chamar, e inventar
identificadores de projeto no repositório seria pior do que deixar a lacuna
visível: o workflow apontaria com confiança para um projeto que não existe.

### O que foi feito, então

- Os dois workflows estão escritos, revisados e testados no que é verificável sem
  credencial: gatilho, ordem dos passos, origem do número da versão,
  idempotência da tag e permissão do token — `src/__tests__/release.test.js`.
- O passo de deploy é **condicionado à existência do segredo**. Sem ele o
  workflow não falha: marca a versão, publica o release no GitHub e emite um
  aviso dizendo que o deploy não rodou. Falhar ali deixaria a tag sem criar e
  faria parecer que o release não saiu, quando o que falta é configuração de
  painel.
- `firebase.json` ganhou a seção `hosting`, com a reescrita de rota única que um
  app de página única precisa. Essa parte é código, e está pronta.
- O procedimento manual está em `docs/RELEASE.md` § 2.5, com a tabela acima.

### Proposta para fechar

1. No console do Firebase do projeto `senai-duvidas`: IAM → conta de serviço →
   papel *Firebase Hosting Admin* + *Cloud Datastore Owner* (para publicar as
   rules a partir de `main`) → gerar chave JSON.
2. No GitHub: *Settings → Secrets and variables → Actions* → o segredo
   `FIREBASE_SERVICE_ACCOUNT` com o JSON, e as **duas variáveis**
   (`FIREBASE_PROJETO_PRODUCAO` e `FIREBASE_PROJETO_HOMOLOGACAO`) com o mesmo id,
   `senai-duvidas`.
3. Fazer um push em `dev` e conferir que o canal de pré-visualização subiu,
   **antes** do primeiro merge em `main`.
4. Apagar esta entrada, com o link da primeira execução verde do deploy.

**Custo de não fazer agora:** a versão 1.0.0 é marcada e fica publicada no GitHub,
e a instalação no laboratório continua sendo manual (`npm run build` e subida do
`build/` à mão). Isso funciona e é exatamente o passo que um dia não é dado —
razão pela qual o automatizado existe e está esperando a chave.

---

## B-005 — `Modal.css` estiliza todo botão do aplicativo

- **Versão:** 1.0.0 (task 09)
- **Critério afetado:** nenhum diretamente; é a causa de um defeito de AC-CHAT-05
- **Estado:** o sintoma está corrigido; a causa fica para a 1.1.0

### O limite

`src/styles/Modal.css` declara, sem escopo:

```css
button {
  padding: 12px;
  border-radius: 8px;
  flex: 1;
  font-size: 16px;
}
```

O CSS do Create React App é **global**: um `import './styles/Modal.css'` dentro de
`Modal.js` não restringe nada ao modal. A regra vale para todo `<button>` do
aplicativo, e o `flex: 1` é o mais perigoso dos quatro, porque só se manifesta
quando o botão é item de um flex container — condição que ninguém verifica ao
escrever uma tela nova.

Foi assim que o chat da sala perdeu a conversa: `.chat-historico` ("Ver dias
anteriores") é o primeiro item de uma coluna flex, cresceu para 170px de altura, e
deixou 162px dos 440 do painel para as mensagens — três balões visíveis por vez,
com 170px de área clicável transparente por cima. O defeito apareceu ao tirar as
capturas do manual do aluno, quase um ano depois de a regra ter sido escrita.

### Por que não foi resolvido nesta task

A correção é uma linha — trocar `button` por `.modal button` —, e é justamente por
isso que ela é arriscada agora. Metade das telas do aplicativo herda daquela regra
o padding, o raio de borda e o tamanho de fonte dos botões: escopá-la faz todos
eles caírem para o `button` de `App.css`, que tem `padding: 10px`, `border-radius:
5px` e nenhum `font-size`. Nenhum teste reprovaria isso — não há teste de
regressão visual —, e a descoberta seria em sala de aula.

A 1.0.0 é a versão que vai para o laboratório. Trocar a aparência de todos os
botões do sistema na véspera não é estabilização.

### O que foi feito, então

- `src/styles/Chat.css` desfaz o `flex: 1` nos cinco botões-link do chat, do mesmo
  jeito e pelo mesmo motivo que `SeletorDeCor.css` já desfazia em
  `.seletor-de-cor__opcao`.
- `tests/e2e/layout.spec.js` mede a razão entre a área de conversa e o painel:
  o defeito não pode voltar sem reprovar.

### Proposta para fechar

1. Escopar as regras soltas de `Modal.css` (`button`, `button:hover` e `textarea`)
   em `.modal`.
2. Levantar os botões que dependiam delas — `git grep -l "<button"` em
   `src/components` — e decidir, tela a tela, se o visual correto é o de `App.css`
   ou se aquela tela precisa das próprias regras.
3. Fechar com teste de layout nas telas afetadas, no molde do
   `tests/e2e/layout.spec.js`: altura e largura medidas, não texto de CSS lido.
4. Apagar esta entrada e o desfazer de `Chat.css`, que deixa de ser necessário.

**Custo de não fazer agora:** cada tela nova que puser um botão dentro de um flex
em coluna vai encontrar o mesmo defeito, e vai encontrá-lo do mesmo jeito — olhando
para a tela, não rodando a suíte.


---

## B-006 — `autorizados` é de leitura pública, e fechá-la exige um servidor

- **Versão:** 1.0.0 (task 09)
- **Critério afetado:** AC-SEC-03 (atendido), AC-SEC-02 (atendido) — o limite é de
  confidencialidade da lista, não de autorização
- **Estado:** limite conhecido e aceito; a autorização em si está fechada

### O limite

`firestore.rules` libera `allow read: if true` em `autorizados/{email}`. A escrita
está fechada para todos — ninguém se acrescenta à lista —, mas **qualquer pessoa,
logada ou não, consegue ler quem está nela**. Na prática, a lista de e-mails dos
professores da escola é legível por quem souber onde procurar.

O `TODO(task-09)` que estava no arquivo desde a task 01 dizia: "mover a checagem
para um custom claim e fechar a leitura". Esta é a entrada que explica por que ele
não foi fechado aqui.

### Por que a leitura precisa estar aberta hoje

`utils/permissoes.js` consulta `autorizados/{email}` **antes de existir sessão**: é
essa consulta que decide se a tela de cadastro oferece a opção de professor. Uma
Security Rule não consegue liberar leitura para "quem está se cadastrando" — não
existe `request.auth` ainda. As únicas formas de escrever essa rule são
`if request.auth != null` (que quebraria o cadastro) ou `if true` (que é o que está
lá).

Trocar a ordem da tela — pedir o login primeiro e só depois oferecer o papel —
resolveria isso, e foi considerado. Não foi feito porque muda o fluxo de cadastro
de todo mundo na véspera da versão estável, sem que exista um problema de
autorização para justificar: o que vaza é a lista, não o poder.

### Por que não foi resolvido nesta task

A saída definitiva é o **custom claim**: gravar `professor: true` no token do
Firebase Auth e a rule ler `request.auth.token.professor`. O papel deixa de morar
num documento e passa a morar no token, e `autorizados` pode ser fechado de vez —
ou deixar de existir.

O que isso exige, e que este projeto não tem:

- `admin.auth().setCustomUserClaims()` só roda no **Admin SDK**, em ambiente de
  servidor. O navegador não tem como chamá-lo, e é exatamente esse o ponto;
- o lugar natural para isso é uma **Cloud Function**, que exige o plano Blaze do
  Firebase. O projeto roda no plano gratuito por restrição declarada (§ 7 do
  `tasks/_PROTOCOLO.md`), e mudar de plano é decisão do dono do produto, não da
  sessão que implementa;
- a alternativa sem Cloud Function é um script administrativo rodado à mão pela
  coordenação a cada professor novo, com a chave de conta de serviço. Isso troca um
  problema de confidencialidade por um problema operacional — e por um segredo a
  mais circulando fora do repositório.

### O que foi feito, então

- A **autorização** está fechada e testada: só vira professor quem está na lista, a
  rule reconfere a cada escrita, e a promoção depois do cadastro é negada
  (`tests/rules/firestore.rules.test.js`).
- A **escrita** em `autorizados` é negada para todos, inclusive para professores.
- `utils/permissoes.js` não registra nada no console: a função recebe o e-mail de
  quem está entrando, e o console fica visível na projeção da sala e em qualquer
  captura de tela de suporte.
- O limite está documentado em `docs/SEGURANCA.md` § 2.3 e no § 10 de
  `docs/ARQUITETURA.md`, em vez de viver só como um `TODO` no meio das rules.

### Proposta para fechar (1.1.0, ou antes se o plano mudar)

1. Decidir o ambiente de servidor: Cloud Function no plano Blaze, ou um script
   administrativo com a chave de conta de serviço.
2. Escrever o gatilho que, na criação do usuário, consulta a lista e grava o custom
   claim.
3. Migrar em duas etapas, nunca numa só: **ler dos dois lugares** (claim, com
   fallback para `autorizados`) → conferir que todos os professores têm o claim →
   fechar a leitura de `autorizados` e parar de consultá-la.
4. O teste que fecha esta entrada: a rule nega `get` em `autorizados/{email}` para
   quem não está autenticado, e o cadastro de professor continua funcionando.

**Custo de não fazer agora:** quem souber o caminho do documento consegue enumerar
os e-mails dos professores da escola. É exposição de dado de contato profissional,
não de dado de aluno, e não dá a ninguém nenhum poder de escrita. A mitigação é a
que já existe: a lista é mantida pela coordenação, e sair da escola é sair da lista
— item do checklist de release em `docs/SEGURANCA.md` § 4.5.
