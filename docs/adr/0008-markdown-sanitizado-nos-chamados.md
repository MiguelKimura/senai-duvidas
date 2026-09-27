# ADR 0008 — Markdown sanitizado por lista de permissão nos chamados

- **Status:** aceita
- **Data:** 2026-09-21
- **Versão:** 0.7.0
- **Contexto da task:** `tasks/05-cor-card-markdown.md`
- **Critérios:** AC-COR-01 a AC-COR-10, AC-SEC-04

## Contexto

Até a v0.6.0 a descrição de um chamado era renderizada assim:

```jsx
<p>{problema.descricao}</p>
```

React escapa o que passa por ali. Não havia XSS na descrição porque não havia
HTML na descrição: `<script>alert(1)</script>` digitado por um aluno aparecia
na tela como os caracteres que ele digitou, e era o fim da história.

O AC-COR-07 pede markdown básico no card. Isso significa transformar texto
digitado por aluno em HTML e entregá-lo ao DOM — abrir mão, de propósito, da
única garantia que existia. O texto vem de qualquer pessoa da sala e o card é
visto por todo mundo da sala, professor incluído. Um XSS aqui é sessão de
professor tomada a partir de um chamado.

A cor do card tem o mesmo cheiro de coisa pequena: `Math.random()` gerava o
matiz, o texto do card usava a cor do CSS, e o contraste entre os dois nunca
foi verificado por ninguém.

## Decisão

### 1. O parser não é nosso, e a tranca também não

`marked` faz o parse do markdown; `DOMPurify` sanitiza o HTML resultante.

Escrever "um markdown simples à mão" com quatro expressões regulares é o atalho
óbvio e é onde nascem os XSS. A razão é estrutural: markdown exige escapar
HTML, substituir marcações e às vezes desescapar entidades, e qualquer ordem
errada entre essas etapas devolve ao texto já escapado a capacidade de virar
HTML de novo. Bibliotecas maduras erraram isso e corrigiram; um parser caseiro
erra isso e ninguém descobre.

A ordem é **parse primeiro, sanitização depois**. Invertê-la deixaria o
`marked` reconstruir HTML a partir do markdown já limpo, e o que ele
reconstruísse não teria passado por tranca nenhuma.

### 2. Lista de permissão, nunca lista de proibição

```js
ALLOWED_TAGS: ['p','br','strong','em','del','code','pre','ul','ol','li','blockquote']
ALLOWED_ATTR: []
```

Enumerar o que é perigoso é uma corrida que se perde: cada versão de navegador
traz um vetor que a lista de ontem não conhece — `<svg onload>`, `<math>` com
`xlink`, `formaction` em botão dentro de `<form>`. A lista de permissão diz o
que **pode** existir num card de chamado, e some com o resto, inclusive com o
que ninguém previu.

**Nenhum atributo passa.** Sem atributo não há `onerror`, não há `href`, não há
`style` e não há o próximo atributo executável que algum navegador inventar. O
único que se perde é o `class="language-js"` que o `marked` põe no bloco de
código; destaque de sintaxe não é escopo desta versão.

### 3. Nem link nem imagem nesta versão

`a` e `img` estão fora da lista por decisão, não por esquecimento.

A imagem do chamado é o **anexo**: validado por magic bytes, comprimido no
cliente e guardado no Storage da sala, com rule que pergunta se quem lê é
membro daquela sala (ADR 0007). Uma `<img src="https://...">` escrita na
descrição não passaria por nada disso — e, ao carregar, entregaria o IP de toda
a turma ao servidor do outro lado.

Links cairiam na mesma conversa, com phishing por cima. O texto visível do link
é preservado (`[o manual](url)` vira "o manual"), então a frase não perde
sentido.

### 4. O campo `formato`, e por que ele não é opcional

Todo chamado gravado até a v0.6.0 é texto puro. Texto puro de laboratório tem
`*`, `_` e `#` dentro: caminho de arquivo com curinga, nome de variável com
sublinhado, "# 12 travou". Interpretar tudo isso como markdown mudaria, sem
aviso e sem tocar no banco, o que está escrito em cards que já existem.

`formato` é aditivo e tem padrão seguro na leitura:

| valor | significado |
|---|---|
| ausente | `"texto"` — o formato de todo chamado até a v0.6.0 |
| `"texto"` | texto puro, escapado por React |
| `"markdown"` | passa por `paraHtmlSeguro` |
| qualquer outro | `"texto"` |

Valor desconhecido cair em `"texto"` é deliberado: se uma versão futura
inventar um formato que esta não sabe renderizar, mostrar o texto cru é
degradação; tentar adivinhar é risco.

A compatibilidade **futura** vem de graça pela mesma escolha: um cliente da
v0.6.0 que receba um chamado com `formato: "markdown"` ignora o campo e mostra
`**cabo**` com os asteriscos à vista. Degradação prevista, e testada em
`src/__tests__/compatibilidadeFutura.test.js`.

### 5. A cor sai do sorteio para uma paleta verificada

Nove cores em `src/utils/paleta.js`, cada uma com a cor de texto que a
acompanha. `razaoContraste(a, b)` implementa a fórmula de luminância relativa
do WCAG 2.1, e um teste percorre a paleta inteira exigindo 4,5:1.

