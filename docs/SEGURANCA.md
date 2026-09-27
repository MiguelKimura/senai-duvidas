# Segurança

> Escrito na v1.0.0 (passo 3 da task 09). Cobre o **modelo de ameaça** deste sistema, a
> auditoria das Security Rules critério por critério, os **domínios autorizados** do
> Firebase Auth e o **procedimento de resposta a incidente**.
>
> A regra deste documento: toda afirmação de segurança vem com o nome do arquivo de teste
> que a prova. Afirmação sem teste ao lado é opinião, e opinião envelhece em silêncio.

---

## 1. Modelo de ameaça

### 1.1 O que está em jogo

O banco guarda, de alunos e professores do SENAI: **nome**, **e-mail**, o **texto** das
dúvidas, as **mensagens** de chat e de conversa direta, e os **prints** que os alunos
anexam. Nada além disso é coletado — sem telefone, sem documento, sem endereço, sem foto de
rosto, sem nota, sem qualquer dado de saúde. Isso não é promessa: a varredura de
`src/__tests__/dadosPessoais.test.js` exercita os caminhos de escrita do app, levanta os
campos que de fato chegam ao banco e reprova qualquer campo fora da lista declarada.

Os prints merecem atenção à parte. Eles são conteúdo que o usuário produz e sobre o qual o
sistema não tem controle: uma captura de tela inteira pode trazer a aba aberta ao lado, uma
notificação, um nome de arquivo. Por isso o anexo é legível **apenas por membro da sala**
(§ 2.6) e o manual do aluno avisa sobre isso explicitamente.

### 1.2 Quem é o adversário

Este sistema não é alvo de crime organizado. O adversário realista é **alguém de dentro**, e
o desenho inteiro parte disso:

| Adversário | O que ele quer | Capacidade real |
|---|---|---|
| **Aluno curioso** | Ler a DM de dois colegas, ver a fila de outra turma, achar o PIN | Sabe abrir o DevTools, sabe editar `localStorage`, sabe repetir uma requisição |
| **Aluno com conhecimento técnico** | Virar professor, dar perk a si mesmo, furar a fila | Consegue trocar o app por um `curl` com o próprio token de autenticação |
| **Aluno com rancor** | Apagar a dúvida ou a mensagem de um colega | O mesmo de cima |
| **Terceiro na mesma rede** | Assumir a sessão de quem está logado | Sniffer numa rede de laboratório compartilhada |
| **Página externa** | Colher a credencial do Google de um aluno | Hospeda uma página e abre o popup de login deste projeto |
| **Quem senta na máquina depois** | Usar o sistema como o aluno anterior | Nenhuma: basta a sessão ter ficado aberta |

O que **não** está no modelo: o comprometimento da infraestrutura do Google, o
administrador do projeto Firebase agindo de má-fé, e ataque de negação de serviço
distribuído. Os três estão fora do alcance de qualquer contramedida que caiba neste
sistema.

### 1.3 A premissa que organiza tudo

**Não existe servidor próprio.** O navegador fala direto com o Firestore e com o Storage.
Disso decorre a única regra estrutural do projeto:

> A tela **nunca** é a autorização. Esconder um botão é conforto de interface. Quem autoriza
> é a Security Rule, porque ela é a única coisa que continua valendo quando o app é trocado
> por um `curl`.

Toda verificação do cliente — o limite de 1000 caracteres da descrição, os magic bytes do
anexo, o `!clear` só do professor — existe para **dar a mensagem em português antes de
gastar a rede**, e tem uma contraparte no servidor que é a que vale.

### 1.4 As oito ameaças, e o que as detém

| # | Ameaça | Contramedida | Teste que prova |
|---|---|---|---|
| 1 | Aluno se declara professor no cadastro ou no `localStorage` | O papel vem de `autorizados/{email}`, conferido pelo servidor | `tests/rules/firestore.rules.test.js`, `src/services/__tests__/perfilUsuario.test.js` |
| 2 | Alguém lê a sala de outra turma | Tudo é subcoleção de `salas/{salaId}`; `list` de salas é negado | `tests/rules/salas.rules.test.js` |
| 3 | Aluno da sala lê o `pinHash` | O segredo mora em `salas/{id}/segredo/pin`, legível só pelo dono | `tests/rules/salas.rules.test.js` |
| 4 | Força bruta nos seis dígitos do PIN | `tentativasPin/{uid}`: 5 tentativas em 5 minutos, contadas pelo servidor | `tests/rules/salas.rules.test.js`, `src/services/__tests__/pin.test.js` |
| 5 | Terceiro lê a conversa direta de dois | `participantes` é conferido na rule; nem o dono da sala entra | `tests/rules/conversas.rules.test.js` |
| 6 | Aluno concede perk a si mesmo | `create` em `perks` exige ser o dono da sala, e `concedidoPor == request.auth.uid` | `tests/rules/perks.rules.test.js` |
| 7 | Adulteração de `horario` para furar a fila | `request.time` obrigatório em toda escrita de horário | `tests/rules/firestore.rules.test.js` |
| 8 | Upload de 6 MB, ou de `.exe` renomeado para `.png` | Teto e `contentType` na rule; magic bytes no cliente | `tests/rules/storage.rules.test.js`, `src/services/__tests__/anexos.test.js` |

