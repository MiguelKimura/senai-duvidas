# ADR 0010 — Modelo de perks, ordenação da fila e o "agora" com piso no servidor

- **Status:** aceita
- **Data:** 2026-09-22
- **Versão:** 0.9.0
- **Contexto da task:** `tasks/07-perks.md`
- **Critérios:** AC-PERK-01 a AC-PERK-10, AC-CHAMADO-03, AC-SEC-03, AC-PERF-03

## Contexto

O cliente pediu, com estas palavras:

> "Opção do professor dar perks aos alunos (ex.: prioridade no atendimento).
> Isso não é essencial agora, mas queria perks tipo o do Call of Duty, pra ter
> animações legais, e funcionaria como uma premiação que o professor pode dar a
> um aluno."

O pedido parece ser sobre animação. Não é. Ele é sobre **reconhecimento
público**, e a animação é a forma que o cliente conhece de fazer
reconhecimento parecer importante. Quem implementa a animação e esquece a
insígnia, a vitrine e a auditoria entrega o efeito sem o valor.

Ao mesmo tempo, um dos quatro tipos de perk — "Prioridade no Atendimento" —
mexe na **fila de atendimento** de uma turma de 40 pessoas. A partir do momento
em que a ordem da fila deixa de ser "quem chegou primeiro", ela precisa ser
defensável: qualquer não determinismo vira discussão em sala, e qualquer brecha
de cliente vira aluno furando fila.

Quatro decisões saíram disso, e três delas não são sobre interface.

## Decisão

### 1. O perk é um documento na sala, e revogar é um campo — nunca um `delete`

```
salas/{salaId}/perks/{perkId}
  alunoUid, alunoNome
  tipo: "prioridade" | "destaque" | "colaborador" | "resolvedor"
  nivel: 1..3
  justificativa: string | null
  anunciarParaSala: bool
  concedidoPor, concedidoPorNome
  concedidoEm  (serverTimestamp)
  expiraEm     (timestamp | null)   <- null = permanente
  revogadoEm   (timestamp | null)
  visualizadoEm(timestamp | null)   <- o recibo da animação

salas/{salaId}/auditoriaPerks/{eventoId}   <- append-only
  acao, perkId, alunoUid, atorUid, em, detalhes
```

O perk vive **dentro da sala** porque é lá que a autorização mora: ser
professor no SENAI não é ser professor desta turma, e a rule pergunta pelo dono
**desta** sala (ADR 0005 e AC-SEC-02).

`delete` está negado na rule. A vitrine do aluno mostra o histórico dos perks
vencidos, e apagar o documento reescreveria o passado da turma — a premiação de
março continua tendo acontecido em novembro. Revogar tira o perk da fila e o
move de coluna; não o apaga.

### 2. A ordenação é uma função pura, com o desempate por `chamadoId`

`ordenarFila(chamados, perksPorUid, agoraServidor)` em
`src/services/filaChamados.js`, nesta ordem exata:

1. não atendidos antes dos atendidos;
2. prioridade do autor, **decrescente** (sem perk ativo = faixa 0);
3. horário do servidor, **crescente**, dentro da faixa;
4. `chamadoId` **crescente**.

O passo 4 é o que torna a fila defensável. Dois chamados podem sair do servidor
com o mesmo `Timestamp`, e sem um desempate a ordem viria da ordem do snapshot
— que não é garantida e pode diferir entre a tela do professor e a do aluno. A
comparação é por ponto de código, e não `localeCompare`: o resultado deste
último depende da tabela ICU embarcada no navegador, e o Chrome do laboratório
poderia discordar do Firefox do professor sobre dois ids.

A faixa é o **maior** nível entre os perks de prioridade ativos, e não a soma:
somar transformaria três perks de nível 1 num nível 3 e tiraria do professor o
controle da escala que ele mesmo definiu.

Consequência assumida: **dois chamados com o mesmo horário trocaram de ordem em
relação à v0.8.0**, onde a ordem era a de chegada do snapshot. É o preço do
determinismo, e a ordem antiga nunca foi garantida — só era estável por
acidente.

### 3. O "agora" que julga validade tem piso no maior carimbo do servidor já visto

Esta é a decisão menos óbvia e a mais importante para o AC-SEC-03.

Um perk de prioridade vence por data. Comparar essa data com `new Date()`
devolveria a decisão ao relógio da máquina — que, nos laboratórios, está errado
com frequência e é editável por qualquer aluno. Atrasar o Windows em dois dias
reviveria um perk vencido, e a fila passaria a premiar quem mexe no painel de
controle.

