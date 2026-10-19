# Arquitetura de dados — salas, chamados, chat e PIN

> Escrito na v0.5.0 (task 03). Descreve o modelo de dados que passa a valer a
> partir dela, o caminho de cada leitura e cada escrita, e o fluxo de entrada
> por PIN. Quem chegar depois deve conseguir mudar o modelo sem reconstruir o
> raciocínio.

## 1. O problema que o modelo resolve

Até a v0.4.0 havia duas coleções globais:

```
chamados/{chamadoId}
chat/{mensagemId}
```

Todo aluno de todo curso via as dúvidas e as conversas de todo mundo. Um
professor de mecânica recebia a fila de informática; um aluno do noturno lia o
chat do matutino. Não havia como o professor organizar a turma dele, e não
havia como negar leitura a ninguém — negar exigiria uma noção de "turma" que o
banco não tinha.

A v0.5.0 introduz a **sala**. Uma sala vale o ano letivo inteiro: o aluno
digita o PIN uma vez em fevereiro e continua nela em novembro.

## 2. As coleções

```
salas/{salaId}
  nome, curso, anoLetivo
  professorUid, professorNome
  criadaEm (serverTimestamp), arquivadaEm | null, ativa: boolean
  pinAtualizadoEm
  ── nenhum segredo. Todo membro da sala lê este documento inteiro.

salas/{salaId}/segredo/pin          <- SÓ o dono da sala lê
  hash        SHA-256 de (sal + pin), em hexadecimal
  sal         aleatório, por sala
  atualizadoEm

salas/{salaId}/membros/{uid}
  nome, email, papel: "aluno" | "professor", entrouEm

salas/{salaId}/chamados/{chamadoId}
  autorUid, autorNome, nome, email, descricao, cor,
  imagem      string de URL | null   <- formato v0.1.0, mantido até a 1.0.0
  anexo       objeto | null          <- formato v0.6.0, aditivo (ver § 6)
  horario (Timestamp do servidor), horarioIso, atendido, atendidoEm

salas/{salaId}/chat/{mensagemId}
  autorUid, autorNome, nome, email, texto, horario, horarioIso
  autorPapel  "aluno" | "professor"   <- v0.8.0, aditivo (decide o selo)
  editadaEm   Timestamp | null        <- v0.8.0, aditivo
  ── `nome` e `email` continuam gravados: um cliente 0.7.0 ainda os lê.

salas/{salaId}/conversas/{conversaId}   <- v0.8.0. conversaId = "uidA_uidB",
  participantes: [uidA, uidB]              com os uids ORDENADOS e unidos
  participantesNomes: {uidA, uidB}
  ultimaMensagem: {texto, horario, autorUid}   <- desnormalizado (ADR 0009)
  naoLidas: {uidA: 0, uidB: 3}                 <- desnormalizado (ADR 0009)
  ── a rule lê `participantes`. A consulta do cliente PRECISA ser
     `where('participantes', 'array-contains', uid)`, ou a listagem é negada.
  └── mensagens/{mensagemId}
        autorUid, autorNome, texto, horario, lidaEm | null

salas/{salaId}/perks/{perkId}           <- v0.9.0. As premiações do professor
  alunoUid, alunoNome
  tipo: "prioridade" | "destaque" | "colaborador" | "resolvedor"
  nivel: 1..3
  justificativa: string (≤ 280) | null
  anunciarParaSala: boolean     <- controla o que a TELA exibe, não o que a
                                   rule libera: a justificativa é legível por
                                   qualquer membro da sala (ver MANUAL-PROFESSOR)
  concedidoPor, concedidoPorNome, concedidoEm (request.time)
  expiraEm: Timestamp | null, revogadoEm: Timestamp | null
  visualizadoEm: Timestamp | null   <- o recibo da animação; só vai de null
                                       para um instante, nunca de volta
  ── só o dono da sala cria. `update` é restrito a UMA de duas formas:
     o dono revogando (`revogadoEm`) ou o premiado dando o recibo
     (`visualizadoEm`). Nenhuma outra escrita passa.

salas/{salaId}/auditoriaPerks/{eventoId}   <- v0.9.0. O log (AC-PERK-10)
  acao: "conceder" | "revogar" | "expirar"
  perkId, alunoUid, atorUid, em (request.time), detalhes
  ── legível SÓ pelo dono da sala. `update` e `delete` negados para todos,
     inclusive para quem escreveu: log que o autor reescreve depois não é log,
     e o autor aqui é justamente quem a auditoria existe para registrar.

usuarios/{uid}/salas/{salaId}       <- espelho, só para montar a lista
  salaId, papel, entrouEm

indicePins/{pin}                    <- `get` de documento específico, nunca `list`
  salaId, ativo, criadoEm

tentativasPin/{uid}                 <- o limite de força bruta (AC-SALA-12)
  tentativas, janelaIniciadaEm, ultimaTentativaEm, pinTentado
```