---

## 2. Auditoria das Security Rules

A auditoria foi feita linha a linha sobre `firestore.rules` (800 linhas) e `storage.rules`
(89 linhas). O resultado por critério está abaixo.

### 2.1 AC-SEC-01 — deny by default

As duas folhas terminam com o mesmo bloco:

```
// Firestore
match /{documento=**} { allow read, write: if false; }

// Storage
match /{caminho=**}   { allow read, write: if false; }
```

Nada é legível ou gravável a não ser que uma regra **acima** o libere explicitamente. A
consequência prática: uma coleção nova nasce fechada. Se alguém acrescentar
`salas/{id}/anotacoes` amanhã e esquecer a rule, o app quebra na cara de quem
desenvolve — que é o modo certo de falhar. O contrário, nascer aberta, falharia em silêncio
e em produção.

Provado em `tests/rules/firestore.rules.test.js` e `tests/rules/storage.rules.test.js`, que
tentam ler e escrever num caminho que não existe em regra nenhuma e exigem recusa.

### 2.2 AC-SEC-02 — cada caminho tem teste de concessão **e** de negação

Este é o critério que sustenta os outros. Um `allow ... if false` colocado por engano deixa
a suíte verde se só houver teste de negação; um `allow ... if true` passa despercebido se só
houver teste de concessão. **O par é o que prova a fronteira.**

Os pares vivem em cinco arquivos:

| Arquivo | O que cobre |
|---|---|
| `tests/rules/firestore.rules.test.js` | papel do usuário, coleções legadas, `horario` do servidor, deny by default |
| `tests/rules/salas.rules.test.js` | sala, segredo do PIN, membros, chamados, chat, índice de PIN, tentativas |
| `tests/rules/conversas.rules.test.js` | conversas diretas e suas mensagens |
| `tests/rules/perks.rules.test.js` | premiações e o log de auditoria |
| `tests/rules/storage.rules.test.js` | anexos por sala, caminho legado, tamanho e formato |

A tabela "Quem lê o quê" de [`ARQUITETURA.md`](ARQUITETURA.md) § 4 é o resumo legível dessa
mesma matriz, linha a linha.

### 2.3 AC-SEC-03 — ninguém sobe de papel

O papel de professor **não** é um campo que o cliente escolhe. Ele é lido de
`autorizados/{email}`, uma coleção de leitura pública e **escrita fechada para todos** —
mantida pela coordenação pelo console, fora do app.

A rule de `usuarios/{uid}` recusa `tipo: "professor"` a quem não está na lista, e recusa
também a **promoção depois**: um documento gravado como aluno não vira professor por
`update`. Mudar o `localStorage` não promove ninguém, porque o `localStorage` não participa
da decisão — `src/services/__tests__/perfilUsuario.test.js` prova isso do lado do cliente, e
`tests/rules/firestore.rules.test.js` prova do lado que vale.

Ser professor no SENAI também **não** é ser professor *daquela* sala: quem concede perk,
gera PIN e arquiva é o `professorUid` do documento da sala, e mais ninguém
(`tests/rules/perks.rules.test.js`).

**O limite conhecido:** `autorizados/{email}` tem **leitura pública**. O fluxo de cadastro a
consulta *antes* de existir sessão — é ela que decide se a tela oferece a opção de
professor —, e uma rule não tem como liberar leitura a quem ainda não está autenticado sem
liberá-la a todo mundo. Na prática, a lista de e-mails de professores da escola é legível
por quem souber onde procurar. A escrita está fechada para todos, então ninguém se
acrescenta a ela; o que vaza é a lista, não o poder. A saída definitiva é mover o papel para
um **custom claim** do Firebase Auth e fechar a leitura — o que exige um ambiente de
servidor (Cloud Function ou script administrativo) que este projeto não tem. Registrado como
**B-006** em [`BLOQUEIOS.md`](BLOQUEIOS.md).

