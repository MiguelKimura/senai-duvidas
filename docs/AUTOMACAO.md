# Automação da fila de tasks

O orquestrador (`scripts/claude_queue.py`) roda as tasks de `tasks/` em ordem, uma de cada vez,
cada uma em um **worktree git isolado**, e para em cada Pull Request esperando o seu merge.

## O que muda em relação à versão do AgroApp

O script que você já usa foi adaptado em quatro pontos. Se preferir manter um script único para os
dois projetos, os patches são compatíveis com o AgroApp — nada foi removido, só acrescentado.

| # | O que mudava | Por que |
|---|---|---|
| 1 | `create_pr` exigia que a sessão deixasse tudo **não commitado**, senão `RuntimeError: A tarefa terminou sem alterações no Git` | Neste projeto o red-green-refactor exige um commit por ciclo. O script agora aceita trabalho já commitado (conta commits à frente de `origin/dev`) e só cria um commit de fechamento se sobrar algo no working tree |
| 2 | Título e corpo do PR vinham de um template genérico | A sessão escreve `.automation/pr-title.txt` e `.automation/pr-body.md` com o resumo em Conventional Commits, a tabela de critérios de aceite e as provas de compatibilidade. O script usa esse conteúdo, e anexa o log de validação num `<details>` |
| 3 | O prompt não dizia quem faz push nem quem abre o PR | Agora diz explicitamente: a sessão commita, o orquestrador empurra e abre |
| 4 | `wait_for_merge` recebia um worktree que podia já ter sido removido | Cai para a raiz do repositório, que serve igual para o `gh` |

O `.gitignore` ganhou `.automation/`, para que os worktrees, o `state.json` e os dois arquivos de
PR nunca entrem em commit.

## Configuração (`automation.yaml`)

| Campo | Valor | Por quê |
|---|---|---|
| `base_branch` / `pr_base` | `dev` | Toda branch sai de `dev` e todo PR volta para `dev` |
| `roadmap_file` | `tasks/_PROTOCOLO.md` | É o arquivo de regras globais que toda sessão lê antes da própria task |
| `task_glob` | `tasks/[0-9][0-9]-*.md` | Pega 00 a 09; ignora `_PROTOCOLO.md` e `README.md` |
| `start_task` / `end_task` | `0` / `9` | A fila inteira, da fundação ao release 1.0.0 |
| `max_turns` | `150` | As tasks aqui são grandes; com `max_continuations: 12` dá bastante folga |
| `validation.commands` | `npm install`, `lint`, `test:ci`, `build` | O gate antes de abrir o PR. Se qualquer um falhar, a task é marcada como `failed` e a fila para |
| `merge_gate` | `require_merge_before_next_task: true` | **Essencial aqui.** As tasks têm dependência estrita e várias tocam os mesmos arquivos |

`npm run test:rules` **não** está na validação de propósito: ele precisa do Firebase Emulator Suite
e de Java, o que é lento e frágil como gate local. Ele roda no CI (`docs/exemplos/ci.yml`) e dentro
da própria sessão, que é instruída a rodá-lo.

## Pré-requisitos na sua máquina

| Ferramenta | Verificar | Se faltar |
|---|---|---|
| Node 20+ | `node -v` | https://nodejs.org |
| Python 3.11+ | `python --version` | https://python.org |
| PyYAML | `python -c "import yaml"` | `python -m pip install pyyaml` |
| Claude Code | `claude --version` | `npm install -g @anthropic-ai/claude-code` |
| GitHub CLI | `gh auth status` | https://cli.github.com, depois `gh auth login` |
| Git com identidade | `git config user.email` | `git config --global user.email "..."` e `user.name` |

O `gh` precisa estar **autenticado** — é ele que abre os PRs. O `git config` precisa estar
preenchido, senão o commit de fechamento falha.

## Comandos

```powershell
# a fila inteira, das tasks 00 a 09
python .\scripts\claude_queue.py

# ou, pelo atalho
.\run-queue.ps1

# só a próxima task pendente, e para
python .\scripts\claude_queue.py --once

# ver o plano sem executar nada (confirme antes da primeira rodada)
python .\scripts\claude_queue.py --dry-run

# um intervalo específico
python .\scripts\claude_queue.py --from-task 3 --to-task 5

# limpar tasks marcadas como failed e tentar de novo
python .\scripts\claude_queue.py --reset-failed

# o trabalho já está pronto na branch e só a validação/PR falhou:
# pula a sessão do Claude (e o custo dela) e vai direto para validação e PR
python .\scripts\claude_queue.py --reset-failed --skip-claude
```

