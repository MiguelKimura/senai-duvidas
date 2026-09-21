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
  autorUid, autorNome, nome, email, descricao, cor, imagem,
  horario (Timestamp do servidor), horarioIso, atendido, atendidoEm

salas/{salaId}/chat/{mensagemId}
  autorUid, autorNome, nome, email, texto, horario, horarioIso

usuarios/{uid}/salas/{salaId}       <- espelho, só para montar a lista
  salaId, papel, entrouEm

indicePins/{pin}                    <- `get` de documento específico, nunca `list`
  salaId, ativo, criadoEm

tentativasPin/{uid}                 <- o limite de força bruta (AC-SALA-12)
  tentativas, janelaIniciadaEm, ultimaTentativaEm, pinTentado
```

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

Cada linha tem, em `tests/rules/salas.rules.test.js`, um teste de permissão
**concedida** e um de **negada**. Sem o par, um `allow ... if false` acidental
passaria despercebido: a suíte ficaria verde com o app quebrado.

## 5. Custo de leitura (AC-PERF-06)

Alvo declarado do projeto: 10 salas ativas, 40 alunos por sala, 200 chamados e
1000 mensagens por sala.

| Listener | Corte | Leituras por abertura |
|---|---|---|
| Fila de chamados | `limit(200)` | ≤ 200 |
| Conversa da sala | `limit(300)` | ≤ 300 |
| Lista de salas (espelho) | `limit(20)` | ≤ 20 |
| Membros (só o dono) | `limit(60)` | ≤ 60 |

Nenhum `onSnapshot` escuta coleção inteira sem corte. Com 40 alunos abrindo o
app duas vezes por aula, uma sala custa cerca de 40 000 leituras por dia letivo
— dentro do plano gratuito (50 000/dia) para o uso previsto, e o que o
aproxima do teto é o chat, não a fila. Se o limite apertar, o próximo passo é
paginar a conversa por data em vez de aumentar a cota.

## 6. Compatibilidade

**Retroativa.** Sem `salaId`, `TelaAluno`, `TelaProfessor` e `Chat` leem as
coleções globais da v0.4.0. As rotas `/aluno` e `/professor` continuam no mapa
e são exatamente esse caso. É o que impede a tela vazia para quem abrir o app
antes de entrar em sala alguma, ou no meio da migração.

**Futura.** Todo documento novo grava `autorNome` **e** `nome`, com o mesmo
conteúdo, e `autorUid` ao lado de `email`. Um cliente da v0.4.0 com a aba
aberta continua exibindo quem abriu o chamado. `nome` só é removido na 1.0.0 —
a segunda etapa da migração em duas fases exigida pelo protocolo.

## 7. O que a task 03 deixou preparado para as próximas

- **Task 04 (imagens):** `caminhoDoAnexo(salaId, chamadoId, nome)` já devolve
  `salas/{salaId}/chamados/{chamadoId}/{nome}` no Storage, e a rule de Storage
  já abre esse caminho exigindo sessão, tipo de imagem e tamanho. O que falta
  ali é a checagem de que quem envia é membro da sala — ela depende de
  `firestore.exists()` e está marcada com `TODO(task-04)` em `storage.rules`,
  junto do caminho legado `imagens/{arquivo}`, que continua aberto porque
  fechá-lo antes de existir a tela nova quebraria produção.
- **Task 06 (chat/DM):** as conversas privadas entram como
  `salas/{salaId}/conversas/{conversaId}`.
- **Task 07 (perks):** `salas/{salaId}/perks/{uid}`.