### 2.4 AC-SEC-04 — XSS em todos os pontos de entrada

A descrição do chamado aceita markdown desde a v0.7.0, e markdown vira HTML. O sanitizador
é o DOMPurify, e ele mora num arquivo só — `src/utils/markdown.js` —, de propósito: a linha
perigosa fica num lugar pequeno, com teste dedicado.

Mas sanitizador testado não é o mesmo que **aplicação** testada. O que a 1.0.0 acrescentou
foi a varredura por **ponto de entrada**, em `src/__tests__/xssPorPontoDeEntrada.test.js`:
ela injeta carga hostil em cada lugar por onde texto de usuário entra e verifica o que sai
na tela.

| Ponto de entrada | Coberto |
|---|---|
| Descrição do chamado, em texto puro (formato até a v0.6.0) | ✅ |
| Descrição do chamado, em markdown (v0.7.0 em diante) | ✅ |
| Mensagem do chat da sala | ✅ |
| Mensagem direta | ✅ |
| Nome da sala, no cartão da lista | ✅ |
| Justificativa do perk, na vitrine | ✅ |
| URL do anexo com esquema executável (`javascript:`) | ✅ |

O mesmo arquivo fecha a porta de trás: ele varre os fontes e exige que **todo**
`dangerouslySetInnerHTML` do projeto more num arquivo que importe o sanitizador. Uma porta
nova sem tranca reprova a suíte, em vez de esperar alguém notar na revisão.

Duas asserções ali existem só para provar que a varredura enxerga: uma carga que *deveria*
passar (o anexo legítimo continua aparecendo) e uma que *deveria* falhar. Varredura que
aprova o vazio não prova nada.

### 2.5 AC-SEC-05 — o segredo do PIN

As rules do Firestore **não escondem campo**: quem lê o documento lê todos os campos dele.
Se o resumo do PIN morasse em `salas/{salaId}`, os quarenta alunos da turma o leriam junto
com o nome da sala — e seis dígitos, com o resumo em mãos, caem por força bruta offline em
segundos.

Por isso o segredo mora em `salas/{salaId}/segredo/pin`, um documento separado que **só o
dono da sala** lê. Guarda-se `sha256(sal + pin)` e o sal, nunca o número. Consequências
aceitas de propósito:

- o PIN aparece **uma vez** na tela de criação e não há caminho para revê-lo;
- nem o suporte o recupera — a saída é gerar um novo;
- regerar não apaga o índice do PIN antigo, porque apagá-lo exigiria conhecer o número
  antigo em claro, que é justamente o que ninguém guarda.

A entrada na sala não é "o cliente lê o hash e compara". O cliente **propõe** a entrada, e o
servidor refaz o resumo com o sal e decide. Cliente adulterado não ganha nada.

Provado em `tests/rules/salas.rules.test.js` (aluno da sala recebe recusa ao ler
`segredo/pin`) e em `src/services/__tests__/pin.test.js` (o PIN sai do Web Crypto, não do
`Math.random()`).

### 2.6 AC-SEC-06 — HTTPS e domínios autorizados

**Metade é código, e está testada.** `src/utils/httpsObrigatorio.js`, chamado em
`src/index.js`, redireciona HTTP para HTTPS antes de a aplicação montar, com exceção de
`localhost`, `127.0.0.1` e `::1` — sem a exceção, `npm start` e os emuladores não subiriam.
Prova: `src/utils/__tests__/httpsObrigatorio.test.js`.

Sem HTTPS, numa rede de laboratório compartilhada, o token de autenticação e o conteúdo do
chat viajam legíveis: um aluno com um sniffer assume a sessão da professora sem precisar de
senha.

**A outra metade é configuração de console, e precisa ser aplicada à mão.** A lista de
**domínios autorizados** do Firebase Auth (Console → Authentication → Settings → Authorized
domains) precisa conter exatamente `localhost`, `senai-duvidas.firebaseapp.com` e
`senai-duvidas.web.app`. Com a lista aberta, qualquer página hospedada em qualquer lugar
abre o popup de login deste projeto e recebe a credencial de volta — é phishing com a tela
real do Google, apontando para o banco real da escola.

Não há API de cliente que leia essa lista, então nenhum teste rodando nesta máquina pode
prová-la. O procedimento completo, com a lista exata e como conferir, está em
[`DOMINIOS-AUTORIZADOS.md`](DOMINIOS-AUTORIZADOS.md); o limite está registrado em
[`BLOQUEIOS.md`](BLOQUEIOS.md). **Conferir essa lista é item obrigatório do checklist de
release.**