O caminho óbvio seria perguntar as horas ao servidor. Ele não existe: o SDK do
Firestore não expõe o relógio do servidor, e uma API externa de horário seria
falsificável do mesmo jeito, porque quem aplicaria a resposta continuaria sendo
o cliente.

O que existe é um **piso**. Todo `Timestamp` que chegou do banco foi carimbado
pelo servidor, logo o servidor comprovadamente já passou por aquele instante.
`agoraDoServidor(carimbos, relogioLocal)` devolve o maior entre os dois, e a
assimetria resultante é exatamente a desejada:

- atrasar o relógio **não ajuda** — o piso vence, e o perk continua vencido;
- adiantá-lo **só encurta** o perk de quem adiantou.

Limite conhecido e aceito: numa sala em silêncio absoluto, sem nenhuma escrita
nova, o piso envelhece junto com o último carimbo lido, e um relógio atrasado
pode esticar o perk até ali. Em aula, o piso é de segundos atrás — qualquer
chamado, mensagem ou premiação da sala o atualiza.

### 4. Uma consulta de perks por sala, nunca uma por card

`usePerksDaSala` abre **um** `onSnapshot` sobre `salas/{salaId}/perks`, com
`orderBy('concedidoEm', 'desc')` e `limit(120)`, e entrega um índice por uid
que a fila, a insígnia, a vitrine e o painel consultam em memória.

A expiração **não** entra na consulta. `where('expiraEm', '>', agora)` deixaria
de fora justamente os perks permanentes, cujo `expiraEm` é nulo, e ainda
devolveria o filtro ao relógio do cliente. Quem julga validade é
`perkEstaAtivo`, contra o instante do item 3.

O caminho descartado era resolver o perk dentro do card: cada card conhece o
`autorUid`, e uma leitura ali seria a linha mais curta de escrever. Seriam 200
leituras por abertura do app no alvo declarado, por aluno, em cada uma das 10
salas (AC-PERF-03).

## Consequências

**Boas**

- A fila produz a mesma lista em todo dispositivo, e a regra que a produz é uma
  função pura, testada com 1000 embaralhamentos.
- Sala sem perk nenhum — toda sala existente no dia do deploy — se comporta
  exatamente como na v0.8.0.
- Adiantar ou atrasar o relógio local não concede privilégio nenhum.
- A auditoria e a premiação são uma escrita só (`writeBatch`): não existe estado
  em que o privilégio exista e o registro dele não.

**Ruins, e assumidas**

- **A `justificativa` é legível por toda a turma.** As rules do Firestore não
  escondem campo: quem pode ler o documento lê todos os campos dele. O
  `anunciarParaSala` controla o que a **interface** exibe, não o que o banco
  entrega. O professor precisa saber disso ao escrever a justificativa, e o
  `docs/MANUAL-PROFESSOR.md` diz isso com todas as letras.
- **Dois chamados de mesmo horário podem ter trocado de posição** em relação à
  v0.8.0 (item 2).
- **O piso do "agora" envelhece numa sala parada** (item 3).
- **A expiração não é um evento.** Nenhum processo marca o perk como expirado no
  servidor; ele simplesmente deixa de contar na leitura. A ação `"expirar"` está
  prevista na auditoria e nenhuma escrita a produz ainda — ela existe para
  quando houver uma Cloud Function, que este projeto não tem.

## Alternativas descartadas

- **Perk no documento do usuário** (`usuarios/{uid}.perks`): tornaria o perk
  global à escola, quando ele é um gesto de uma turma. E a rule teria de
  autorizar um professor a escrever no documento de outro usuário, que é
  exatamente o caminho de escalada que o ADR 0003 fechou.
- **Prioridade como campo do chamado** (`chamados/{id}.prioridade`): seria mais
  simples de ordenar e erraria o requisito. O perk é da **pessoa** e vale para
  os chamados que ela ainda vai abrir; copiá-lo para o chamado exigiria
  reescrever todos os chamados dela a cada concessão e a cada expiração.
- **Ordenar no Firestore** (`orderBy('prioridade')`): exigiria o campo no
  chamado (acima) e um índice composto, e ainda assim não resolveria a
  expiração, que depende de comparação com um instante.
- **Apagar o perk ao revogar:** destruiria o histórico da vitrine (item 1).