### O bucket do Storage (v0.6.0)

```
salas/{salaId}/chamados/{chamadoId}/{arquivo}   <- anexo, legível só por membro
  {arquivo} = 16 bytes sorteados + extensão real, ex.: 9f3c...b1.png

imagens/{arquivo}                               <- legado v0.1.0
  leitura aberta (chamados antigos apontam para cá), escrita FECHADA
```

O nome do arquivo é **sorteado**, e não derivado de `Date.now()`: o relógio das
máquinas de laboratório está errado (§ 6 da v0.4.0) e uma turma que envia print
no mesmo minuto colidiria — e colidir no Storage é sobrescrever o anexo de
outra pessoa, em silêncio. O instante que importa continua sendo o
`serverTimestamp()` do documento do chamado.

### Por que o segredo do PIN mora fora do documento da sala

As rules do Firestore **não escondem campo**: quem pode ler o documento lê
todos os campos dele. Se `pinHash` morasse em `salas/{salaId}`, todo aluno da
turma o leria junto com o nome da sala — e seis dígitos com o resumo em mãos
caem por força bruta offline em segundos. O segredo num documento separado é o
que permite dar leitura da sala a quarenta pessoas e do segredo a uma
(AC-SEC-05).

### Por que existe o espelho `usuarios/{uid}/salas`

A autoridade sobre quem é membro é `salas/{salaId}/membros/{uid}` — é o
documento que as rules consultam. Mas a pergunta "de quais salas **eu** sou
membro?" não tem resposta barata a partir dali: exigiria varrer as salas de
todo mundo, que é o que o AC-SEC-02 proíbe e o AC-PERF-03 encarece. O espelho é
uma desnormalização deliberada, escrita pelo próprio dono do documento.

Ele pode ficar desatualizado num caso: o professor remove um aluno, e o espelho
do aluno fica para trás — ninguém escreve no documento de outra pessoa, nem o
professor. A lista de salas trata isso ao carregar: sala que não responde não
vira cartão.

## 3. O fluxo de entrada por PIN

```
  Professor                          Banco                        Aluno
      │                                │                            │
      │ criarSala()                    │                            │
      ├──── addDoc salas/{id} ────────►│                            │
      │                                │                            │
      │ sorteia PIN (Web Crypto)       │                            │
      ├──── create indicePins/{pin} ──►│  rule: só `create`.        │
      │     ◄── recusa = colisão ──────┤  Escrever num PIN já       │
      │         (sorteia outro)        │  usado é negado, e a       │
      │                                │  recusa É o sinal.         │
      │                                │                            │
      ├──── set segredo/pin ──────────►│  hash = sha256(sal + pin)  │
      │                                │                            │
      │ mostra o PIN UMA vez           │                            │
      │ (memória da aba, nunca gravado)│                            │
      │                                │                            │
      │        ─── passa o PIN para a turma, fora do sistema ──►    │
      │                                │                            │
      │                                │◄── set tentativasPin/{uid} ┤
      │                                │    rule conta a tentativa  │
      │                                │    e a janela (AC-SALA-12) │
      │                                │                            │
      │                                │◄── get indicePins/{pin} ───┤
      │                                │    rule exige tentativa    │
      │                                │    recém-contada           │
      │                                │                            │
      │                                │◄── create membros/{uid} ───┤
      │                                │    rule refaz o resumo com │
      │                                │    o sal e compara. É o    │
      │                                │    SERVIDOR que confere.   │
```

Três consequências desse desenho:

1. **O cliente nunca lê o segredo.** Ele propõe a entrada e o servidor aceita
   ou não. Um cliente adulterado não ganha nada.
2. **Regerar o PIN invalida o anterior** sem apagar nada: o resumo gravado passa
   a ser o do número novo, e o antigo deixa de conferir (AC-SALA-09).
3. **A recusa é sempre a mesma frase.** PIN inexistente, PIN de sala arquivada e
   PIN regerado produzem a mesma mensagem. Qualquer diferença transformaria a
   tela num oráculo de "este número é PIN de alguém?" (AC-SALA-04).

