---
id: 06-chat-overhaul-dm
titulo: "Chat reescrito com horários, cores estáveis, paginação e mensagens diretas"
versao_origem: 0.7.0
versao_alvo: 0.8.0
tipo: feat
escopo_commit: chat
branch: "feat/chat-com-dm"
branch_base: "dev"
depende_de: [00-fundacao-testes, 01-auth-oauth-sessao, 02-tempo-brasilia, 03-salas-pin, 05-cor-card-markdown]
criterios: [AC-CHAT-01, AC-CHAT-02, AC-CHAT-03, AC-CHAT-04, AC-CHAT-05, AC-CHAT-06, AC-CHAT-07, AC-CHAT-08, AC-CHAT-09, AC-CHAT-10, AC-CHAT-11, AC-CHAT-12, AC-CHAT-13, AC-DM-01, AC-DM-02, AC-DM-03, AC-DM-04, AC-DM-05, AC-DM-06]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: alto
observacao: "Contém a correção de uma falha grave: hoje qualquer aluno apaga o chat inteiro com !clear."
---

# Você é o engenheiro responsável pela task 06 — Chat e Mensagens Diretas

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md`, `docs/ARQUITETURA.md`
e todo o `src/`. Tasks 00 a 05 entregaram harness, auth, tempo do servidor, salas, anexos e o
markdown sanitizado (que você vai reaproveitar).
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O que o cliente pediu

> "O chat tem alguns problemas hoje. Ele deveria ser mais eficiente, ter horário nos cards, manter
> a mesma cor de mensagens pras mensagens do mesmo usuário, ter animações mais bonitinhas, ter a
> opção de enviar mensagens diretas e privadas pra um aluno."

## Os problemas concretos de `src/components/Chat.js` hoje

1. **`onSnapshot` na coleção `chat` inteira, sem `limit`.** Toda mensagem já enviada é baixada por
   todo usuário, para sempre. É o maior custo de leitura do app e ele cresce sem teto.
2. **`!clear` sem nenhuma restrição.** Qualquer aluno digita `!clear` e apaga o chat inteiro da
   escola. Além disso, o loop `querySnapshot.forEach(async doc => deleteDoc(...))` dispara
   deleções sem aguardar nenhuma — falhas passam despercebidas.
3. **Cor instável.** `gerarCorParaUsuario(mensagem.email || usuarioEmail)` cai para o **e-mail de
   quem está olhando** quando a mensagem não tem e-mail; mensagens antigas trocam de cor conforme
   quem abre o chat.
4. **Sem horário nenhum** na mensagem, embora o campo `horario` seja gravado.
5. **Reset de meia-noite** com `setTimeout` de até 24 horas, que não sobrevive a um refresh e usa
   a meia-noite da máquina do usuário.
6. Mensagem sem limite de tamanho; texto do usuário concatenado direto no JSX.
7. Sem rolagem automática, sem agrupamento, sem estado de envio, sem distinção entre professor e
   aluno.

## Critérios de aceite deste escopo

**Chat**
- AC-CHAT-01 — cada mensagem exibe o horário (HH:mm, Brasília).
- AC-CHAT-02 — cor **estável** por usuário, entre sessões e dispositivos.
- AC-CHAT-03 — mensagens consecutivas do mesmo autor agrupadas.
- AC-CHAT-04 — professores com selo visual distinto.
- AC-CHAT-05 — rolagem automática para a última mensagem, exceto se o usuário rolou para cima —
  aí aparece o botão "novas mensagens".
- AC-CHAT-06 — carrega **50 mensagens** e busca anteriores sob demanda.
- AC-CHAT-07 — envio otimista: mensagem aparece como "enviando" e confirma ao gravar.
- AC-CHAT-08 — `!clear` **só para professores**, com confirmação.
- AC-CHAT-09 — limite de 500 caracteres com contador ao se aproximar.
- AC-CHAT-10 — chat escopado por sala (`salas/{salaId}/chat`).
- AC-CHAT-11 — indicador de "digitando…". **[POS]**
- AC-CHAT-12 — links viram clicáveis com `rel="noopener noreferrer"`; nenhum HTML do usuário é
  renderizado como markup.
- AC-CHAT-13 — animação de entrada suave, respeitando `prefers-reduced-motion`.

**Mensagens diretas**
- AC-DM-01 — abas **"Sala"** e **"Diretas"**.
- AC-DM-02 — professor inicia conversa privada com qualquer aluno da sua sala.
- AC-DM-03 — aluno inicia conversa privada com o professor da sala.
- AC-DM-04 — conversa privada invisível para terceiros, garantido por **Firestore Rules**, não por
  filtro de interface.
- AC-DM-05 — contador de mensagens não lidas por conversa.
- AC-DM-06 — lista de conversas ordenada pela mensagem mais recente.

## Modelo de dados

```
salas/{salaId}/chat/{mensagemId}
  autorUid, autorNome, autorPapel, texto, horario (serverTimestamp), editadaEm | null

