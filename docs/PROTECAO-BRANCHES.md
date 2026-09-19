# Estratégia e Proteção de Branches

## As duas branches permanentes

| Branch | O que é | Quem vê |
|---|---|---|
| **`main`** | O que está no ar. Sempre estável, sempre deployável. | Alunos e professores |
| **`dev`** | Integração. Recebe todas as features antes de irem para produção. | Só a equipe |

Branches de trabalho saem sempre de `dev`:

```
feat/<escopo>     nova funcionalidade
fix/<escopo>      correção
chore/<escopo>    infraestrutura, dependências, configuração
docs/<escopo>     só documentação
refactor/<escopo> mudança interna sem alterar comportamento
```

Fluxo completo:

```
main ──────────────●───────────────────●──────  (releases, com tag)
                   ↑ PR                ↑ PR
dev  ──●──●──●─────●──●──●──●──●───────●──────  (integração)
       ↑  ↑  ↑        ↑  ↑  ↑  ↑
      PRs de feat/… fix/… chore/…
```

## Configuração a aplicar no GitHub

Em **Settings → Branches → Add branch protection rule**, crie duas regras.

### Regra para `main`

- [x] Require a pull request before merging
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Checks obrigatórios: `lint`, `test`, `test-rules`, `build`
- [x] Require conversation resolution before merging
- [x] Do not allow bypassing the above settings
- [ ] Allow force pushes — **desmarcado**
- [ ] Allow deletions — **desmarcado**

### Regra para `dev`

Igual à de `main`, com duas diferenças:

- Require approvals: **0** (as tasks rodam sozinhas; a revisão acontece antes de ir para `main`)
- Não exige "branches up to date" (evita rebase a cada merge durante o desenvolvimento)

## Criando as branches, se ainda não existirem

```bash
git checkout main
git pull origin main
git checkout -b dev
git push -u origin dev
```

Depois, em **Settings → General → Default branch**, mantenha `main` como padrão. `dev` é onde o
trabalho acontece, mas quem chega ao repositório pela primeira vez deve ver a versão estável.

## Convenção de commits

Todo commit segue [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```
feat(salas): adiciona entrada por PIN
fix(tempo): usa horário do servidor na ordenação
chore(infra): configura Firebase Emulator Suite
docs(manual): adiciona manual do professor
test(chat): cobre a negação de leitura de DM por terceiros
refactor(auth): extrai resolução de papel para serviço próprio
```

Rodapé `BREAKING CHANGE:` sempre que o contrato de dados ou de rota mudar.

## Versionamento

| Tipo de mudança | Incremento |
|---|---|
| `fix:` | PATCH |
| `feat:` | MINOR |
| `BREAKING CHANGE:` | MAJOR (antes da 1.0.0: MINOR com o rodapé documentado) |

A versão vive em `package.json` e é incrementada pelo PR que a merece, não em lote no release.