O documento de índice do PIN antigo continua existindo depois da regeração, e
isso é deliberado: apagá-lo exigiria conhecer o número antigo, e o sistema
inteiro é construído para que ninguém — nem o servidor — o guarde em claro.

## 4. Quem lê o quê (resumo das rules)

| Caminho | Leitura | Escrita |
|---|---|---|
| `salas/{id}` | `get`: membro ou dono. `list`: **negado** — ninguém varre as salas da escola | `create`: professor, como dono. `update`: só o dono. `delete`: **negado** |
| `salas/{id}/segredo/pin` | só o dono | só o dono; `delete` negado |
| `salas/{id}/membros/{uid}` | `get`: o próprio ou o dono. `list`: membros da sala | `create`: o próprio, com PIN válido e sala ativa. `update`: **negado**. `delete`: o próprio ou o dono |
| `salas/{id}/chamados/*` | membros da sala | membros, na sala **ativa**; autor apaga o seu, dono apaga qualquer um |
| `salas/{id}/chat/*` | membros da sala | membros, na sala **ativa** |
| `indicePins/{pin}` | `get` após tentativa contada. `list`: **negado** | `create`: só o dono da sala apontada. `update`/`delete`: **negados** |
| `tentativasPin/{uid}` | `get` do próprio. `list`: **negado** | o próprio, dentro do que a janela permite; `delete` negado |
| `usuarios/{uid}/salas/*` | o próprio | o próprio |
| `chamados/*` e `chat/*` (globais, legado) | autenticado | autenticado, com `horario` do servidor |
| **Storage** `salas/{id}/chamados/{cid}/*` | membros da sala | membros da sala, ≤ 5 MB, `contentType` num dos quatro formatos; `delete`: membros |
| **Storage** `imagens/*` (legado) | aberta — chamados antigos apontam para cá | **negada** |

Cada linha tem, em `tests/rules/salas.rules.test.js`, um teste de permissão
**concedida** e um de **negada**. Sem o par, um `allow ... if false` acidental
passaria despercebido: a suíte ficaria verde com o app quebrado.

## 5. Custo de leitura (AC-PERF-06)

Alvo declarado do projeto: 10 salas ativas, 40 alunos por sala, 200 chamados e
1000 mensagens por sala.

> **Esta seção é conferida por teste.** `src/__tests__/orcamentoDeLeitura.test.js`
> lê as constantes que o código passa ao `limit()`, refaz a aritmética abaixo e
> exige que os números desta página sejam os mesmos. Até a 1.0.0 a conta era
> escrita à mão, e tinha envelhecido: a linha da lista de conversas dizia
> `limit(50)` quando o código já cortava em 40, e a conclusão dizia que dez salas
> caberiam com folga contra uma estimativa, na linha acima, que multiplicada por
> dez dava três vezes a cota. Uma conta de capacidade que diverge do código é
> pior do que nenhuma: ela dá a sensação de que a capacidade foi verificada.

### Os cortes que o código impõe

| Listener | Corte | Leituras por abertura |
|---|---|---|
| Fila de chamados | `limit(200)` | ≤ 200 |
| Conversa da sala | `limit(50)`, decrescente, **só com o painel aberto** | ≤ 50 |
| Teto da conversa, depois de paginar | `limit(300)` | ≤ 300 |
| Mensagens de uma DM | `limit(50)`, decrescente | ≤ 50 |
| Lista de conversas | `array-contains` + `limit(40)` | ≤ 40 |
| Perks da sala | `limit(120)` | ≤ 120 |
| Lista de salas (espelho) | `limit(20)` | ≤ 20 |
| Membros (só o dono) | `limit(60)` | ≤ 60 |

Nenhum `onSnapshot` escuta coleção inteira sem corte, e
`src/__tests__/listenersComTeto.test.js` varre o `src/` inteiro exigindo isso de
cada listener, inclusive dos que ainda não existem.

### O custo de uma abertura de tela

O Firestore cobra por **documento entregue**, então cada termo é
`min(o que existe na sala, o teto)` — não o teto sozinho. Um teto de 120 perks
numa sala que tem três perks custa três leituras.

| Termo | Sala de março | Sala de novembro |
|---|---|---|
| `usuarios/{uid}` + `autorizados/{email}` | 2 | 2 |
| espelho `usuarios/{uid}/salas` | 1 | 3 |
| `salas/{salaId}` | 1 | 1 |
| fila de chamados | 20 | 200 |
| perks da sala | 0 | 40 |
| primeira página do chat | 50 | 50 |
| **total por abertura** | **74** | **296** |