salas/{salaId}/conversas/{conversaId}          conversaId = uids ordenados e unidos: "uidA_uidB"
  participantes: [uidA, uidB]                  <- array, indexado, usado pela rule
  participantesNomes: {uidA: "...", uidB: "..."}
  ultimaMensagem: {texto, horario, autorUid}   <- desnormalizado para a lista
  naoLidas: {uidA: 0, uidB: 3}

salas/{salaId}/conversas/{conversaId}/mensagens/{mensagemId}
  autorUid, autorNome, texto, horario, lidaEm | null
```

**Rule da DM (AC-DM-04) — o ponto mais importante desta task:**

```
allow read, write: if request.auth.uid in resource.data.participantes;
```

E a consulta do cliente **precisa** ser `where('participantes', 'array-contains', uid)`, senão a
rule nega a listagem inteira. Escreva o teste que prova que um terceiro autenticado recebe
`permission-denied` tanto no `get` do documento quanto na `query` da coleção.

## Desenho pedido

```
src/components/chat/
  Chat.jsx             -> casca, abas, estado do painel
  AbaSala.jsx
  AbaDiretas.jsx
  ListaConversas.jsx
  Conversa.jsx
  ListaMensagens.jsx   -> rolagem, paginação, agrupamento
  Mensagem.jsx         -> horário, cor, selo de professor, estado de envio
  CampoMensagem.jsx    -> contador, Enter para enviar, comandos
src/hooks/
  useMensagens.js      -> onSnapshot com limit(50) + paginação para trás
  useRolagemAutomatica.js