`--skip-claude` vale **apenas para a primeira task processada** na execução. As seguintes rodam
normalmente, com sessão.

## O ciclo de cada task

```
1. ensure_clean          working tree limpo + git fetch origin dev
2. create_worktree       .automation/worktrees/<branch>  a partir de origin/dev
3. run_claude            a sessão lê _PROTOCOLO.md + a task, implementa em ciclos RGR,
                         commita cada ciclo e escreve .automation/pr-body.md
4. validate              npm install, lint, test:ci, build
5. create_pr             push da branch + gh pr create (draft) com o texto da sessão
6. wait_for_merge        para e espera VOCÊ mesclar o PR no GitHub
7. remove_worktree       limpa e vai para a próxima task
```

A fila para no passo 6. Revise o PR — leia a tabela de critérios de aceite e a de compatibilidade —
e mescle. O script detecta o merge em até 30 segundos e segue.

## Se algo der errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `A task XX não define 'branch:' no frontmatter` | O valor de `branch:` está sem aspas | Já corrigido nos dez arquivos; se editar um, mantenha as aspas |
| `Working tree não está limpo` | Você tem alterações não commitadas na raiz | `git stash` ou commite antes de rodar |
| `A tarefa terminou sem alterações no Git` | A sessão não produziu nada | Veja o log; normalmente é a task 00 falhando no `npm install` |
| `Validação falhou` | `lint`, `test:ci` ou `build` vermelho | O gate funcionou. Leia o log, rode `--reset-failed` e tente de novo |
| `SSL certificate has expired`, `Unable to connect`, `ECONNRESET` | Queda de internet | Tratado como transitório: o script espera (60s, 120s, 240s, 480s) e tenta de novo sozinho, até 4 vezes |
| Task marcada `failed` depois de muito trabalho | Falha real, não transitória | O worktree é **preservado**. Inspecione-o, e rode `--reset-failed` para continuar de onde parou — a sessão é avisada de que está retomando |
| `'charmap' codec can't decode byte` | Corrigido. Era o Python lendo a saída UTF-8 do npm/jest como cp1252 no Windows PT-BR | `git pull origin dev` |
| `[WinError 2] O sistema não pode encontrar o arquivo especificado` | Corrigido. O `subprocess` do Windows usa `CreateProcess`, que só acha `.exe` — não aplica `PATHEXT`, então shims `.cmd` do npm (como o `claude`) não eram encontrados | `git pull origin dev`. O preflight agora nomeia a ferramenta que falta e imprime o PATH |
| Log com acento quebrado (`nÃ£o`) | O `Get-Content` do PowerShell 5.1 lê UTF-8 como ANSI | Acrescente `-Encoding UTF8` |
| `ENOSPC: no space left on device` | Cada worktree instala seu próprio `node_modules` — centenas de MB por task | O preflight agora barra a fila abaixo de 5 GB livres (`project.espaco_minimo_gb`). Libere espaço e rode `--reset-failed` |

## Espaço em disco

Cada task roda num worktree próprio, e a validação faz `npm install` nele: some algo entre 300 MB
e 500 MB por task. O worktree é removido ao fim de cada task bem-sucedida, mas worktrees de tasks
que falharam são **preservados de propósito** e se acumulam.

Para ver o que está ocupando e limpar:

```powershell
# tamanho de cada worktree preservado
Get-ChildItem .automation\worktrees -Directory | ForEach-Object {
  $mb = (Get-ChildItem $_.FullName -Recurse -File -EA SilentlyContinue |
         Measure-Object Length -Sum).Sum / 1MB
  "{0,-40} {1,8:N0} MB" -f $_.Name, $mb
}

# remover um worktree cuja task já foi concluída (os commits ficam na branch)
git worktree remove --force .automation\worktrees\<nome>

npm cache clean --force
```

