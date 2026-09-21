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
