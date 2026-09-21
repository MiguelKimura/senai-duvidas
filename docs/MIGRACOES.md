# Migrações de dados

> Uma seção por migração, com o procedimento de execução e o de rollback.
> Escrito para ser seguido por quem está com o laboratório cheio e pressa.

## Regras que valem para todas

1. **Nada roda sem `--dry-run` antes.** O `--dry-run` imprime exatamente o que
   a execução faria e não grava uma linha.
2. **Toda migração é idempotente.** Rodar duas vezes seguidas não duplica nada.
   Uma execução interrompida no meio termina na seguinte.
3. **Nenhuma migração apaga a fonte** na mesma versão em que copia. O dado
   antigo é o backup, e ele só sai quando o app novo estiver rodando há tempo
   suficiente para se confiar nele.
4. **Rode fora do horário de aula.** As migrações escrevem documento por
   documento e gastam cota; um laboratório em uso no mesmo minuto sente.

---

## `scripts/migrar-horarios.js` — v0.4.0 (task 02)

Preenche `horarioIso` onde falta, para que um cliente antigo consiga ler o
`horario` que passou a ser `Timestamp` do servidor.

```bash
node scripts/migrar-horarios.js --dry-run
node scripts/migrar-horarios.js --confirmar
node scripts/migrar-horarios.js --colecao chamados --confirmar
```

**Rollback:** apagar o campo `horarioIso`. Nada depende dele — `horario`
continua intacto e é ele que ordena a fila.

---

## `scripts/migrar-para-salas.js` — v0.5.0 (task 03)

A maior migração do roadmap. Leva os `chamados` e o `chat` globais para dentro
de uma sala, para que o app novo não abra vazio para quem tem histórico.

### O que ela faz

1. Cria a sala **`Turma Geral {ano}`**, do professor mais ativo do acervo — ou
   do UID passado em `--professor`.
2. Copia todos os `chamados` e todas as mensagens de `chat` para
   `salas/{salaId}/chamados` e `salas/{salaId}/chat`, **preservando os IDs**.
3. Cria `salas/{salaId}/membros/{uid}` para cada autor distinto que tenha
   cadastro em `usuarios`.
4. Marca cada documento copiado com `migradoDe`.
5. **Não apaga nada** das coleções globais.

### O que ela NÃO faz

**Não gera PIN.** Um PIN em claro num log de operação acaba no histórico do
terminal, no CI e no print que alguém manda no grupo — é exatamente o que o
AC-SEC-05 proíbe. A sala nasce sem PIN e **ninguém consegue entrar nela pelo
PIN** até que o professor dono abra `/salas` e clique em **"Gerar novo PIN"**,
que é o único lugar onde o número aparece, uma vez, para quem é dono.

Isso é parte do procedimento, não um detalhe: sem esse passo a sala existe, os
membros migrados entram normalmente, e ninguém novo consegue entrar.

### Procedimento

```bash
# 1. Veja o que aconteceria. Confira, sobretudo, quem foi escolhido como dono.
node scripts/migrar-para-salas.js --dry-run

# 2. Se o dono escolhido não for quem deveria, passe o UID à mão.
node scripts/migrar-para-salas.js --dry-run --professor <uid-do-professor>

# 3. Rode de verdade.
node scripts/migrar-para-salas.js --confirmar --professor <uid-do-professor>

# 4. Rode de novo. A saída deve dizer que tudo "já estava na sala" —
#    é assim que se comprova a idempotência no banco de verdade.
node scripts/migrar-para-salas.js --confirmar --professor <uid-do-professor>

# 5. Entre no app como o professor dono, abra /salas e clique em
#    "Gerar novo PIN". Anote o número: ele não volta.
```

Opções: `--ano 2026` escolhe o ano letivo da sala (padrão: o ano corrente).

### Rollback

```bash
node scripts/migrar-para-salas.js --reverter --dry-run
node scripts/migrar-para-salas.js --reverter --confirmar
```

A reversão apaga **apenas** os documentos marcados com `migradoDe` dentro da
sala. O que a turma escreveu depois da migração fica: ele não tem backup em
lugar nenhum. As coleções globais não são tocadas em momento algum — elas são o
backup, e é por isso que voltar à v0.4.0 é só fazer o deploy da versão
anterior.

O documento da sala em si **não** é apagado pela reversão: ela pode já ter PIN
gerado e alunos que entraram por ele depois da migração. Se a sala precisar
mesmo desaparecer, apague-a à mão depois de conferir a lista de membros.

### Se algo der errado no meio

