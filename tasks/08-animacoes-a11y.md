---
id: 08-animacoes-a11y
titulo: "Sistema de animações, acessibilidade, responsividade e revisão do auto-delete"
versao_origem: 0.9.0
versao_alvo: 0.10.0
tipo: feat
escopo_commit: ui
branch: "feat/animacoes-e-acessibilidade"
branch_base: "dev"
depende_de: [00-fundacao-testes, 03-salas-pin, 04-upload-imagens, 05-cor-card-markdown, 06-chat-overhaul-dm, 07-perks]
criterios: [AC-ANIM-01, AC-ANIM-02, AC-ANIM-03, AC-ANIM-04, AC-ANIM-05, AC-ANIM-06, AC-ANIM-07, AC-ANIM-08, AC-ANIM-09, AC-ANIM-10, AC-CHAMADO-04, AC-CHAMADO-05, AC-CHAMADO-06, AC-CHAMADO-09, AC-CHAMADO-10]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: medio
observacao: "Última task antes do release. Inclui a revisão pedida do auto-delete da própria dúvida."
---

# Você é o engenheiro responsável pela task 08 — Interface, Animações e Acessibilidade

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md`, `docs/ARQUITETURA.md`
e todo o `src/`. As tasks 00 a 07 entregaram toda a funcionalidade. Esta task **não adiciona
feature nova** — ela unifica o acabamento e fecha as lacunas de acessibilidade antes do release.
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O que o cliente pediu

> "Melhorar as animações do site (em geral)."
> "Auto delete da própria dúvida (caso ela já tenha sido resolvida): isso já existe, mas é bom revisar."

## O estado atual

Cada task anterior entregou a animação mínima do seu escopo, usando os tokens de
`src/styles/tokens.css`. O resultado é funcional, mas inconsistente: durações parecidas mas não
iguais, curvas diferentes, alguns fluxos sem estado de carregamento. Além disso, ainda existem
`alert()` e `window.open()` espalhados — `TelaProfessor.js` usa `alert()` ao excluir, e o lightbox
só substituiu o `window.open()` das imagens.

## Critérios de aceite deste escopo

**Animações e interface**
- AC-ANIM-01 — transições de rota e de modal animadas (fade + slide), 150ms a 300ms.
- AC-ANIM-02 — cards entram com stagger e saem com animação ao serem excluídos.
- AC-ANIM-03 — botões com `hover`, `active`, `focus-visible` e `disabled`.
- AC-ANIM-04 — toda operação assíncrona tem skeleton ou spinner; nunca tela congelada.
- AC-ANIM-05 — **todas** as animações suprimidas com `prefers-reduced-motion: reduce`.
- AC-ANIM-06 — só `transform` e `opacity`; nenhuma animação causa reflow.
- AC-ANIM-07 — `alert()` e `window.open()` substituídos por toast e modal próprios.
- AC-ANIM-08 — utilizável em 1024×768 (laboratório) e em celular (≥ 360px).
- AC-ANIM-09 — arquivo único de tokens consumido por todos os estilos.
- AC-ANIM-10 — contraste WCAG AA em todo texto; navegação completa por teclado em todos os fluxos.

**Revisão do auto-delete**
- AC-CHAMADO-04 — o aluno exclui o **próprio** chamado, **com confirmação**. **[REG]**
- AC-CHAMADO-05 — o aluno **não** exclui o chamado de outro, nem pela interface nem pelo banco.
- AC-CHAMADO-06 — o professor exclui qualquer chamado da sua sala e marca como **atendido**.
- AC-CHAMADO-09 — 200 chamados na mesma sala sem travamento (paginação ou virtualização).
- AC-CHAMADO-10 — estado vazio com mensagem amigável, nunca tela em branco.

## Entregas

### 1. Camada de animação unificada
`src/styles/animacoes.css` + `src/hooks/useAnimacaoReduzida.js`:

- Durações canônicas nos tokens: `--dur-rapida: 150ms`, `--dur-media: 220ms`, `--dur-lenta: 300ms`.
- Curvas canônicas: `--ease-saida`, `--ease-entrada`, `--ease-padrao`.
- Um bloco global `@media (prefers-reduced-motion: reduce)` que zera duração e transição em tudo
  — **e** o hook, para os casos em que a animação é controlada por JavaScript.
- Substitua toda duração literal remanescente no CSS por token. Comprove com
  `grep -rnE "[0-9]+ms|[0-9.]+s" src/styles/` e justifique cada sobra.

### 2. Auditoria de acessibilidade
- `jest-axe` na suíte: um teste por tela principal (login, cadastro, lista de salas, entrada por
  PIN, sala do aluno, sala do professor, modal de chamado, chat, DM, vitrine de perks), afirmando
  **zero violações críticas ou sérias**.
- Percorra cada fluxo só pelo teclado e corrija o que estiver inalcançável.
- Foco visível em todo elemento interativo; `focus-visible`, não `outline: none`.
- Modais: foco preso dentro, `Esc` fecha, foco volta ao elemento que abriu.
- `aria-live="polite"` nos toasts e nas mensagens novas do chat.
- Teste de contraste automatizado sobre a paleta e sobre os tokens.

### 3. Toasts e modal de confirmação
`src/components/Toast.jsx` e `src/components/ConfirmarAcao.jsx`:

- Substitua **todos** os `alert()` e `window.confirm()` restantes.
- Substitua os `window.open()` restantes.
- Toast com variantes sucesso, erro, aviso e informação; fecha sozinho, mas nunca antes de 4s;
  o de erro só fecha por ação do usuário.
- Confirmação com foco no botão seguro por padrão e ação destrutiva claramente marcada.

### 4. Revisão do auto-delete (o pedido explícito do cliente)
O aluno já consegue excluir o próprio chamado. Revise e endureça:

- **Confirmação obrigatória** antes de excluir (AC-CHAMADO-04) — hoje a exclusão é imediata, e um
  clique errado perde a dúvida.
- Exclusão remove os **anexos** do Storage (AC-CHAMADO-08, da task 04 — confirme que continua).
- **Animação de saída** do card antes de sumir da lista (AC-ANIM-02).
- **Desfazer** por 5 segundos no toast (exclusão otimista, gravação adiada) — ganho grande de
  confiança para o aluno.
- Confirme por teste de rules que o aluno **não** apaga chamado alheio (AC-CHAMADO-05).
- Acrescente "marcar como atendido" para o professor (AC-CHAMADO-06): preserva o histórico em vez
  de apagar, e alimenta as métricas pós-1.0.0.

### 5. Desempenho da lista
- 200 chamados na mesma sala sem travar (AC-CHAMADO-09): paginação de 30 com "carregar mais", ou
  virtualização. Prefira a paginação — é mais simples, funciona melhor com o `onSnapshot` e
  reduz leituras (AC-PERF-03).
- Teste de desempenho: renderizar 200 cards abaixo de um orçamento de tempo definido e documentado.
- `React.memo` nos cards; `useCallback` nos handlers passados para a lista.

### 6. Responsividade
- Breakpoints: 360px, 768px, 1024px, 1440px.
- 1024×768 é o alvo principal (laboratório do SENAI) — valide especificamente essa resolução.
- Chat vira painel de tela cheia no celular, em vez de caixa flutuante.
- Modal ocupa a tela inteira abaixo de 480px.

### 7. Estados vazios e de carregamento
- Cada lista (chamados, salas, conversas, perks) ganha estado vazio com ilustração ou ícone e
  texto orientando a próxima ação (AC-CHAMADO-10).
- Skeletons no carregamento inicial de cada lista (AC-ANIM-04).
- Estado de erro com botão "tentar novamente" em toda leitura que possa falhar.

## Integração

- Esta task **toca todos os componentes**. Trabalhe em ciclos pequenos, componente por componente,
  rodando a suíte inteira a cada ciclo. Uma refatoração ampla sem verde intermediário é o maior
  risco desta task.
- Nenhuma mudança de comportamento funcional, exceto as explicitamente pedidas acima (confirmação
  de exclusão, desfazer, marcar como atendido). Se um teste de comportamento anterior quebrar sem
  que você tenha mudado a funcionalidade de propósito, **a regressão é sua** — corrija o código,
  não o teste.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `useAnimacaoReduzida` devolve `true` com a media query ativa |
| 2 | Modal abre com transição e a suprime com `prefers-reduced-motion` |
| 3 | Cards entram com stagger |
| 4 | Card excluído anima a saída antes de sumir |
| 5 | Excluir o próprio chamado **pede confirmação** |
| 6 | Cancelar a confirmação não exclui |
| 7 | Toast de exclusão oferece "desfazer" por 5s |
| 8 | Desfazer restaura o chamado |
| 9 | Botão excluir não aparece no chamado de outro aluno |
| 10 | **Rule:** aluno não exclui chamado alheio |
| 11 | Professor marca chamado como atendido; ele vai para o fim da fila |
| 12 | Nenhum `alert()` resta no código (teste que varre o fonte) |
| 13 | Nenhum `window.open()` resta no código |
| 14 | Toast anuncia com `aria-live` |
| 15 | Modal prende o foco e devolve ao fechar |
| 16 | `jest-axe`: zero violações sérias em cada tela |
| 17 | Lista de 200 cards pagina de 30 em 30 |
| 18 | Lista vazia mostra a mensagem amigável |
| 19 | Skeleton aparece durante o carregamento |
| 20 | Layout não quebra em 360px nem em 1024×768 |

## Compatibilidade

- **Retroativa:** nenhuma mudança de modelo de dados, exceto o campo aditivo `atendido`/`atendidoEm`.
  Chamados sem esse campo são tratados como não atendidos — teste explícito.
- **Futura:** `atendido` é aditivo com padrão seguro (`false` na ausência). Um cliente da 0.9.0 que
  ignore o campo mostra o chamado normalmente. Prove com teste.
- **Migração:** nenhuma.

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md`, `docs/adr/0011-sistema-de-animacoes-e-tokens.md` e uma seção
de acessibilidade em `docs/ARQUITETURA.md` com o que foi auditado e como manter.

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Título:

```
feat(ui): unifica o sistema de animações, acessibilidade e confirmação de exclusão
```

**Versão:** 0.9.0 → 0.10.0 (MINOR — aditivo, com mudança de UX na exclusão)