Quarenta alunos abrindo a tela duas vezes por aula são 80 aberturas por turma por
dia letivo: **5 920** leituras em março, **23 680** em novembro.

### A projeção para o alvo, contra a cota gratuita

A cota do plano Spark é de **50 000 leituras por dia** por projeto. O
multiplicador que decide tudo não é quantas salas existem no ano — é **quantas
turmas usam o app no mesmo dia**.

| Turmas em aula no mesmo dia | Março (fila curta) | Novembro (fila cheia) |
|---|---|---|
| 2 | 11 840 ✅ | 47 360 ✅ |
| 3 | 17 760 ✅ | 71 040 ❌ |
| 8 | 47 360 ✅ | 189 440 ❌ |
| 10 | 59 200 ❌ | 236 800 ❌ |

**Dez turmas em aula no mesmo dia, com a fila cheia, não cabem na cota gratuita:
são 236 800 leituras contra 50 000.** O que cabe hoje é duas turmas de novembro,
ou oito de março. A capacidade deste app não é um número — ela é função do
tamanho da fila, e a fila cresce o ano letivo inteiro.

Isso está registrado como **B-003** em `docs/BLOQUEIOS.md`, com a causa técnica e
a proposta de fechamento (paginar o listener da fila como o do chat já é
paginado). Ele não foi resolvido na 1.0.0 porque a fila é ordenada de forma
crescente e convive com `horario` em string ISO do banco antigo — uma janela
decrescente ali mexe na ordenação da tela que a turma usa, e é mudança de 1.1.0,
não de véspera de release.

### O que a v0.8.0 mudou nesta conta

Foi a maior economia de leitura do roadmap, e ela vem de duas mudanças
independentes no chat.

**A janela virou decrescente e começou em 50.** A v0.7.0 cortava em 300, mas
cortava *crescente* — e `orderBy('horario') + limit(300)` devolve as 300
mensagens **mais antigas** da sala. Numa sala em novembro, isso é a conversa de
março: 300 documentos que ninguém vai ler, pagos por todo mundo, enquanto a
mensagem de agora nem aparece. O corte existia; faltava a direção.

**O painel fechado deixou de assinar.** Antes, `TelaAluno` e `TelaProfessor`
montavam o `<Chat/>` no rodapé e ele assinava a conversa na hora — com o painel
fechado, em toda tela de toda pessoa, o dia inteiro. A tela do professor custava
duas assinaturas de coleção; passou a custar uma.

| | v0.7.0 | v0.8.0 em diante |
|---|---|---|
| Leituras de chat por abertura de tela | 300 (sempre) | 0 com o painel fechado |
| Leituras de chat por abertura do painel | — | 50, mais as novas que chegarem |
| Chat por turma por dia letivo (40 alunos × 2) | ~24 000 | ~4 000 |

Depois dessas duas mudanças o gargalo deixou de ser o chat e passou a ser a fila
de chamados — que é exatamente onde a conta acima mostra que ele continua.

### As escritas

As `conversas` acrescentam escrita, não leitura: cada mensagem direta custa duas
escritas (a mensagem e o `ultimaMensagem`/`naoLidas` do documento pai), contra um
limite de 20 000 escritas/dia. Somando tudo o que um aluno escreve numa aula — um
chamado, cinco mensagens de sala, uma direta, a entrada de membro —, dez turmas
de 40 alunos ficam em torno de 3 600 escritas por dia, com margem de mais de
cinco vezes. A troca está descrita no ADR 0009.

## 6. Compatibilidade

**Retroativa.** Sem `salaId`, `TelaAluno`, `TelaProfessor` e `Chat` leem as
coleções globais da v0.4.0. As rotas `/aluno` e `/professor` continuam no mapa
e são exatamente esse caso. É o que impede a tela vazia para quem abrir o app
antes de entrar em sala alguma, ou no meio da migração.

No anexo, `normalizarAnexo` (`src/services/anexos.js`) é a leitura dupla: ela
entende `imagem` em string — o formato da v0.1.0 — e `anexo` em objeto, e
devolve a mesma coisa para o card nos dois casos. Nenhuma conversão acontece no
banco.

**Futura.** Todo documento novo grava `autorNome` **e** `nome`, com o mesmo
conteúdo, e `autorUid` ao lado de `email`. Um cliente da v0.4.0 com a aba
aberta continua exibindo quem abriu o chamado. `nome` só é removido na 1.0.0 —
a segunda etapa da migração em duas fases exigida pelo protocolo.

