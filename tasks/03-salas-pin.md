---
id: 03-salas-pin
titulo: "Salas do professor com entrada por PIN e escopo de dados"
versao_origem: 0.4.0
versao_alvo: 0.5.0
tipo: feat
escopo_commit: salas
branch: "feat/salas-com-pin"
branch_base: "dev"
depende_de: [00-fundacao-testes, 01-auth-oauth-sessao, 02-tempo-brasilia]
criterios: [AC-SALA-01, AC-SALA-02, AC-SALA-03, AC-SALA-04, AC-SALA-05, AC-SALA-06, AC-SALA-07, AC-SALA-08, AC-SALA-09, AC-SALA-10, AC-SALA-12, AC-SEC-01, AC-SEC-02, AC-SEC-05, AC-PERF-03, AC-PERF-04, AC-PERF-06]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: critico
observacao: "Maior migração do roadmap. Dados globais passam a ser escopados por sala."
---

# Você é o engenheiro responsável pela task 03 — Salas com PIN

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md` e todo o `src/`.
Tasks 00, 01 e 02 entregaram harness, `AuthContext` único e `services/tempo.js`.
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O problema que você está resolvendo

Hoje `chamados` e `chat` são coleções **globais**: todo aluno de todo curso vê as dúvidas e as
conversas de todo mundo. Um professor de mecânica vê as dúvidas de informática; um aluno do
noturno vê o chat do matutino. Não há como o professor organizar sua turma.

A solução pedida pelo cliente: o professor cria **salas**, e o aluno entra digitando um **PIN**.
Uma sala vale o **ano letivo inteiro** — o aluno digita o PIN uma vez em fevereiro e continua na
sala em novembro.

Esta é a maior migração do roadmap. Trate o modelo de dados com o cuidado de quem vai migrar
dados reais de alunos reais no meio de um semestre.

## Critérios de aceite deste escopo

- AC-SALA-01 — professor cria sala com nome, curso/turma e ano letivo.
- AC-SALA-02 — PIN numérico de **6 dígitos**, gerado automaticamente, único entre salas ativas.
- AC-SALA-03 — professor vê o PIN em destaque e copia com um clique.
- AC-SALA-04 — aluno entra digitando o PIN; PIN inválido dá erro claro **sem revelar** se aquele
  PIN existe em outra sala.
- AC-SALA-05 — sala vale o ano letivo inteiro: campo `anoLetivo`, ativa até ser arquivada.
- AC-SALA-06 — depois de entrar uma vez, o aluno não redigita o PIN; o vínculo fica em
  `salas/{salaId}/membros/{uid}`.
- AC-SALA-07 — chamados e chat **escopados por sala**: aluno da sala A nunca vê dados da sala B.
- AC-SALA-08 — professor vê suas salas com contagem de membros e de chamados abertos.
- AC-SALA-09 — professor remove aluno e **regera o PIN**, invalidando o anterior.
- AC-SALA-10 — professor arquiva a sala ao fim do ano; arquivada fica somente-leitura e não aceita
  novas entradas.
- AC-SALA-12 — tentativas de PIN limitadas (5 erros em 5 minutos por usuário) contra força bruta.
- AC-SEC-01 — rules negam tudo por padrão e liberam caminho a caminho.
- AC-SEC-02 — ninguém lê nem escreve dados de sala à qual não pertence (provado por teste de rules).
- AC-SEC-05 — PIN nunca chega a quem não é dono da sala, em nenhuma resposta do banco.
- AC-PERF-03 — nenhum `onSnapshot` em coleção inteira sem `where` + `limit`.
- AC-PERF-04 — todo listener cancelado no unmount.
- AC-PERF-06 — custo de leitura dentro do plano gratuito para 10 salas ativas.

## Modelo de dados

```
salas/{salaId}
  nome, curso, anoLetivo, professorUid, professorNome
  criadaEm (serverTimestamp), arquivadaEm | null, ativa: boolean
  pinHash        <- NUNCA o PIN em claro
  pinAtualizadoEm
  totalMembros   <- contador desnormalizado

salas/{salaId}/membros/{uid}
  nome, email, papel: "aluno" | "professor", entrouEm

salas/{salaId}/chamados/{chamadoId}
  autorUid, autorNome, descricao, cor, imagem, horario, atendido: boolean, atendidoEm

salas/{salaId}/chat/{mensagemId}
  autorUid, autorNome, texto, horario

indicePins/{pin}        <- doc só de escrita/leitura pelo servidor de rules
  salaId, ativo
