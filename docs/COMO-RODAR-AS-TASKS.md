# Como rodar as tasks no VS Code

Cada arquivo em `tasks/NN-*.md` é um **system prompt completo**. Não escreva prompt de usuário:
o arquivo já contém todo o contexto, os critérios de aceite, as notas de integração, as exigências
de red-green-refactor e as restrições de produção, deploy e escalabilidade.

## Ordem de execução

As tasks têm dependência estrita. O campo `depende_de` no cabeçalho YAML de cada arquivo é a
fonte da verdade:

```
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09
```

Só comece a próxima depois que o PR da anterior estiver mesclado em `dev` com o CI verde.
Rodar duas tasks em paralelo gera conflito garantido — várias delas tocam os mesmos arquivos.

## Rodando uma task

```bash
# a partir da raiz do repositório, com dev atualizado
git checkout dev && git pull origin dev

claude --dangerously-skip-permissions --append-system-prompt "$(cat tasks/00-fundacao-testes.md)"
```

Ou, se o seu script usa arquivo de system prompt:

```bash
claude --dangerously-skip-permissions --system-prompt-file tasks/00-fundacao-testes.md
```

O cabeçalho YAML é metadado para você e para scripts de automação. Se o seu runner não souber
interpretá-lo, tudo bem: ele é legível como texto e não atrapalha o modelo.

## Script de loop sugerido

```bash
#!/usr/bin/env bash
set -euo pipefail

TASK="${1:?uso: ./rodar-task.sh tasks/00-fundacao-testes.md}"
MAX_TENTATIVAS=5

git checkout dev && git pull origin dev

for tentativa in $(seq 1 "$MAX_TENTATIVAS"); do
  echo "=== Tentativa $tentativa de $MAX_TENTATIVAS — $TASK ==="

  claude --dangerously-skip-permissions --append-system-prompt "$(cat "$TASK")"

  if npm run lint && npm run test:ci && npm run build; then
    echo "=== Verde. PR aberto pela sessão. ==="
    exit 0
  fi

  echo "=== Vermelho. Reentrando com o estado atual. ==="
done

echo "=== Esgotou as tentativas. Revise manualmente. ==="
exit 1
```

A própria task já instrui a sessão a iterar internamente até o verde; este laço externo é a rede
de segurança para o caso de a sessão terminar por limite de contexto.

## Depois de cada task

1. Revise o PR aberto contra `dev` — leia a tabela de critérios de aceite e a de compatibilidade.
2. Confirme que o CI está verde.
3. Mescle em `dev`.
4. Ao final de um conjunto de tasks (ou na 1.0.0), abra o PR de `dev` para `main`.

## Mantendo o projeto sincronizado na sua máquina

```bash
git clone https://github.com/MiguelKimura/senai-duvidas.git
cd senai-duvidas
git checkout dev
npm install
npm start
```

Para puxar o que as sessões produziram:

```bash
git checkout dev && git pull origin dev
```

Para ver o que os usuários estão usando em produção:

```bash
git checkout main && git pull origin main
```

**Nunca trabalhe direto em `main`.** Ela existe para refletir o que está no ar.

## Se uma task travar

- **A sessão parou no meio:** rode de novo com o mesmo arquivo. O protocolo manda ela reavaliar o
  estado do repositório antes de agir, então ela retoma de onde parou.
- **A sessão abriu PR com AC faltando:** não mescle. Rode de novo apontando o que faltou no
  comentário do PR — ou deixe para a task 09, que tem autoridade para reabrir qualquer AC.
- **A sessão ficou presa em um problema real:** ela deve ter escrito `docs/BLOQUEIOS.md`. Leia,
  decida e ajuste a task.