### 2.7 AC-SEC-07 — dado pessoal em log

Nenhum `console.log` nem `console.debug` existe no código de produção, e nenhuma chamada de
console interpola um portador de dado pessoal — nem `uid`, nem e-mail, nem nome, nem texto
de mensagem. A varredura está em `src/__tests__/dadosPessoais.test.js` e tem duas metades,
porque o critério tem duas:

1. **o que o app coleta** — os campos que chegam ao banco são levantados exercitando os
   caminhos de escrita de verdade, e cada um precisa estar numa lista declarada **com o
   motivo escrito**. A lista não pode ter sobra: campo declarado que o app não grava mais
   reprova, para a lista não virar ficção;
2. **o que o app registra** — a varredura de console sobre os fontes.

O caso concreto que isso pegou: um aviso de rebaixamento de professor que carregava o `uid`
no texto. Foi corrigido nesta versão.

O log de auditoria de perks (`salas/{id}/auditoriaPerks`) guarda `atorUid` e `alunoUid` de
propósito — é um registro de quem fez o quê, e sem os identificadores ele não serviria para
nada. Ele é legível **apenas pelo dono da sala**, e é imutável: `update` e `delete` são
negados para todo mundo, inclusive para quem o escreveu.

### 2.8 AC-SEC-08 — anexos

Duas pontas, e as duas precisam existir:

| Onde | O que confere | Por que existe |
|---|---|---|
| `src/services/anexos.js` | **magic bytes** do arquivo, tamanho, formato | Dá a mensagem em português antes de gastar a rede do laboratório |
| `storage.rules` | `contentType` e `size <= 5 MB` | É o que vale para quem trocou o app por um `curl` |

O teto é de **5 MB**. Os formatos aceitos são quatro, listados explicitamente:
`image/png`, `image/jpeg`, `image/webp`, `image/gif`. A lista é explícita e não
`image/.*` — `image/svg+xml` é uma imagem para o navegador e um documento com script dentro
para quem o abre.

Um `.exe` renomeado para `.png` é recusado pelos magic bytes no cliente; se o cliente for
contornado, a rule ainda confere o `contentType` declarado. Nenhuma rule consegue ler o
conteúdo do arquivo — essa é a fronteira real, e o par de verificações é a resposta possível
a ela.

Ordem deliberada das mensagens: o formato é conferido **antes** do tamanho. Dizer a quem
subiu um `.exe` de 6 MB que "o limite é 5 MB" sugeriria que bastava encolher.

Provado em `src/services/__tests__/anexos.test.js` e `tests/rules/storage.rules.test.js`,
que sobem um arquivo de 6 MB e um `.exe` renomeado e exigem as duas recusas.

### 2.9 O caminho legado, e por que ele continua aberto para leitura

`imagens/{arquivo}` no Storage, e as coleções globais `chamados` e `chat` no Firestore, são
o banco da v0.1.0. A **escrita** está fechada nos três. A **leitura** continua aberta de
propósito: fechá-la apagaria da tela a imagem de chamados antigos que ainda apontam para lá.

Isso é um risco conhecido e aceito, não um esquecimento: quem tiver o caminho exato de um
arquivo em `imagens/` consegue lê-lo. Os arquivos novos nunca vão para lá — vão para
`salas/{id}/chamados/{cid}/`, com nome sorteado de 16 bytes e leitura restrita a membro. A
remoção do caminho legado está prevista para depois de a migração de anexos ter rodado em
produção e o período de convivência ter passado; enquanto isso, manter é a escolha
reversível e fechar é a irreversível.

---

## 3. Segredos

Nenhum segredo é versionado, e isso é verificado **no repositório de hoje e no histórico do
git**, por `src/__tests__/segredosVersionados.test.js`:

- nenhum arquivo de credencial está versionado agora;
- nenhum arquivo de credencial **já esteve** versionado — a varredura percorre o histórico,
  porque `git rm` não apaga o passado e um segredo commitado uma vez está vazado para
  sempre;
- o `.gitignore` nomeia a chave de service account do Firebase Admin, que já esteve na pasta
  do projeto;
- o `.env.example` traz só marcador, nunca a credencial de um projeto real — e ele **não**
  é ignorado, porque é o modelo.