O campo de anexo segue a mesma regra e é a etapa 1 da mesma migração em duas
fases. A v0.6.0 grava os **dois** formatos:

```js
{
  imagem: anexo.url,   // string — é onde todo cliente já aberto a procura
  anexo: { url, caminho, origem: 'upload' | 'url', largura, altura, bytes }
}
```

Um cliente da v0.5.0 com a aba aberta no laboratório lê `imagem` e mostra a
imagem, ignorando `anexo`, que ele não conhece. `imagem` só sai na 1.0.0 —
`scripts/migrar-anexos.js` é a etapa do meio, e é opcional justamente porque a
leitura dupla já resolve o caso do usuário.

## 7. O que a task 03 deixou preparado para as próximas

- **Task 04 (imagens): feito na v0.6.0.** `caminhoDoAnexo(salaId, chamadoId,
  nome)` já devolvia `salas/{salaId}/chamados/{chamadoId}/{nome}`, e a task 04
  fechou os dois `TODO(task-04)` que restavam em `storage.rules`: a checagem de
  membro (via `firestore.exists()`, a mesma consulta que as rules do Firestore
  fazem do outro lado) e a escrita no caminho legado `imagens/{arquivo}`, que
  só pôde ser fechada depois de existir o substituto. A **leitura** do legado
  continua aberta de propósito — fechá-la apagaria da tela o print de chamados
  antigos que apontam para lá (AC-IMG-13).
- **Task 06 (chat/DM):** as conversas privadas entram como
  `salas/{salaId}/conversas/{conversaId}`.
- **Task 07 (perks):** `salas/{salaId}/perks/{uid}`.

## 8. Custo de armazenamento (v0.6.0)

O plano gratuito do Firebase dá **5 GB** de Storage, **1 GB/dia** de download e
**20 000 operações de upload por dia**. A conta abaixo usa o mesmo alvo
declarado do projeto: 10 salas ativas, 40 alunos por sala.

| Grandeza | Valor | De onde sai |
|---|---|---|
| Tamanho médio por anexo | **~300 KB** | PNG de tela cheia reduzido a 1600px, qualidade 0.85 |
| Anexos por aluno por ano | 10 | estimativa: um print a cada 3–4 aulas |
| Por sala por ano | 40 × 10 × 300 KB ≈ **120 MB** | |
| **10 salas por ano** | ≈ **1,2 GB** | **24% da cota gratuita** |

Cabe, com margem para três anos letivos antes de a cota apertar.

**A compressão no cliente é o que mantém essa conta de pé, e por isso ela é
requisito e não otimização** (AC-IMG-07). Sem reduzir para 1600px, o print de
um monitor 1920×1080 sobe com ~1,2 MB e o mesmo uso daria ~4,8 GB por ano — a
cota inteira, no primeiro ano. Num monitor 4K seria muito pior.

O download também é afetado, e mais de perto: o professor abre a fila várias
vezes por aula, e cada miniatura é um download. É o mesmo argumento — o que
reduz o custo não é a qualidade do codec, é o número de pixels.

**Quando a cota apertar**, nesta ordem: (1) apagar os anexos de salas
arquivadas há mais de um ano letivo, que é o grosso do acervo morto; (2) baixar
`LADO_MAXIMO` para 1200px, que ainda lê erro de compilador; (3) só então pagar
o plano Blaze. Aumentar a cota antes de limpar o que já não é olhado é pagar
por armazenamento de dado que ninguém lê.

**O que não entra nessa conta:** o caminho legado `imagens/{arquivo}` da
v0.1.0, que não recebe arquivo novo desde a v0.6.0 e é pequeno o bastante para
não mover o ponteiro.

## 9. Acessibilidade e movimento (v0.10.0)

Esta seção é o que a task 08 auditou e o que quem vier depois precisa manter.
Ela é curta de propósito: cada regra abaixo tem um teste que a cobra, e a
regra sem teste não está nesta lista.

### O que guarda o quê