Um alerta específico para este repositório: ele está dentro do **OneDrive**. O OneDrive sincroniza
cada `node_modules` — dezenas de milhares de arquivos por worktree — o que consome espaço em
nuvem, deixa o `npm install` lento e pode travar arquivos durante a instalação. Mover o
repositório para fora do OneDrive (por exemplo `C:\dev\senai-duvidas`) resolve os três de uma vez.
| A sessão terminou o trabalho e a falha foi do orquestrador | Não vale pagar outra sessão do zero | `--skip-claude` vai direto para validação e PR |
| CI reprova `Merge <sha> into <sha>` no job de commits | O `actions/checkout` cria um merge commit sintético no evento `pull_request` | O `git rev-list` do job precisa de `--no-merges`. Corrigido em `docs/exemplos/ci.yml` |
| `PR #N foi fechado sem merge` | Você fechou o PR | A fila para de propósito. Reabra ou rode `--reset-failed` |
| Fila parada em `[quota]` | Limite de uso atingido | Deixe rodando: o script dorme até o reset e retoma sozinho |
| `[resume] Claude atingiu max_turns` | Task grande | Normal. O worktree é preservado e a sessão continua de onde parou |

O estado fica em `.automation/state.json`. Apagar esse arquivo faz a fila recomeçar do zero —
e ela vai tentar recriar branches que já existem. Prefira `--reset-failed`.

## Retomada depois de uma interrupção

Uma task pode representar bastante tempo e custo real de API. Por isso o worktree **nunca é
apagado** quando a task falha, e a branch mantém os commits dos ciclos red-green-refactor que já
passaram.

Ao rodar de novo com `--reset-failed`, o script detecta que a branch já tem commits e avisa a
sessão de que ela está **continuando**, não recomeçando: ela lê `git log`, `git status` e `git
diff` antes de agir, e aproveita o que já está pronto.

Para descartar de propósito e começar a task do zero:

```powershell
git worktree remove --force .automation\worktrees\<branch-com-__>
git branch -D <branch>
python .\scripts\claude_queue.py --reset-failed
```


---

# Rodando sem terminal

## 1. Instalar o início automático

```powershell
.\scripts\instalar-inicio-automatico.ps1
```

Coloca um atalho `.vbs` na pasta **Inicializar** do Windows. A fila sobe ao fazer logon, em
**janela oculta**, e isso **não exige administrador** — é o modo recomendado.

O `.vbs` existe para rodar oculto: um `.bat` piscaria uma janela preta a cada logon e deixaria
um console aberto o tempo todo.

Antes de instalar, o script confere se `python`, `git`, `gh`, `claude` e `npm` estão no PATH e se
o `gh` está autenticado — melhor falhar na instalação do que em silêncio às 3 da manhã.

| Ação | Comando |
|---|---|
| Rodar agora | `wscript.exe "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\SenaiDuvidas-Fila.vbs"` |
| Acompanhar | `Get-Content .automation\queue.log -Wait -Tail 40 -Encoding UTF8` |
| Parar a fila | `Get-Process python \| Stop-Process` |
| Remover | `.\scripts\instalar-inicio-automatico.ps1 -Remover` |

### Modo alternativo: Agendador de Tarefas

```powershell
# PowerShell aberto COMO ADMINISTRADOR
.\scripts\instalar-inicio-automatico.ps1 -TarefaAgendada
```

Dá reinício automático em caso de falha e limite de tempo de execução, mas **exige elevação**:
`Register-ScheduledTask` devolve `Acesso negado (0x80070005)` para usuário comum. O script checa
se você está elevado e avisa antes de tentar, em vez de falhar no meio.

Roda como **você**, nunca como SYSTEM: a fila precisa das credenciais do `claude` e do `gh`, que
são por usuário.

## 2. Log e trava

Tudo que vai para o terminal vai também para `.automation/queue.log`, com marcação de início e
fim de cada execução. É por ele que você acompanha a fila sem precisar de um terminal aberto.

A fila tem trava em `.automation/queue.lock`: se você iniciar uma segunda enquanto a primeira
roda, a nova detecta o PID vivo e sai. Travas órfãs (processo morto) são removidas sozinhas.

## 3. O ponto que continua exigindo você: o merge

A fila para em cada Pull Request (`merge_gate.require_merge_before_next_task: true`) e espera
alguém mesclar. Esse é o único passo que não foi automatizado, e é de propósito: mesclar sem
revisão significa que **ninguém** olha o código antes de ele entrar em `dev` — nem você, nem outra
pessoa.

