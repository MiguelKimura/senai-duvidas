# ADR 0002 — Duas branches permanentes: `main` e `dev`

- **Status:** aceito
- **Data:** 2026-09-20
- **Versão:** 0.2.0
- **Critérios:** AC-CI-01, AC-CI-02, AC-CI-03, AC-CI-04, AC-CI-08

## Contexto

O projeto tem uma característica que decide esta escolha: **o deploy é assistido por uma
aula**. Quando uma versão vai para produção, ela vai para máquinas de laboratório com uma turma
sentada na frente. Não há janela de manutenção, não há usuário que "tenta de novo mais tarde" —
há quarenta pessoas esperando para tirar dúvida.

Além disso, o desenvolvimento acontece em tasks automatizadas (`tasks/`, executadas por
`scripts/claude_queue.py`), cada uma abrindo o seu PR. O fluxo precisa aguentar vários PRs
seguidos sem que nenhum deles chegue a produção antes de ser integrado com os outros.

## Decisão

Duas branches permanentes:

- **`main`** — o que está no ar. Só recebe PR vindo de `dev`, no momento do release, com tag de
  versão.
- **`dev`** — integração. Recebe todas as branches de trabalho.

Branches de trabalho saem de `dev` e voltam para `dev` por PR: `feat/…`, `fix/…`, `chore/…`,
`docs/…`, `refactor/…`, `test/…`.

As duas são protegidas: sem push direto, sem force push, sem deleção, merge só por PR com os
checks `lint`, `test`, `test-rules` e `build` verdes. Como proteção de branch é configuração de
UI do GitHub e não vive no repositório, ela está documentada passo a passo em
[`docs/PROTECAO-BRANCHES.md`](../PROTECAO-BRANCHES.md) — e os nomes dos jobs do workflow são
verificados contra esse documento por `src/__tests__/ci.test.js`, porque um check obrigatório
que aponta para um job renomeado nunca roda, e um check que nunca roda nunca reprova.

`main` continua sendo a branch padrão do repositório: quem chega pela primeira vez deve ver a
versão estável, ainda que o trabalho aconteça em `dev`.

## Alternativas consideradas

**Trunk-based com uma branch só.** É o que a literatura recomenda para times que entregam
continuamente, e evita o trabalho de manter duas linhas. Descartado pelo contexto de deploy:
com uma branch só, todo merge é um candidato a produção, e aqui produção é uma turma em aula.
A separação existe justamente para que integrar e publicar sejam dois atos distintos.

**Git Flow completo,** com `release/*` e `hotfix/*`. Descartado por excesso: são branches de
coordenação para times grandes com releases em lote. Aqui o release é um PR de `dev` para
`main`, e uma correção urgente é um `fix/…` que passa por `dev` — o CI leva minutos, não dias.

**Feature flags em vez de branch de integração.** Boa ideia, e provavelmente o destino do
projeto quando houver usuários simultâneos suficientes para justificar rollout parcial. Hoje
seria complexidade sem benefício: o público é uma turma por vez.

## Consequências

**Boas**

- `main` é sempre deployável, e o que está em `main` é o que a turma vê.
- Vários PRs de task podem ser integrados em `dev` e validados juntos antes de qualquer um deles
  virar produção.
- O release ganha um ponto de decisão explícito, com tag e entrada de changelog.

**Ruins, e aceitas**

- Todo merge é feito duas vezes: para `dev` e, depois, de `dev` para `main`.
- `dev` pode divergir de `main` e acumular conflitos se os releases demorarem. Mitigação: uma
  versão por task do roadmap, e não um release trimestral.
- Uma correção urgente em produção passa por `dev` antes de `main`. É mais lento que um `hotfix`
  direto, e é deliberado: PR sem CI verde em produção é como o sistema quebra na aula seguinte.
