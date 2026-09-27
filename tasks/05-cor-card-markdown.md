---
id: 05-cor-card-markdown
titulo: "Menu oculto de opções avançadas: cor do card e markdown"
versao_origem: 0.6.0
versao_alvo: 0.7.0
tipo: feat
escopo_commit: chamados
branch: "feat/opcoes-avancadas-do-card"
branch_base: "dev"
depende_de: [00-fundacao-testes, 03-salas-pin, 04-upload-imagens]
criterios: [AC-COR-01, AC-COR-02, AC-COR-03, AC-COR-04, AC-COR-05, AC-COR-06, AC-COR-07, AC-COR-08, AC-COR-09, AC-COR-10, AC-SEC-04]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: medio
observacao: "Feature pequena com risco de XSS alto. A sanitização do markdown é o ponto crítico."
---

# Você é o engenheiro responsável pela task 05 — Opções Avançadas do Card

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md` e todo o `src/`.
Tasks 00 a 04 entregaram harness, auth, tempo do servidor, salas e anexos.
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O que o cliente pediu, nas palavras dele

> "O menu de abrir um chamado é bem simples: tem a parte de escrever sobre o problema e o campo
> pra colar link de imagem. Eu queria uma setinha em cinza que, quando aberta, mostrasse opções
> de cor para o card."

Ou seja: o modal precisa continuar **simples por padrão**. O aluno com pressa abre, escreve e
envia. Quem quiser mais controle clica numa setinha discreta e ganha cor do card e formatação.
Se a setinha chamar atenção ou o painel abrir por padrão, a feature falhou.

Hoje, em `TelaAluno.js`, a cor é sorteada:
`const novaCor = \`hsl(${Math.random() * 360}, 70%, 80%)\`` — às vezes sai legível, às vezes não.
A cor escolhida pelo aluno substitui o sorteio; sem escolha, o sorteio **continua** (AC-COR-05).

## Critérios de aceite deste escopo

- AC-COR-01 — **setinha cinza discreta** (disclosure) abaixo dos campos principais, **fechada por
  padrão**.
- AC-COR-02 — ao clicar, o painel expande com animação suave.
- AC-COR-03 — paleta de cores predefinidas com contraste de texto garantido (**WCAG AA, ≥ 4.5:1**).
- AC-COR-04 — a cor é persistida no chamado e usada como fundo do card para todos.
- AC-COR-05 — sem escolha, mantém a cor automática de hoje. **[REG]**
- AC-COR-06 — acessível por teclado (`Tab` + `Enter`/`Espaço`), com `aria-expanded` correto e
  rótulo audível por leitor de tela.
- AC-COR-07 — markdown básico na descrição: negrito, itálico, listas e `código`, renderizado no card.
- AC-COR-08 — **sanitização**: nenhuma tag `<script>`, `<iframe>`, handler `on*` ou URL
  `javascript:` chega ao DOM.
- AC-COR-09 — preview ao vivo do card com cor e markdown aplicados. **[POS]** — entregue se couber.
- AC-COR-10 — a última cor escolhida vira o padrão do próximo chamado. **[POS]**
- AC-SEC-04 — todo texto do usuário é escapado ou sanitizado antes de ser renderizado.

## Desenho pedido

```
src/components/PainelAvancado.jsx  -> <details>/<summary> acessível, com a setinha cinza
src/components/SeletorDeCor.jsx    -> paleta como radiogroup navegável por setas
src/components/TextoMarkdown.jsx   -> renderiza markdown sanitizado
src/utils/paleta.js                -> cores com contraste pré-calculado
src/utils/markdown.js              -> parse + sanitização
```

**A setinha (AC-COR-01, AC-COR-02, AC-COR-06):** prefira `<details>`/`<summary>` nativo — já vem
com semântica, teclado e `aria-expanded` de graça. Estilize o marcador como uma seta cinza discreta
e anime a altura com `max-height`/`transform` + `opacity`, respeitando `prefers-reduced-motion`.
Se implementar com componente próprio, replique **todo** o comportamento de acessibilidade do
elemento nativo e prove por teste.