Uma falha em um documento não interrompe os outros: o script vai até o fim e
lista o que não deu no relatório, com o caminho e o erro de cada um. Rode de
novo — os que já foram não são recopiados, e os que faltaram são tentados
outra vez. Migração que para no meio deixa o banco num estado que ninguém sabe
descrever; esta não para.

### Quando as coleções globais somem

Na **1.0.0**, junto com o fallback de leitura, com as rotas `/aluno` e
`/professor` e com o campo `nome` dos documentos. Até lá, o app lê a coleção
global de quem não está em sala nenhuma, e é isso que mantém a tela útil para
quem abrir o app no meio da migração.

---

## `scripts/migrar-anexos.js` — v0.6.0 (task 04)

Preenche o campo `anexo` a partir do `imagem` antigo, nos chamados que só têm o
formato da v0.1.0.

### Esta migração é OPCIONAL — leia antes de rodar

**Nada quebra se ela nunca rodar.** O app lê os dois formatos sozinho: é o que
`normalizarAnexo` faz em `src/services/anexos.js`, permanentemente nesta
versão. O chamado aberto em março continua exibindo o print dele depois do
deploy, sem que este script toque no banco.

O que ela compra é **homogeneidade**. Com `anexo` preenchido em todo documento,
a 1.0.0 — que para de gravar `imagem` — não precisa de uma migração no dia do
deploy, com o laboratório em aula. É a etapa do meio da migração em duas fases
da seção 4 do `tasks/_PROTOCOLO.md`:

```
v0.6.0: escrever nos dois formatos  →  este script: migrar  →  1.0.0: parar de escrever no antigo
```

Se houver qualquer dúvida sobre o estado do banco, **não rodar é uma decisão
válida**. Rodar em novembro, com as salas do ano fechando, é melhor que rodar
em março.

### O que ela faz

1. Lê a coleção de chamados.
2. Para cada documento que tem `imagem` em string **e não tem** `anexo`, grava
   `anexo: { url: <a mesma URL>, origem: 'url' }`.
3. Deixa em paz quem já tem `anexo`, quem não tem imagem nenhuma e quem tem em
   `imagem` algo que não é endereço — campo sujo existe: alguém colou a
   descrição do erro no lugar do link, e copiar aquilo só espalharia o problema
   para o formato novo. Os três casos aparecem separados no relatório.

### O que ela NUNCA faz

**Não toca em `imagem`.** Nem para alterar, nem para apagar, em nenhum modo —
inclusive na reversão. `imagem` é o campo que todo cliente já aberto no
laboratório procura e é o backup vivo do `anexo` que o script deriva. Ele sai
na 1.0.0, por outro caminho.

A gravação é `update` de um campo só, nunca `set`: `set` sem merge apagaria o
documento inteiro.

### Execução

```bash
node scripts/migrar-anexos.js --dry-run
node scripts/migrar-anexos.js --confirmar
node scripts/migrar-anexos.js --colecao salas/sala-3b/chamados --confirmar
```

Sem `--dry-run` e sem `--confirmar`, o script não faz nada e diz isso: o padrão
seguro de um script que escreve em produção não pode ser escrever.

`--colecao` pode ser repetido. Sem ele, a coleção é `chamados` — a global da
v0.4.0. **Os chamados dentro de salas exigem `--colecao` explícito**, um por
sala: o script não varre `salas/` atrás de subcoleções, de propósito, para que
ninguém dispare uma passada pela escola inteira sem ter dito qual escopo queria.

### Rollback

```bash
node scripts/migrar-anexos.js --reverter --dry-run
node scripts/migrar-anexos.js --reverter --confirmar
```

A reversão apaga o campo `anexo` **apenas** dos documentos em que ele tem
`origem: 'url'` e não tem `caminho` — ou seja, exatamente o que este script
cria, e cujo original continua em `imagem` ao lado.

**Anexo de origem `upload` não é tocado.** Ele não veio de `imagem`: nasceu
assim, e o `caminho` dele é a única pista que a exclusão do chamado tem para
não deixar arquivo órfão no Storage (AC-CHAMADO-08). Apagá-lo pagaria aquele
arquivo para sempre.

Há um rollback ainda mais simples e que quase sempre é o certo: **não fazer
nada**. Um `anexo` a mais num documento não incomoda ninguém — a v0.5.0 o
ignora, e a v0.6.0 o prefere, com o mesmo resultado na tela.

### Idempotência

"Já migrei este documento?" é a pergunta "ele já tem `anexo`?". Quem tem fica
de fora do plano, então a segunda rodada não tem o que fazer e uma rodada
interrompida no meio termina na seguinte. Uma falha em um documento não
interrompe os outros: o script vai até o fim e lista o id e o motivo de cada
uma no relatório.