| Assunto | O que é exigido | Teste que reprova |
|---|---|---|
| Contraste | 4,5:1 em texto normal, 3:1 em elemento não textual | `src/styles/__tests__/contraste.test.js` |
| Paleta do card | os nove fundos contra o mesmo texto escuro | `src/utils/__tests__/paleta.test.js` |
| Tokens consumidos | nenhuma cor literal fora de `tokens.css` | `src/styles/__tests__/consumoDeTokens.test.js` |
| Origem dos tokens | todo valor é extração congelada ou decisão nomeada | `src/styles/__tests__/tokens.test.js` |
| Movimento | 150–300ms, só `transform`/`opacity`, nunca `all` | `src/styles/__tests__/animacoes.test.js` |
| Menos movimento | um `@media` universal, e o hook para o que é JS | idem, e `AnimacaoDePerk.test.js` |
| Violação de ARIA | zero crítica ou séria, em 11 telas | `src/__tests__/acessibilidadeDasTelas.test.js` |
| Teclado nos diálogos | foco preso, `Esc`, foco devolvido | `Modal.test.js`, `ConfirmarAcao.test.js`, `Lightbox.test.js` |
| Anúncio de mudança | `aria-live` nos avisos e nas mensagens novas | `Toast.test.js`, `Chat.test.js` |
| Lint de acessibilidade | as regras de teclado do `jsx-a11y` ligadas | `src/__tests__/lintDeAcessibilidade.test.js` |
| Diálogo do navegador | nenhum `alert`/`confirm`/`prompt`/`window.open` | `src/__tests__/semDialogosDoNavegador.test.js` |
| Pontos de corte | 480, 768, 1024 e 1440, e nenhum outro | `src/styles/__tests__/responsividade.test.js` |
| Estado das listas | nenhuma afirma estar vazia antes de saber | `src/__tests__/listasCarregandoEVazias.test.js` |

### As quatro regras que o projeto pratica

**1. Contraste é conta, não opinião.** Todo par de cor que a interface pratica
está numa tabela, com o arquivo e o seletor onde ele acontece, e a conta da
WCAG roda sobre ele. Quando o teste ficar vermelho, **muda-se a cor, nunca o
piso**: 4,5:1 e 3:1 vêm de fora deste projeto. Foi assim que o vermelho da
marca passou de `#ff0000` para `#d60000` na v0.10.0 — ver
`docs/adr/0011-sistema-de-animacoes-e-tokens.md`.

A tabela é escrita à mão porque saber qual fundo está atrás de um texto exige
resolver a cascata e a árvore do documento, e o jsdom não aplica folha de
estilo. Uma extração automática erraria o fundo e aprovaria o par errado. O
guarda contra ela envelhecer é outro teste, que exige que todo token de cor
apareça em algum par ou esteja numa lista de exceções com motivo escrito.

**2. Foco visível em tudo, e `:focus-visible` — nunca `outline: none` sem
substituto.** O anel é único no app inteiro (`--cor-foco`, o quase-preto), e é
quase-preto e não o vermelho da identidade porque ele precisa aparecer também
**sobre** o botão vermelho. `outline` é a propriedade certa porque não ocupa
espaço no fluxo: o anel sobrepõe o vizinho em vez de empurrá-lo.

**3. Diálogo é diálogo.** Os três do projeto — o visualizador de anexo, o modal
de novo chamado e a confirmação de exclusão — passam por
`src/hooks/useDialogoModal.js`, que faz três coisas e só elas: foco inicial no
elemento que o chamador escolher (**e o chamador escolhe o seguro, nunca o
destrutivo**), prisão de tabulação com volta nas duas bordas, e `Esc` fechando
com o foco devolvido a quem abriu.

Não é `<dialog>` nativo com `showModal()` porque ele ainda não está nas duas
últimas versões de todos os navegadores da lista de compatibilidade do
projeto, e a tela do laboratório é justamente a desatualizada.

**4. Nada some sem ser anunciado, e nada é anunciado duas vezes.** A pilha de
avisos usa `role="log"` — o papel de uma região onde a informação é
*acrescentada* em ordem — e não `role="status"`, que as telas já usam para o
próprio carregamento. Duas regiões com o mesmo papel na mesma página tornariam
cada mensagem ambígua para quem consulta a tela por papel. O esqueleto de
carregamento é `aria-hidden`: ele não é conteúdo, é a ausência dele, e quem
anuncia a espera é o `role="status"` ao lado.

### Como manter

- **Cor nova?** Ela entra em `tokens.css` e ganha uma linha na tabela de
  `contraste.test.js`, com o seletor onde ela aparece. O teste que varre os
  tokens reprova quem esquecer.
- **Diálogo novo?** Ele usa `useDialogoModal`. Uma segunda cópia de prisão de
  foco é onde o comportamento começa a divergir.
- **Tela nova?** Ela ganha um caso em `acessibilidadeDasTelas.test.js`. O
  `axe` pega cerca de um terço das barreiras reais — o resto (ordem de
  tabulação, se o rótulo faz sentido) continua exigindo o teste escrito à mão.
