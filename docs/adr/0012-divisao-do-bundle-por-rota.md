# ADR 0012 — Divisão do bundle por rota, com orçamento que reprova o CI

- **Status:** aceita
- **Data:** 2026-09-26
- **Versão:** 1.0.0
- **Contexto da task:** `tasks/09-hardening-release.md`
- **Critérios:** AC-PERF-01, AC-PERF-02

## Contexto

O AC-PERF-02 pede menos de 300 KB gzip no que o navegador baixa para abrir a
primeira tela, **com code-splitting por rota**. A auditoria da 1.0.0 encontrou
duas coisas ao mesmo tempo:

1. O bundle **estava dentro do teto** — 218,76 KB gzip. Isso parecia bom e não
   era: nada media esse número, e nada quebrava se ele dobrasse. Um orçamento
   que não tem alarme é uma frase num documento, e a frase envelhece na primeira
   dependência nova que alguém acrescentar sem olhar.
2. **Não havia divisão nenhuma.** Um único `main.js` continha todas as telas. O
   aluno que abria o site para fazer login baixava, antes de ver o campo de
   e-mail, a tela do professor, o painel de premiações, a animação em tela cheia
   e o visualizador de anexo — código que ele talvez nunca execute, e que no
   caso da tela do professor ele *nunca* vai executar.

O contexto concreto importa mais do que o número: a rede do laboratório é
compartilhada por uma turma inteira que chega junto e abre o site ao mesmo
tempo. O que se está economizando não é o tempo de um download; é a contenção de
quarenta downloads simultâneos no mesmo enlace, no minuto em que a aula começa.

### As alternativas consideradas

**Não fazer nada, já que cabe no teto.** Descartada pelo item 2: o critério pede
divisão por rota explicitamente, e a razão dele é a de cima. E cabia hoje;
"hoje" não é uma garantia.

**Dividir por biblioteca (`splitChunks` com `vendor`).** Separaria React e
Firebase do código da aplicação, o que melhora o cache entre deploys mas **não
reduz o primeiro carregamento**: o navegador continua baixando tudo antes da
primeira tela. Resolve um problema que este projeto não tem (deploys frequentes
para usuários que voltam) e não resolve o que ele tem.

**Ejetar o Create React App para configurar o webpack à mão.** Daria controle
total e custaria a manutenção da configuração inteira para sempre, num projeto
que vai ser mantido por quem vier depois. `React.lazy` entrega o mesmo resultado
sem tocar na configuração.

## Decisão

**Cada tela de rota entra por `React.lazy(() => import(...))`**, em `src/App.js`,
com um único `<Suspense>` em volta de todas as rotas. São oito: `Login`,
`Cadastro`, `TelaAluno`, `TelaProfessor`, `MinhasSalas`, `EntrarComPin`,
`CriarSala` e `Sala`. O webpack emite um pedaço por `import()` dinâmico, e o
navegador só busca o da rota que a pessoa abriu.

Um `Suspense` só, e não um por rota: a troca de rota mostra um estado de
carregamento único e previsível, em vez de cada tela inventar o seu.

**O orçamento é verificado por `scripts/verificarOrcamentoDoBundle.js`**, que lê
o `asset-manifest.json` do build, soma o gzip do que a primeira tela baixa,
compara com 300 KB e **sai com código 1** quando estoura. O CI roda o script
depois do build: estourar o teto reprova o PR.

O verificador também exige que exista **pelo menos um** pedaço de rota, e não um
número exato. A intenção é distinguir "dividido" de "monolítico"; exigir oito
amarraria o verificador ao número de telas de hoje, e a primeira fusão de duas
rotas reprovaria um build correto.

O desenho do script segue o de `scripts/gerarChangelog.js`: as funções puras
ficam testadas em `scripts/__tests__/verificarOrcamentoDoBundle.test.js`, e a
casca que lê `process.argv` não tem regra nenhuma dentro.

## Consequências

**Boas**

- A primeira tela baixa menos, e o quanto menos é medido a cada build em vez de
  presumido.
- O orçamento passa a ter dente: uma dependência pesada acrescentada sem
  pensar reprova o PR de quem a acrescentou, e não de quem vier depois.
- Cada tela nova nasce no próprio pedaço, sem ninguém precisar lembrar.
- O FCP em 3G rápida, medido em `tests/e2e/desempenho.spec.js`, passa a ser uma
  medida de algo que realmente chega ao aluno (AC-PERF-01).

**Custos aceitos**

- **A troca de rota tem um salto de rede.** Quem sai do login para a sala espera
  o pedaço da sala chegar. É a troca deliberada: uma espera curta no meio, em
  vez de uma espera longa na entrada, quando a turma inteira está abrindo o site
  junto.
- **Mais requisições no total** para quem percorre muitas telas numa sessão. Em
  HTTP/2 isso é barato, e o perfil de uso real é o contrário — o aluno abre uma
  ou duas telas e fica nelas a aula inteira.
- **O `Suspense` precisa de um estado de carregamento que não pisque.** Está em
  `CarregandoRota`, e é coberto pelos testes de rota.
- O verificador **depende do formato do `asset-manifest.json`** do Create React
  App. Se o projeto trocar de empacotador, o script precisa ser reescrito — é um
  arquivo pequeno, e o teste dele diz exatamente o que ele espera.

## Verificação

- `src/__tests__/divisaoPorRota.test.js` — toda tela de rota entra por `lazy`
- `scripts/__tests__/verificarOrcamentoDoBundle.test.js` — o verificador de fato
  reprova um build estourado, e não só aprova o que cabe
- `tests/e2e/desempenho.spec.js` — o FCP em 3G rápida, no navegador de verdade
