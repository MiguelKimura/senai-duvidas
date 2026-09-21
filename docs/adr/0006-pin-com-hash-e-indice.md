# ADR 0006 — PIN com resumo, sal e índice de leitura pontual

- **Status:** aceita
- **Data:** 2026-09-21
- **Versão:** 0.5.0
- **Contexto da task:** `tasks/03-salas-pin.md`
- **Critérios:** AC-SALA-02, AC-SALA-03, AC-SALA-04, AC-SALA-09, AC-SALA-12, AC-SEC-05

## Contexto

O cliente pediu entrada por **PIN de 6 dígitos**: o professor dita o número, o
aluno digita, está dentro. É a interação certa para o laboratório — não exige
convite por e-mail, nem lista de matrícula, nem que o professor saiba o e-mail
de quarenta alunos.

Seis dígitos são **um milhão** de combinações. Isso é pouco para um atacante
com um script e muito para alguém adivinhar de primeira. O modelo precisa
sobreviver às duas coisas.

Três perguntas precisavam de resposta:

1. Onde guardar o PIN, sabendo que **as rules do Firestore não escondem
   campo**: quem lê o documento lê todos os campos dele.
2. Como o aluno descobre **qual sala** é a do PIN que ele digitou, sem poder
   varrer as salas.
3. Como impedir que alguém teste os um milhão de números.

## Decisão

### 1. O PIN nunca é gravado em claro

`salas/{salaId}/segredo/pin` guarda `hash = SHA-256(sal + pin)` e o `sal`,
aleatório por sala. **Só o dono da sala lê esse documento.**

O segredo mora numa subcoleção, e não no documento da sala, exatamente porque
rule não esconde campo: se o resumo morasse em `salas/{salaId}`, os quarenta
alunos da turma o leriam junto com o nome da sala — e seis dígitos com resumo
em mãos caem por força bruta **offline**, sem tocar no servidor, em segundos.

O professor vê o número **uma vez**, na criação ou na regeração. Ele fica na
memória da aba para ser copiado e some com a navegação. Perdeu, regera.

### 2. `indicePins/{pin}` responde "qual sala?", sem permitir varredura

O ID do documento **é** o PIN. A rule permite `get` — leitura de um documento
específico — e **nega `list`**. Não há consulta que devolva os PINs existentes:
é preciso já saber o número para perguntar por ele.

### 3. Quem confere o PIN é o servidor

A rule de `membros/{uid}` refaz `hashing.sha256(sal + pin)` com o sal da sala e
compara com o resumo. O cliente propõe a entrada; o servidor aceita ou nega. O
cliente **nunca** lê o segredo, e por isso um cliente adulterado não ganha nada.

É essa escolha que faz a regeração funcionar: o PIN antigo para de servir
porque o resumo gravado mudou, sem que ninguém precise guardar o número velho
em lugar nenhum (AC-SALA-09).

### 4. A unicidade sai da recusa, não de uma consulta

A rule de `indicePins` permite apenas `create`. Sortear um PIN e tentar criar o
documento é a reserva: se o número já estiver em uso, a escrita é negada — e a
recusa **é** o sinal de colisão. O cliente sorteia outro, até oito vezes.

Conferir antes com um `get` seria pior: daria a qualquer pessoa um jeito de
descobrir, um número por vez, quais PINs existem.

### 5. Tentativas limitadas pelo servidor (AC-SALA-12)

`tentativasPin/{uid}` guarda o contador e o início da janela. A rule valida:
até 5 tentativas em 5 minutos, e a janela só pode ser reiniciada depois de
vencida — pelo relógio do **servidor**, `request.time`.

O cliente não calcula a janela. Ele propõe duas escritas — somar 1 à janela
corrente e, se negada, começar uma janela nova — e a recusa das duas é o
bloqueio. Calcular a janela no cliente faria o relógio errado de uma máquina de
laboratório (o problema que a task 02 documentou) bloquear aluno que não fez
nada.

A leitura do índice exige uma tentativa recém-contada, gravada no mesmo
documento (`pinTentado`). Sem essa amarra, o contador seria decoração: daria
para consultar o índice à vontade sem nunca contar tentativa.

### 6. A recusa é sempre a mesma frase

PIN inexistente, PIN de sala arquivada, PIN regerado e PIN de sala que não
aceita mais ninguém produzem **a mesma mensagem**, vinda do mesmo lugar. Um
ramo a mais na tela seria um oráculo respondendo "este número é PIN de
alguém?" — e com um milhão de perguntas, um oráculo é uma lista (AC-SALA-04).

## Consequências

**Boas**

- Nenhum PIN em claro no banco, nos logs ou em qualquer resposta a quem não é
  dono da sala (AC-SEC-05).
- Varrer o índice é impossível pela rule, e não por obscuridade.
- A força bruta online é limitada pelo servidor, com relógio do servidor.

**Ruins, e aceitas**

- **PIN perdido não se recupera.** É consequência direta de não guardar o
  número; a tela avisa, e regerar é um clique.
- **O índice do PIN antigo continua existindo** depois da regeração, apontando
  para a sala. Ele não serve para entrar — o resumo não confere mais —, e
  apagá-lo exigiria conhecer o número antigo, que ninguém guarda. O custo é um
  documento órfão por regeração, e um PIN a menos no espaço de um milhão.
- **A migração não gera PIN.** O script não pode imprimir um PIN em claro num
  log; a sala migrada nasce sem PIN e o professor gera o dele no app. Está no
  procedimento em `docs/MIGRACOES.md`.
- **SHA-256 sem alongamento de chave.** Para seis dígitos, um `bcrypt` no
  cliente não resolveria o problema real: o espaço é pequeno o bastante para
  que a defesa seja o resumo ficar longe de quem não é dono, e não o custo de
  computá-lo. É por isso que o segredo mora numa subcoleção fechada.

## Limites conhecidos

A defesa contra força bruta é por usuário autenticado (`tentativasPin/{uid}`).
Um atacante com muitas contas contorna o limite criando contas novas. Fechar
isso exige um contador por IP ou por sala, que as rules não conseguem manter
sozinhas. A proposta, quando doer, é uma Cloud Function que faça a conferência
do PIN e mantenha o contador — o modelo já está desenhado para essa troca, já
que quem confere hoje também é o servidor.