Se você quiser que a fila ande sozinha de ponta a ponta, a forma certa **não** é o script mesclar
por conta própria, e sim usar o recurso nativo do GitHub, onde a política fica explícita e
auditável:

1. **Settings → General → Pull Requests → Allow auto-merge** (habilitar).
2. **Settings → Branches → regra de `dev`**: exigir que os checks `rapido`, `completo` e `commits`
   passem, e **não** exigir aprovação humana (`Require approvals: 0`).
3. Em cada PR aberto pela fila, ligar o auto-merge uma vez — ou pelo botão "Enable auto-merge" na
   página do PR, ou com `gh pr merge <n> --auto --merge`.

Assim o GitHub mescla sozinho quando o CI fecha verde, e se o CI reprovar o PR simplesmente fica
aberto. A decisão de dispensar revisão humana passa a estar registrada na configuração do
repositório, em vez de escondida dentro de um script.

**O que você perde:** o CI vira o único revisor. Ele cobre lint, testes unitários, rules, build e
padrão de commits — mas não cobre "esta feature ficou boa?" nem "este modelo de dados vai
escalar?". As tasks 03 (salas) e 06 (chat/DM) mudam o modelo de dados e as regras de segurança;
essas duas valem uma olhada humana antes do merge, mesmo que o resto ande sozinho.


---

# Mover o projeto de pasta (SSD externo, sair do OneDrive, outra máquina)

A pasta inteira é autocontida: o `.git` vai junto, então o vínculo com o GitHub sobrevive.
Mas quatro coisas guardam caminho absoluto e precisam de atenção.

## Antes de mover

```powershell
# 1. Nada rodando
Get-Process python -EA SilentlyContinue | Stop-Process

# 2. Nenhum worktree com trabalho não mesclado
git worktree list
git worktree prune

# Se houver algum listado, veja se tem commit não mesclado antes de apagar:
#   git log --oneline dev..<branch>
# Worktrees guardam caminho absoluto e NÃO sobrevivem à mudança de pasta.
Remove-Item .automation\worktrees -Recurse -Force -EA SilentlyContinue
```

## Mover

```powershell
robocopy "C:\caminho\antigo\senai-duvidas" "D:\dev\senai-duvidas" /E /MOVE
cd D:\dev\senai-duvidas
git status          # tem que reconhecer o repositório normalmente
git worktree prune  # limpa registros que apontavam para o caminho antigo
```

## Depois de mover

```powershell
# O atalho de inicialização tem o caminho ANTIGO gravado dentro dele.
.\scripts\instalar-inicio-automatico.ps1     # regrava com o caminho e o PATH novos

python .\scripts\claude_queue.py --dry-run   # confere antes de valer
```

O `--dry-run` deve listar as tasks pendentes. Se listar tasks **já concluídas**, o estado não
migrou — veja abaixo.

## O estado é portátil desde a v0.3.0 da automação

Versões anteriores gravavam a chave de cada task como **caminho absoluto** em
`.automation/state.json`. Mover a pasta mudava a chave, o `status: done` deixava de ser
encontrado e as tasks concluídas eram refeitas do zero.

Hoje a chave é relativa (`tasks/00-fundacao-testes.md`), e o estado antigo é convertido
automaticamente na primeira execução — você verá
`[estado] Chaves absolutas convertidas em relativas`.

## Cuidados específicos de SSD externo

| Ponto | Por quê |
|---|---|
| **Formate em NTFS, não exFAT** | exFAT não tem permissões nem symlink; `npm install` e git ficam lentos e dão erro intermitente |
| **Fixe a letra do drive** | Se o SSD aparecer como `E:` num dia e `F:` no outro, o atalho de inicialização quebra. Gerenciamento de Disco → Alterar Letra → escolha uma alta (`Z:`) para não competir |
| **USB 3.0 ou melhor** | `npm install` mexe em dezenas de milhares de arquivos pequenos; em USB 2.0 leva um tempo desproporcional |
| **SSD conectado antes do logon** | A fila sobe ao logon. Se o drive não estiver montado, ela falha no preflight — o que é o comportamento certo, mas nada vai acontecer |
| **Fora do OneDrive** | Confirme que o novo caminho não está sendo sincronizado. Sincronizar `node_modules` é o que causou o `ENOSPC` |