O valor disso não está na lista: está no teste. Ele é o que faz a próxima cor
bonita e ilegível reprovar o CI em vez de chegar à aula.

`cor` **não muda de forma**: continua sendo uma string CSS no mesmo campo de
sempre. Guardar um id (`"azul"`) seria mais limpo e quebraria toda aba aberta
na versão anterior, que põe o valor direto em `backgroundColor`.

A cor de **texto** só é aplicada quando o fundo é da paleta. Para os chamados
de cor sorteada, o `style` sai sem `color` e o CSS de sempre continua mandando
— qualquer outra escolha mudaria a aparência de chamados que já existem.

### 6. A preferência de cor mora no `localStorage`

E é validada contra a paleta na leitura **e** na escrita. `localStorage` é
editável por qualquer aluno pelo console do navegador, e o valor lido dali iria
para o `backgroundColor` de um card que a turma inteira vê. Só o que está na
paleta passa.

## Alternativas consideradas

### `react-markdown` com `rehype-sanitize`

**Viável, descartada por peso.** Traz a árvore `unified`/`remark`/`rehype`
inteira para o bundle de um app que precisa de negrito, itálico, lista e
código. `marked` + `dompurify` resolvem o mesmo com duas dependências pequenas,
e `dompurify` é a referência em sanitização de HTML no navegador.

A troca tem um custo declarado: `dangerouslySetInnerHTML`. Ele está confinado a
**uma** linha, em `TextoMarkdown.jsx`, com a sanitização na linha imediatamente
acima — onde quem revisa vê as duas de uma vez.

### Escrever o parser à mão

**Descartada.** É a seção 1 inteira.

### Sanitizar só na escrita, e confiar na leitura

**Descartada.** O banco tem outra porta: as Security Rules aceitam escrita de
qualquer membro da sala, e quem trocar o app por um `curl` não passa pelo nosso
sanitizador. Sanitizar na leitura é o que vale para o documento que já está
gravado — inclusive os que a migração da task 03 copiou da coleção global.

Sanitizar nos dois lados seria melhor, e a escrita continua sem isso porque a
rule não consegue analisar HTML. O que a rule faz é o que ela pode fazer:
limitar o tamanho da descrição.

### Interpretar todo chamado como markdown, sem o campo `formato`

**Descartada.** Uma linha a menos de código, em troca de mudar silenciosamente
o texto de chamados que já estão na tela de alguém.

### Um componente próprio de disclosure, em vez de `<details>`

**Descartada.** Seria reimplementar foco, `Tab`, `Enter`, `Espaço`, estado
aberto e o triângulo — tudo que o elemento nativo já faz certo. Ainda: o
`Ctrl+F` do navegador encontra texto dentro de um `<details>` fechado e o abre
sozinho, e nenhuma implementação em React faz isso.

## Consequências

**Boas**

- O aluno escreve o erro em três linhas e vê três linhas; cola a mensagem do
  compilador entre crases e ela sai separada do resto da frase.
- A cor do card virou informação: o aluno marca o próprio chamado e o professor
  o acha de relance numa fila de quarenta.
- Toda cor oferecida é legível, e o teste de contraste impede que isso mude.
- O painel inteiro é alcançável por teclado e anunciado por leitor de tela.
- `TextoMarkdown` e `paraHtmlSeguro` são independentes de tela, e é isso que a
  task 06 vai reaproveitar no chat (AC-CHAT-12) em vez de escrever a segunda
  sanitização do projeto.

**Custos aceitos**

- **Um `dangerouslySetInnerHTML` no código.** Confinado a uma linha e a um
  arquivo, com o sanitizador logo acima. É o preço de renderizar markdown sem
  carregar uma árvore de dependências.
- **Duas dependências novas.** `marked` e `dompurify` passam a ser superfície
  de atualização de segurança. Em troca, são duas das bibliotecas mais
  auditadas do ecossistema para o que fazem.
- **Markdown é surpresa para quem não o conhece.** Um aluno que escreva
  `2 * 3 * 4` numa descrição nova verá itálico onde não pediu. O painel explica
  a sintaxe aceita e a prévia mostra o resultado antes do envio; é o que dá
  para fazer sem inventar um editor.
- **A preferência de cor não atravessa máquinas.** Trocar de computador
  recomeça da cor automática.
- **A rule não valida `formato` nem `cor`.** Uma escrita feita fora do app pode
  gravar `formato: "markdown"` com qualquer descrição — e é justamente o caso
  que a sanitização na leitura cobre. Validar os dois campos na rule é
  endurecimento barato e está anotado para a task 09 (AC-SEC).

## Referências

- `src/utils/markdown.js` — parse, lista de permissão e `formatoDoTexto`
- `src/utils/paleta.js` — `razaoContraste` e as nove cores
- `src/utils/__tests__/markdown.test.js` — os doze vetores de XSS, verificados no DOM
- `src/components/TextoMarkdown.jsx` — o único `dangerouslySetInnerHTML` do projeto
- ADR 0007 — por que a imagem do chamado é o anexo, e não uma `<img>` na descrição
- `tasks/_PROTOCOLO.md` § 4 — a regra de campo aditivo que `formato` segue
