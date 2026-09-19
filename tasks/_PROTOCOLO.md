# Protocolo de Execução das Tasks

> Este arquivo é referenciado por todas as tasks em `tasks/`. Ele vive no repositório,
> então toda sessão tem acesso a ele. Leia-o **na íntegra** antes da primeira edição de código.

## 1. Como as tasks são executadas

Cada arquivo `tasks/NN-*.md` é usado como **system prompt completo** de uma sessão one-shot,
rodada com permissões amplas (`--dangerously-skip-permissions`). **Não existe prompt de usuário.**
A sessão deve se auto-dirigir do início ao fim: ler o repositório, escrever testes, implementar,
iterar até o verde e abrir o Pull Request.

## 2. O laço obrigatório (red → green → refactor)

Para **cada** critério de aceite do escopo da task, nesta ordem:

1. **RED** — escreva o teste que expressa o critério. Rode-o. **Ele precisa falhar**, e falhar
   pelo motivo certo (não por erro de import ou de sintaxe). Um teste que passa de primeira
   não prova nada: reescreva-o até falhar de verdade.
2. **GREEN** — escreva o **mínimo** de código de produção para o teste passar. Nada além disso.
3. **REFACTOR** — com o teste verde, melhore o desenho: extraia funções, elimine duplicação,
   nomeie bem. Rode a suíte inteira a cada passo. Verde antes, verde depois.

Faça **commit ao final de cada ciclo completo**, com mensagem no padrão Conventional Commits.
O histórico do PR precisa mostrar o ciclo — é assim que a revisão confirma que houve TDD.

## 3. O laço externo (iterar até que TUDO esteja verde)

```
enquanto (existir AC do escopo não atendido
          OU suíte vermelha
          OU lint vermelho
          OU build quebrado
          OU compatibilidade retro/futura não comprovada):
    diagnosticar a causa raiz
    aplicar a correção
    rodar: npm run lint && npm run test:ci && npm run test:rules && npm run build
```

**Não encerre a sessão com nada vermelho.** Se um AC se mostrar realmente impossível dentro do
escopo, implemente todo o resto, registre o bloqueio em `docs/BLOQUEIOS.md` com a causa técnica e
uma proposta de solução, e declare isso explicitamente no corpo do PR. Reduzir o escopo por conta
própria e ficar em silêncio **não** é uma opção.

**Proibido para ficar verde:** apagar teste, marcar `.skip`/`.todo`, afrouxar asserção, baixar
threshold de cobertura, mockar a própria unidade sob teste, ou capturar exceção sem verificá-la.

## 4. Compatibilidade retroativa e futura (obrigatório em todas as tasks)

Antes de abrir o PR, comprove as duas com testes reais:

**Retroativa** — documentos gravados pela versão anterior continuam legíveis:
- Escreva um teste que monta um documento no formato **antigo** (ex.: `horario` como string ISO,
  `imagem` como string de URL, chamado sem `salaId`) e prove que a versão nova o lê, exibe e
  ordena corretamente.
- Nenhum campo pode ser renomeado ou removido sem uma fase de leitura dupla.

**Futura** — uma versão anterior do app não quebra ao ler os documentos novos:
- Campos novos são **aditivos** e opcionais, com padrão seguro na leitura.
- Escreva um teste que lê um documento novo com o leitor antigo (ou ignorando os campos novos)
  e prove que nada lança exceção.
- Mudança de forma de dado exige migração em duas etapas: *escrever nos dois formatos* →
  *migrar* → *parar de escrever no antigo* (nunca em um único release).

## 5. Git e Pull Request

```
git checkout dev && git pull origin dev
git checkout -b <tipo>/<escopo-curto>
# ... ciclos red-green-refactor com commits ...
npm run lint && npm run test:ci && npm run test:rules && npm run build
git push -u origin <tipo>/<escopo-curto>
# abrir PR contra dev
```

Nunca faça push direto em `main` nem em `dev`. O PR é sempre contra **`dev`**.

### Formato da mensagem de commit