- **Animação nova?** Ela usa as classes e os tokens de `animacoes.css`. Um
  `@keyframes` declarado na folha do componente escapa do bloco global de
  `prefers-reduced-motion`, e é assim que a preferência da pessoa deixa de
  valer sem ninguém perceber.
- **Ponto de corte novo?** Não. Os quatro estão declarados em
  `responsividade.test.js`, e acrescentar um exige justificar ali.

### O que esta auditoria **não** cobre

- **Layout real.** Os testes de responsividade leem o texto do CSS. Eles
  provam que a regra existe e está no ponto de corte certo; não provam que um
  pixel caiu onde deveria. Isso passou a ser coberto na v1.0.0 por
  `tests/e2e/layout.spec.js`, que mede em 1024×768 e em 360×640 num navegador
  de verdade — o que fechou o bloqueio B-002.
- **Leitor de tela de verdade.** Nada aqui substitui abrir o NVDA e percorrer
  um fluxo. O que os testes garantem é que a marcação não regrediu.
- **Contraste de imagem.** O print que o aluno anexa é o print que ele tirou.

---

> **Sobre a numeração.** As seções 10 e 11 nasceram na v1.0.0 (AC-DOC-05) e
> foram **acrescentadas ao fim** em vez de inseridas no meio: outros documentos
> citam este por número (`§ 4`, `§ 5`, `§ 8`), e renumerar quebraria todos eles
> em silêncio. Ler na ordem 3 → 10 → 11 é o caminho dos fluxos.

## 10. O fluxo de autenticação e a resolução de papel

Esta é a primeira coisa que acontece com qualquer pessoa, e é a que decide todo
o resto: para qual tela ela vai e o que ela pode escrever.

```
  Navegador                      Firebase Auth                 Firestore
      │                                │                            │
      │ setPersistence(LOCAL)          │                            │
      ├───────────────────────────────►│  ANTES de qualquer login   │
      │                                │  (AC-SESSAO-01). Feito uma │
      │                                │  vez, em services/auth.js  │
      │                                │                            │
      │ e-mail+senha │ Google │ GitHub │                            │
      ├───────────────────────────────►│                            │
      │      ◄──── usuário + token ────┤                            │
      │                                │                            │
      │ garantirPerfil(usuario)        │                            │
      ├──── get usuarios/{uid} ─────────────────────────────────────►
      │                                                             │
      │   ┌─ não existe ────────────────────────────────────────┐   │
      │   │  get autorizados/{email}                            ├──►│
      │   │      ◄── Tipo == "professor" ?                      │◄──┤
      │   │  create usuarios/{uid} {nome,email,tipo,criadoEm}   ├──►│
      │   │  a rule confere de novo: só vira professor quem     │   │
      │   │  `autorizados` confirma (AC-AUTH-07, AC-SEC-03)     │   │
      │   └─────────────────────────────────────────────────────┘   │
      │                                                             │
      │   ┌─ já existe ─────────────────────────────────────────┐   │
      │   │  diz professor, mas o e-mail saiu de `autorizados`? │   │
      │   │     → entra REBAIXADO para aluno, e o log registra. │   │
      │   │       Travar a entrada no meio da aula seria pior.  │   │
      │   └─────────────────────────────────────────────────────┘   │
      │                                                             │
      │ papel resolvido                                             │
      ├──► professor → /salas (Minhas salas, com "Criar sala")      │
      └──► aluno     → /salas (PIN na tela ou "Adicionar nova sala")│
```

Quatro pontos que o desenho fixa:

1. **O papel nunca sai do `localStorage`.** Até a v0.2.0 ele saía de
   `localStorage.getItem('tipoUsuario')` — um valor que o próprio navegador
   escreve, e que qualquer aluno com o DevTools aberto trocava para "professor".
   Hoje o único caminho até o papel é `services/perfilUsuario.js`, que o lê do
   Firestore. Ver
   [`adr/0003-fonte-unica-de-verdade-para-papel-do-usuario.md`](adr/0003-fonte-unica-de-verdade-para-papel-do-usuario.md).
2. **A checagem do cliente é conforto; a da rule é autorização.**
   `utils/permissoes.js` existe para *não oferecer* o cadastro de professor a
   quem não pode. Contornada, a rule de `usuarios/{uid}` recusa a escrita do
   mesmo jeito.
3. **A persistência é configurada antes do login, e uma vez só.** Depois disso a
   sessão vive no IndexedDB e sobrevive a recarregar a página e a desligar a
   máquina (AC-SESSAO-02). Ela só termina em **Sair** — que é por que o botão
   existe em toda tela autenticada, numa sala de máquinas compartilhadas.