**A paleta (AC-COR-03):** de 8 a 10 cores de fundo, cada uma com a cor de texto definida e o
contraste calculado. Escreva o cálculo de contraste como função testada (`razaoContraste(a, b)`,
fórmula WCAG de luminância relativa) e crie um teste que percorre **toda** a paleta afirmando
`≥ 4.5`. Assim ninguém acrescenta uma cor bonita e ilegível no futuro.

**O markdown (AC-COR-07, AC-COR-08, AC-SEC-04):** use uma biblioteca madura
(`marked` + `dompurify`, ou `react-markdown` com `rehype-sanitize`). **Não escreva um parser de
markdown à mão** — é exatamente onde nascem os XSS. Permita apenas: `**negrito**`, `*itálico*`,
`- lista`, `1. lista`, `` `código` ``, ``` bloco ``` e quebra de linha. Proíba HTML bruto, imagens
inline e links automáticos nesta versão.

Escreva testes de XSS com a lista completa de vetores:
`<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `[clique](javascript:alert(1))`,
`<iframe src="...">`, `<svg onload=alert(1)>`, `<a href="data:text/html,...">`,
`<style>@import</style>` e um HTML entity duplamente codificado.

## Integração

- **Task 04:** o `CampoAnexo` já está no modal. O `PainelAvancado` vai **abaixo** dele; o campo de
  URL de imagem pode migrar para dentro do painel avançado se isso simplificar a tela principal —
  mas o fluxo de colar URL precisa continuar alcançável em no máximo dois cliques (AC-IMG-01).
- **Task 03:** a cor é gravada em `salas/{salaId}/chamados/{id}.cor`, mesmo nome de campo de hoje.
- **Task 06 (chat):** `TextoMarkdown` e a sanitização serão reaproveitados pelo chat (AC-CHAT-12).
  Projete os dois utilitários como módulos independentes de componente.
- **Task 08 (animações):** use as durações dos tokens de `src/styles/tokens.css`; não invente valor
  novo de duração.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `razaoContraste` calcula corretamente casos conhecidos (branco/preto = 21) |
| 2 | Toda cor da paleta tem contraste ≥ 4.5 com seu texto |
| 3 | Painel avançado começa **fechado** |
| 4 | Clicar na setinha expande e ajusta `aria-expanded` |
| 5 | `Tab` alcança a setinha e `Enter` a aciona |
| 6 | Setinha tem rótulo acessível ("Opções avançadas") |
| 7 | Escolher cor grava `cor` no chamado |
| 8 | Sem escolha, o chamado recebe a cor automática de hoje (retrocompat) |
| 9 | Setas do teclado navegam entre as cores do radiogroup |
| 10 | `**negrito**` vira `<strong>` no card |
| 11 | `- item` vira `<ul><li>` |
| 12 | `<script>alert(1)</script>` **não** chega ao DOM |
| 13 | `<img src=x onerror=...>` tem o handler removido |
| 14 | `[x](javascript:alert(1))` não vira link executável |
| 15 | Texto sem markdown renderiza idêntico a hoje (retrocompat) |
| 16 | Preview reflete cor e markdown ao vivo |
| 17 | Com `prefers-reduced-motion`, o painel abre sem animação |

## Compatibilidade

- **Retroativa:** chamados antigos têm `cor` em `hsl(...)` sorteado e `descricao` em texto puro.
  Ambos precisam renderizar exatamente como hoje. Teste com um chamado antigo que contenha
  caracteres que o markdown interpretaria (`*`, `_`, `#`) e prove que **não** houve mudança visual
  indesejada — se o texto legado passar a ser interpretado como markdown, use o campo
  `formato: "markdown" | "texto"` (ausente = `"texto"`) para preservar o legado.
- **Futura:** `formato` é aditivo; um cliente antigo que ignore o campo mostra o markdown como
  texto cru — degradação aceitável e testada. `cor` continua string CSS válida, legível por
  qualquer versão.

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md` e `docs/adr/0008-markdown-sanitizado-nos-chamados.md`.

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Título:

```
feat(chamados): adiciona painel oculto de opções avançadas com cor do card e markdown
```

**Versão:** 0.6.0 → 0.7.0 (MINOR — aditivo)