```
<tipo>(<escopo>): <resumo no imperativo, minúsculo, sem ponto final>

<corpo: o porquê, não o quê>

Refs: AC-XXX-01, AC-XXX-02
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`, `build`, `ci`.

### Formato obrigatório do corpo do PR

```markdown
## Resumo (Conventional Commits + SemVer)

<tipo>(<escopo>): <resumo>

**Versão:** 0.X.Y → 0.X.Z (MINOR — nova funcionalidade retrocompatível)

## Critérios de aceite atendidos

| AC | Descrição | Teste que prova |
|---|---|---|
| AC-XXX-01 | ... | `src/__tests__/xxx.test.js:42` |

## Ciclo Red-Green-Refactor

| Ciclo | RED (commit) | GREEN (commit) | REFACTOR (commit) |
|---|---|---|---|
| 1 | `abc1234` | `def5678` | `ghi9012` |

## Compatibilidade

- **Retroativa:** <o que foi testado e onde>
- **Futura:** <o que foi testado e onde>
- **Migração necessária:** sim/não — <se sim, como rodar e como reverter>

## Verificação

- [ ] `npm run lint` — 0 erros
- [ ] `npm run test:ci` — N testes, 0 falhas
- [ ] `npm run test:rules` — N testes, 0 falhas
- [ ] `npm run build` — sucesso, bundle X KB gzip
- [ ] Cobertura ≥ 80% linhas / 75% branches
- [ ] Nenhum teste preexistente removido ou pulado

## Riscos e plano de reversão

<como desfazer se quebrar em produção>
```

## 6. Ao final: atualize a documentação viva

Toda task, antes de abrir o PR:

1. Incrementa `version` no `package.json` conforme SemVer.
2. Adiciona a seção da versão no `CHANGELOG.md` (formato Keep a Changelog).
3. Adiciona a entrada da versão em `docs/HISTORICO.md` — **o que mudou, por que mudou, o que foi
   descartado e o que o usuário final sente na prática**. Esse arquivo é a memória do projeto,
   escrito para quem chegar depois.
4. Registra decisões arquiteturais novas como ADR em `docs/adr/NNNN-titulo.md`.
5. Marca os ACs atendidos em `docs/CRITERIOS-DE-ACEITE.md` — nunca reescreva um critério para
   caber na implementação; se o critério estiver errado, diga isso no PR e proponha a redação nova.

## 7. Restrições permanentes do projeto

**Produção**
- Usuários reais: alunos e professores do SENAI, em laboratório, durante a aula. Uma falha em
  produção interrompe uma turma inteira.
- Nenhum segredo versionado. Config do Firebase por `REACT_APP_*` com fallback documentado.
- Nenhum `console.log` de dado pessoal no código final.
- Toda escrita no banco valida entrada antes de gravar.

**Deploy**
- `main` = produção; `dev` = homologação. Deploy a partir de `main`, sempre por PR com CI verde.
- Build precisa continuar funcionando com `npm ci && npm run build` em máquina limpa.
- Migração de dados precisa ser idempotente e reversível.

**Escalabilidade**
- Alvo: 10 salas ativas, 40 alunos por sala, 200 chamados e 1000 mensagens por sala.
- Nunca `onSnapshot` em coleção inteira sem `where` + `limit`.
- Todo listener é cancelado no unmount.
- Custo de leituras dentro do plano gratuito do Firebase para o alvo acima.

**Compatibilidade de navegador**
- Chrome/Edge/Firefox nas duas últimas versões estáveis. Sem dependência de API experimental.

## 8. Scripts esperados no `package.json`

| Script | O que faz |
|---|---|
| `npm start` | Dev server |
| `npm run build` | Build de produção |
| `npm test` | Testes em watch |
| `npm run test:ci` | Testes uma vez, sem watch, com cobertura — **este é o que vale** |
| `npm run test:rules` | Testes de Firestore/Storage Rules no emulador |
| `npm run test:e2e` | Playwright (a partir da v1.0.0) |
| `npm run lint` | ESLint, 0 warnings toleradas |
| `npm run emulators` | Sobe o Firebase Emulator Suite |