```

**Sobre o PIN:** 6 dígitos numéricos dão 1 milhão de combinações — pouco para força bruta, muito
para alguém adivinhar de primeira. Então:

1. Guarde `pinHash` (SHA-256 com salt por sala), nunca o PIN em claro no documento da sala.
2. O professor vê o PIN **uma vez**, no momento da criação ou da regeração — o app mantém em
   memória para copiar, e o campo em claro nunca é persistido (AC-SEC-05).
3. `indicePins/{pin}` permite a entrada do aluno por lookup, e a rule desse caminho permite
   **apenas `get` de documento específico** — nunca `list`, o que impediria varrer o índice.
4. A limitação de tentativas (AC-SALA-12) fica em
   `tentativasPin/{uid}` com contador e janela, validada por rule.

Se o modelo de rules do Firestore não permitir um desses passos com segurança suficiente,
documente o limite em `docs/BLOQUEIOS.md`, implemente a alternativa mais segura possível no cliente
e proponha uma Cloud Function no PR. **Não** entregue o PIN em claro legível por qualquer usuário.

## Escopo de rota e navegação

```
/                    login
/salas               lista de salas do usuário (aluno e professor)
/salas/entrar        aluno digita o PIN
/salas/nova          professor cria sala
/sala/:salaId        tela da sala (chamados + chat), renderiza aluno ou professor pelo papel
```

`TelaAluno` e `TelaProfessor` passam a receber `salaId` e a consultar as subcoleções da sala.
Mantenha os dois componentes (o cliente reconhece as duas telas) — mude a fonte de dados, não a
identidade das telas.

## Integração

- **Task 01:** use `useAuth()` para `uid` e `papel`. Acrescente a noção de **papel na sala**:
  ser professor globalmente não dá acesso à sala de outro professor.
- **Task 02:** `criadaEm`, `entrouEm` e `horario` usam `carimboServidor()` de `services/tempo.js`.
- **Task 04 (imagens):** os anexos vão para `salas/{salaId}/chamados/{chamadoId}/` no Storage.
  Deixe o caminho já parametrizado por sala.
- **Task 06 (chat/DM):** o chat já nasce escopado aqui; as DMs entram como
  `salas/{salaId}/conversas/{conversaId}`.
- **Task 07 (perks):** perks são por sala — `salas/{salaId}/perks/{uid}`.
- **Rules:** agora sim, endureça tudo. Negue por padrão. Escreva teste de permissão concedida **e**
  negada para cada caminho.

## Migração dos dados existentes

`scripts/migrar-para-salas.js`, idempotente, com `--dry-run` e `--reverter`:

1. Cria a sala `Turma Geral {ano}` com o professor mais ativo como dono (ou um UID passado por
   parâmetro).
2. Copia todos os `chamados` e `chat` globais para as subcoleções dessa sala, **preservando os
   IDs** dos documentos.
3. Cria `membros/{uid}` para cada autor distinto encontrado.
4. **Não apaga** as coleções globais nesta versão. Elas ficam como backup vivo até a 1.0.0.

A aplicação, nesta versão, lê a subcoleção da sala e **cai para a coleção global** quando a
subcoleção estiver vazia e o usuário não tiver sala (fallback de leitura). Isso garante que um
aluno que abrir o app no meio da migração não veja a tela vazia.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `gerarPin()` produz 6 dígitos numéricos |
| 2 | `criarSala()` grava `pinHash` e **não** grava o PIN em claro |
| 3 | PIN gerado é único entre salas ativas (colisão força nova geração) |
| 4 | `entrarComPin()` com PIN correto cria `membros/{uid}` |
| 5 | PIN errado devolve erro genérico, sem revelar existência |
| 6 | 6ª tentativa errada em 5 minutos é bloqueada |
| 7 | Aluno já membro entra sem digitar PIN |
| 8 | Rule: aluno da sala A recebe `permission-denied` ao ler `salas/B/chamados` |
| 9 | Rule: aluno não lê `pinHash` de sala nenhuma |
| 10 | Rule: só o professor dono cria, regera PIN, remove membro e arquiva |
| 11 | Sala arquivada rejeita nova entrada e nova escrita |
| 12 | Regerar PIN invalida o anterior |
| 13 | Listener de chamados usa `where('salaId')`/subcoleção **com `limit`** |
| 14 | Listener é cancelado no unmount (sem vazamento) |
| 15 | Script de migração é idempotente: rodar duas vezes não duplica nada |
| 16 | Fallback de leitura: sem subcoleção, lê a coleção global (retrocompat) |

## Compatibilidade

- **Retroativa (crítica):** chamados e mensagens sem `salaId` continuam visíveis pelo fallback de
  leitura descrito acima. Teste com um banco que só tem as coleções globais antigas.
- **Futura:** os documentos novos nas subcoleções mantêm **exatamente** os mesmos nomes de campo
  dos antigos (`nome`→`autorNome` é uma mudança: grave **os dois** nesta versão e só remova `nome`
  na 1.0.0). Um cliente da versão 0.4.0 que leia um chamado novo não pode quebrar.
- **Migração:** idempotente, com `--dry-run` e `--reverter`, documentada em
  `docs/MIGRACOES.md` com o procedimento de execução e de rollback.

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md`, `docs/ARQUITETURA.md` (crie aqui: modelo de dados, coleções,
diagrama do fluxo de entrada por PIN), `docs/MIGRACOES.md` e
`docs/adr/0005-modelo-de-dados-por-sala.md` + `docs/adr/0006-pin-com-hash-e-indice.md`.

## Como saber que terminou

Lint, `test:ci`, `test:rules` e `build` verdes; todos os ACs cobertos; o teste de rules cobre
concessão **e** negação de cada caminho; o script de migração roda duas vezes seguidas sem
duplicar dados; o app funciona tanto com banco migrado quanto com banco legado.

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Título:

```
feat(salas): adiciona salas do professor com entrada por PIN e escopo de dados por sala

BREAKING CHANGE: chamados e chat passam a viver em subcoleções de salas/{salaId}.
Fallback de leitura das coleções globais mantido nesta versão; remoção prevista para a 1.0.0.
```

**Versão:** 0.4.0 → 0.5.0 (MINOR com `BREAKING CHANGE` documentado)
