<!--
  Formato definido em tasks/_PROTOCOLO.md, seção 5. Preencha tudo: é por este
  texto que a revisão confirma que houve TDD de verdade, e não um commit
  gigante no fim. Apague os comentários antes de enviar.
-->

## Resumo (Conventional Commits + SemVer)

<tipo>(<escopo>): <resumo no imperativo, minúsculo, sem ponto final>

**Versão:** 0.X.Y → 0.X.Z (PATCH/MINOR/MAJOR — por quê)

## Critérios de aceite atendidos

| AC | Descrição | Teste que prova |
|---|---|---|
| AC-XXX-01 |  | `src/__tests__/xxx.test.js:42` |

## Ciclo Red-Green-Refactor

<!-- Um commit por fase. Se uma coluna estiver vazia, diga por quê. -->

| Ciclo | RED (commit) | GREEN (commit) | REFACTOR (commit) |
|---|---|---|---|
| 1 | `abc1234` | `def5678` | `ghi9012` |

## Compatibilidade

- **Retroativa:** <documentos gravados pela versão anterior continuam legíveis — o que foi testado e onde>
- **Futura:** <uma versão anterior do app não quebra ao ler os documentos novos — o que foi testado e onde>
- **Migração necessária:** sim/não — <se sim, como rodar e como reverter>

## Verificação

- [ ] `npm run lint` — 0 erros, 0 warnings
- [ ] `npm run test:ci` — N testes, 0 falhas
- [ ] `npm run test:rules` — N testes, 0 falhas
- [ ] `npm run build` — sucesso
- [ ] Cobertura ≥ 80% linhas / 75% branches
- [ ] Nenhum teste preexistente removido, pulado ou enfraquecido
- [ ] Nenhum segredo, chave ou `.env` versionado

## Riscos e plano de reversão

<o que pode quebrar em produção, com turma em aula, e como desfazer>
