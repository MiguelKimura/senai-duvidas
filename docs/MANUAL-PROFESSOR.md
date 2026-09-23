# Manual do professor

> Versão 0.9.0. Este manual cobre, por enquanto, **as premiações (perks)**.
> Salas, PIN e moderação entram aqui na 1.0.0 (AC-DOC-04).

## O que são as premiações

Uma premiação é um reconhecimento que **você** dá a um aluno da **sua** sala.
Ela aparece para o aluno numa tela cheia, vira uma insígnia ao lado do nome
dele no card do chamado e no chat, e fica guardada na vitrine "Minhas
conquistas" dele — inclusive depois de vencer.

Existem quatro tipos:

| Tipo | Para quê | Mexe na fila? |
|---|---|---|
| **Prioridade no Atendimento** | Quem você quer atender antes | **Sim** |
| **Destaque da Aula** | Reconhecimento do dia | Não |
| **Colaborador** | Quem ajudou um colega | Não |
| **Resolvedor** | Quem resolveu sozinho | Não |

Só **Prioridade no Atendimento** muda a ordem da fila. Os outros três são
reconhecimento puro, e isso é de propósito: se toda premiação furasse a fila,
você não teria como elogiar quem ajudou um colega sem, de quebra, atrasar o
atendimento de outra pessoa.

Cada premiação tem um **nível de 1 a 3**. No caso da prioridade, o nível é a
faixa: nível 2 é atendido antes de nível 1, que é atendido antes de quem não
tem perk. Dentro da mesma faixa, continua valendo quem chegou primeiro.

## Como conceder

1. Abra a sua sala. O painel **Premiações** aparece logo acima da fila — só
   para o dono da sala.
2. Escolha o aluno, o tipo e o nível.
3. Escolha a **validade**: 1, 7 ou 30 dias, ou "sem validade (permanente)".
4. Escreva a **justificativa** (opcional, até 280 caracteres).
5. Clique em **Conceder premiação**.

A confirmação aparece na hora. O aluno vê a premiação em tela cheia na próxima
vez que abrir a sala — **uma vez só**; ela não repete a cada recarga.

## Quando conceder — e quando não

A premiação vale pelo que ela reconhece, não pela mecânica. Ela funciona quando
o aluno consegue dizer **o que fez** para ganhá-la, e é por isso que a
justificativa importa mais do que o tipo.

**Bons momentos:** o aluno que parou o próprio trabalho para desatolar o
colega; quem entregou no prazo depois de uma sequência de atrasos; quem chegou
sozinho na causa de um erro em vez de pedir a resposta pronta.

**Cuidados:**

- **Prioridade tem custo.** Toda prioridade que você concede empurra alguém para
  baixo na fila. Use prazo curto (1 ou 7 dias) e reserve-a para quando ela
  significar alguma coisa.
- **Premiar sempre os mesmos esvazia o gesto.** A vitrine do aluno é pública
  para ele, mas a turma percebe o padrão de qualquer jeito.
- **Nível 3 permanente é quase sempre demais.** Ele não vence nunca, e você vai
  precisar revogar à mão para desfazer.

## A justificativa é visível para a turma inteira

Leia esta seção antes de escrever a primeira justificativa.

A caixa **"Anunciar para a sala"** controla o que a interface **exibe** para os
colegas. Ela **não** esconde o texto do banco de dados: as regras de segurança
do Firestore liberam ou bloqueiam o documento inteiro, nunca campo por campo, e
qualquer aluno da sala com conhecimento técnico consegue ler a justificativa de
qualquer premiação da turma.

Na prática: **escreva a justificativa como se a turma fosse ler**, porque ela
pode. Não escreva nela nada sobre a vida particular do aluno, nota, diagnóstico,
situação familiar ou qualquer coisa que você não diria em voz alta na sala.

Se precisar registrar algo reservado, não use a justificativa — use o canal que
a escola já usa para isso.

## Como revogar

No mesmo painel, cada premiação ativa tem um botão **Revogar**.

Revogar **não apaga** a premiação. Ela some da fila e da insígnia na hora, e
passa para o histórico da vitrine do aluno, marcada como revogada. Isso é
deliberado: apagar reescreveria o passado da turma.

Toda concessão e toda revogação ficam registradas com quem fez, para quem,
quando e por quê. O registro não pode ser alterado nem apagado por ninguém —
nem por você.

## Perguntas frequentes

**O aluno pode dar perk a si mesmo?**
Não. Isso é bloqueado no servidor, não na tela: mesmo adulterando o navegador,
a escrita é recusada.

**E um professor de outra sala?**
Também não. Quem concede é o dono **daquela** sala.

**O aluno pode esticar o perk mexendo no relógio do computador?**
Não. A validade é conferida contra o horário do servidor, e não contra o
relógio da máquina. Atrasar o relógio não revive um perk vencido; adiantá-lo só
encurta o perk de quem adiantou.

**A animação atrapalha a aula. Dá para desligar?**
Dá, de três formas: o aluno tem o botão **Pular** (sempre visível) e a tecla
`Esc`; ele pode desmarcar "Mostrar a animação de premiação em tela cheia" nas
preferências da sala; e, se o sistema operacional dele estiver com
`prefers-reduced-motion` ligado, a premiação já vira um card parado
automaticamente.

**E o som?**
O som nasce **desligado** e só toca se o aluno ligar nas preferências. Nenhuma
premiação toca áudio sozinha no primeiro carregamento.

**O que acontece numa sala arquivada?**
Não é possível conceder nem revogar. As premiações que já existem continuam
visíveis na vitrine.

## Para quem quiser o detalhe técnico

As decisões de modelagem, ordenação da fila e validade estão em
[`docs/adr/0010-modelo-de-perks-e-ordenacao-da-fila.md`](adr/0010-modelo-de-perks-e-ordenacao-da-fila.md).