4. **`autorizados` é de leitura pública e escrita fechada para todos.** A
   leitura pública é um limite conhecido, registrado como B-006 em
   [`BLOQUEIOS.md`](BLOQUEIOS.md) e explicado em [`SEGURANCA.md`](SEGURANCA.md)
   § 2.3: o fluxo de cadastro consulta a lista antes de existir sessão.

## 11. O ciclo de vida do chamado

Do clique no `+` até o card sair da fila. É o fluxo que o sistema inteiro existe
para servir.

```
   Aluno                    Storage                Firestore            Professor
     │                         │                       │                    │
     │ clica no "+"            │                       │                    │
     │ reservarChamado(salaId) │                       │                    │
     ├─── id sorteado ANTES do upload ────────────────►│  (o documento      │
     │    para o anexo já nascer na pasta definitiva   │   ainda não existe:│
     │                         │                       │   é só o id)       │
     │                         │                       │                    │
     │ escolhe / arrasta / cola a imagem               │                    │
     ├── magic bytes e tamanho, no cliente             │                    │
     ├── put salas/{s}/chamados/{c}/{16 bytes}.png ───►│                    │
     │      rule: membro, ≤ 5 MB, contentType aceito   │                    │
     │   ◄──── URL de download ─┤                      │                    │
     │                         │                       │                    │
     │ valida a descrição (1..1000), no cliente        │                    │
     │ addDoc salas/{s}/chamados/{c} ─────────────────►│                    │
     │   { autorUid, descricao, cor, formato,          │                    │
     │     horario: serverTimestamp(), horarioIso,     │                    │
     │     imagem: URL, anexo: {…}, atendido: false }  │                    │
     │      rule: membro, sala ATIVA, descrição de     │                    │
     │      1 a 1000, cor e formato válidos,           │                    │
     │      horario == request.time                    │                    │
     │                         │                       │                    │
     │                         │  onSnapshot(subcoleção da sala,            │
     │                         │  orderBy horario, limit 200) ─────────────►│
     │                         │                       │  o card aparece na │
     │                         │                       │  fila, em tempo    │
     │                         │                       │  real, ordenado    │
     │                         │                       │  por perk e chegada│
     │                         │                       │                    │
     │                         │                       │◄── update ─────────┤
     │                         │                       │  {atendido,        │
     │                         │                       │   atendidoEm}      │
     │                         │                       │                    │
     ├─ confirma "Excluir"     │                       │                    │
     │  5 s de DESFAZER na tela; nada foi ao banco ainda                    │
     │  ├── desfez  → o card volta, e acabou           │                    │
     │  └── passou  → delete do documento ────────────►│                    │
     │                delete do anexo ──►│             │                    │
     │                (senão o arquivo fica órfão na cota da escola)        │
```

As decisões que o desenho carrega:

- **O id é sorteado antes do upload.** Sem isso, o anexo subiria para uma pasta
  temporária e precisaria ser movido depois — e "depois" é onde mora o arquivo
  órfão. Se o aluno fechar o modal sem concluir, o anexo já enviado é apagado na
  hora.
- **O nome do arquivo são 16 bytes sorteados**, e não `Date.now()`: o relógio
  das máquinas de laboratório está errado, e uma turma que envia print no mesmo
  minuto colidiria — colidir no Storage é sobrescrever o print de outra pessoa,
  em silêncio.
- **`horario` é `serverTimestamp()`, e a rule exige `request.time`.** É a
  autoridade de tempo do sistema inteiro
  ([`adr/0004-serverTimestamp-como-autoridade-de-tempo.md`](adr/0004-serverTimestamp-como-autoridade-de-tempo.md)).
  Sem ela, adiantar o relógio da máquina furaria a fila.
- **`horarioIso` e a `imagem` em string continuam sendo gravados.** São os
  campos que um cliente da v0.1.0 lê. A v1.0.0 decidiu **mantê-los** — ver § 6 e
  a entrada da versão em [`HISTORICO.md`](HISTORICO.md).
- **A exclusão só vai ao banco quando a janela de desfazer fecha.** Gravar antes
  e restaurar depois exigiria recriar o documento com outro id e ressubir o
  anexo, que já teria saído do Storage. Fechar a aba no meio da janela
  **confirma** a exclusão: quem pediu, pediu — fechar a aba não é desfazer.
- **O aluno apaga só o dele; o dono da sala apaga qualquer um.** Imposto pela
  rule, e não pela ausência do botão.