**As chaves `REACT_APP_FIREBASE_*` não são segredo.** O Create React App as embute no
bundle: qualquer pessoa com acesso ao site as lê. Elas estão em variável de ambiente para
que cada ambiente aponte para o seu próprio projeto sem recompilar, e não para escondê-las.
Quem protege os dados são as Security Rules. Tratar a chave do cliente como segredo é o
engano que leva alguém a achar que está protegido quando não está.

O segredo de verdade do projeto é a **chave de conta de serviço do Firebase Admin**, usada
pelos scripts de migração. Ela nunca entra no repositório.

---

## 4. Resposta a incidente

Um incidente aqui interrompe aula. O procedimento é curto de propósito — procedimento longo
não é seguido sob pressão.

### 4.1 Classificação

| Nível | O que é | Prazo de reação |
|---|---|---|
| **P1** | Dado de aluno exposto a quem não devia ver; credencial vazada; escrita indevida em produção | Imediato |
| **P2** | Recusa indevida que impede a aula (aluno não entra, fila não carrega) | Na mesma aula |
| **P3** | Defeito sem exposição de dado e sem parar a aula | Próximo release |

### 4.2 P1 — os primeiros quinze minutos

1. **Conter.** Se for regra de acesso, publique a rule corrigida direto:
   `firebase deploy --only firestore:rules,storage` — o deploy de rules é independente do
   deploy do app e leva segundos. Fechar demais é preferível a vazar: uma sala que não abre
   é um problema de aula; um dado exposto não se recolhe.
2. **Se for credencial vazada** (chave de service account), revogue-a no console do Google
   Cloud **antes** de qualquer outra coisa, e gere uma nova. Chave revogada não serve para
   nada nas mãos de ninguém.
3. **Registrar.** Anote o horário de início, o que foi observado e o que foi feito, em
   ordem. Memória reconstruída depois não serve para a análise.
4. **Avaliar o alcance.** Quais documentos, de quais salas, por quanto tempo, e se há
   indício de leitura efetiva.
5. **Comunicar a coordenação.** Dado pessoal de aluno menor de idade exposto não é decisão
   técnica: quem comunica e a quem é decisão da escola. Leve os fatos, não a avaliação.

### 4.3 Depois de contido

6. **Reverter ou corrigir.** O procedimento de rollback do app está em
   [`RELEASE.md`](RELEASE.md) § de reversão, e inclui o `git checkout <tag-anterior> --
   firestore.rules storage.rules` para voltar as regras junto.
7. **Escrever o teste primeiro.** A correção definitiva entra pelo ciclo normal: teste que
   falha reproduzindo o incidente, depois a correção. Um incidente sem teste de regressão
   volta.
8. **Registrar em [`HISTORICO.md`](HISTORICO.md)** o que aconteceu, por que foi possível e o
   que mudou. É a memória que impede a repetição.

### 4.4 O que **não** fazer

- **Não apague o log de auditoria** nem os documentos envolvidos. Eles são a evidência, e
  `auditoriaPerks` já é imutável por rule justamente por isso.
- **Não "conserte no console"** editando documentos à mão sem registrar. A correção que
  ninguém consegue reproduzir é a que volta.
- **Não avise a turma antes da coordenação.** A ordem importa.

### 4.5 Antes de cada release

Checklist de segurança, a rodar junto com o de [`RELEASE.md`](RELEASE.md):

- [ ] `npm run test:rules` verde — as rules de produção são as testadas
- [ ] domínios autorizados do Firebase Auth conferidos contra
      [`DOMINIOS-AUTORIZADOS.md`](DOMINIOS-AUTORIZADOS.md)
- [ ] `src/__tests__/segredosVersionados.test.js` verde
- [ ] `src/__tests__/dadosPessoais.test.js` verde
- [ ] a lista `autorizados/{email}` revisada: quem saiu da escola saiu da lista

---

## 5. Onde ler mais

| Documento | O que traz |
|---|---|
| [`ARQUITETURA.md`](ARQUITETURA.md) | O modelo de dados e a tabela completa de quem lê o quê |
| [`DOMINIOS-AUTORIZADOS.md`](DOMINIOS-AUTORIZADOS.md) | A lista exata e o procedimento do console |
| [`RELEASE.md`](RELEASE.md) | Publicação e rollback |
| [`BLOQUEIOS.md`](BLOQUEIOS.md) | Os limites conhecidos, com causa técnica e proposta |
| [`adr/0006-pin-com-hash-e-indice.md`](adr/0006-pin-com-hash-e-indice.md) | Por que o PIN é assim |
| [`adr/0009-modelo-de-conversas-diretas.md`](adr/0009-modelo-de-conversas-diretas.md) | Por que nem o dono da sala lê a DM |