src/services/chat.js   -> enviar, paginar, marcar lida, limpar (com checagem de papel)
src/utils/corUsuario.js-> hash determinístico por UID
```

**Cor estável (AC-CHAT-02):** derive do **`autorUid`**, nunca do e-mail e nunca com fallback para
o usuário logado. Mesmo hash, mesma cor, em qualquer dispositivo, para sempre. E garanta contraste
mínimo com o texto — reaproveite `razaoContraste()` da task 05 e ajuste a luminosidade até passar,
com teste que percorre 1000 UIDs sintéticos afirmando contraste ≥ 4.5.

**`!clear` (AC-CHAT-08):** mova a autorização para a **Firestore Rule** (só o professor dono da
sala deleta mensagens), peça confirmação na interface, e faça a deleção em lote com
`writeBatch` (máx. 500 por lote), aguardando cada lote e reportando falha.

**Reset de meia-noite:** substitua o `setTimeout` por verificação no carregamento, comparando com
`proximaMeiaNoiteBrasilia()` de `services/tempo.js` (AC-TEMPO-07). Considere não apagar mais nada
automaticamente e sim **filtrar** a exibição pelo dia corrente — mais barato, reversível e não
destrói histórico. Se optar por isso, registre a decisão no ADR e confirme que o comportamento
visível para o usuário continua "o chat começa limpo a cada dia".

## Integração

- **Task 02:** `formatarHora()` e `carimboServidor()` de `services/tempo.js`.
- **Task 03:** `salaId` do contexto de sala; papel na sala decide selo e permissão de `!clear`.
- **Task 05:** reaproveite `utils/markdown.js` para AC-CHAT-12 — links clicáveis passam pela mesma
  sanitização. Não duplique o sanitizador.
- **Task 07 (perks):** a insígnia do perk vai aparecer ao lado do nome no chat — deixe `Mensagem.jsx`
  com um ponto de extensão para insígnias.
- **Task 08 (animações):** entregue a animação de entrada com os tokens; o polimento final é lá.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `corUsuario(uid)` é determinística e independente de quem está olhando |
| 2 | Cor tem contraste ≥ 4.5 para 1000 UIDs sintéticos |
| 3 | Mensagem exibe horário em HH:mm de Brasília |
| 4 | Mensagens consecutivas do mesmo autor agrupam sem repetir o nome |
| 5 | Professor recebe selo; aluno não |
| 6 | `useMensagens` consulta com `limit(50)` |
| 7 | Rolar para o topo carrega as 50 anteriores |
| 8 | Nova mensagem com o usuário no fim rola automaticamente |
| 9 | Nova mensagem com o usuário rolado para cima mostra "novas mensagens" |
| 10 | Envio otimista mostra "enviando" e confirma |
| 11 | Mensagem acima de 500 caracteres é bloqueada, com contador visível |
| 12 | `!clear` de aluno é **negado pela rule** |
| 13 | `!clear` de professor pede confirmação antes de apagar |
| 14 | `!clear` apaga em lote e reporta falha parcial |
| 15 | `<script>` no texto da mensagem não vira markup |
| 16 | URL vira link com `rel="noopener noreferrer"` |
| 17 | Abas Sala/Diretas alternam o conteúdo |
| 18 | Professor abre DM com aluno da sala; `conversaId` é determinístico |
| 19 | **Rule:** terceiro recebe `permission-denied` no `get` e na `query` da DM |
| 20 | Contador de não lidas incrementa ao receber e zera ao abrir |
| 21 | Lista de conversas ordena pela mensagem mais recente |
| 22 | Listener é cancelado no unmount (AC-PERF-04) |

## Compatibilidade

- **Retroativa:** mensagens antigas têm `nome`, `email` e `horario` como `Date`, e **não têm**
  `autorUid`. Sua função de cor depende de `autorUid`. Trate: sem `autorUid`, derive a cor do
  `email` (caminho legado, testado) e mostre o `nome` gravado. Teste com uma coleção mista.
- **Futura:** `autorUid`, `autorPapel` e `editadaEm` são aditivos. Continue gravando `nome` e
  `email` nesta versão para que um cliente antigo renderize a mensagem. Teste a leitura antiga.
- **Migração:** as mensagens globais já foram copiadas para a sala pela task 03. Nenhuma migração
  nova aqui; se preencher `autorUid` retroativamente, faça por script idempotente com `--dry-run`.

## Restrições de escalabilidade

- Alvo: 40 alunos simultâneos, 1000 mensagens por sala (AC-PERF-05).
- Com `limit(50)` + paginação, a leitura por aluno por aula cai de O(todas as mensagens) para
  O(50 + novas). Documente a estimativa de custo antes e depois em `docs/ARQUITETURA.md` — essa é
  a maior economia de leitura do roadmap (AC-PERF-06).
- `ultimaMensagem` e `naoLidas` são desnormalizados de propósito: evitam N consultas para montar a
  lista de conversas. Documente o trade-off (escrita a mais por mensagem) no ADR.

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md` (conte a história do `!clear` aberto — é um bom exemplo
pedagógico de por que autorização mora no servidor), `docs/ARQUITETURA.md` e
`docs/adr/0009-modelo-de-conversas-diretas.md`.

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Título:

```
feat(chat): reescreve o chat com horários, cores estáveis, paginação e mensagens diretas

BREAKING CHANGE: o comando !clear passa a exigir papel de professor, garantido por Firestore Rules.
```

**Versão:** 0.7.0 → 0.8.0 (MINOR com `BREAKING CHANGE` documentado)
