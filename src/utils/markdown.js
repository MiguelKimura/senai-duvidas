// Markdown básico, sanitizado — AC-COR-07, AC-COR-08, AC-SEC-04.
//
// O que este módulo faz cabe em uma frase: transforma o que o aluno escreveu
// em HTML e joga fora tudo que não estiver na lista curta do que pode existir
// num card de chamado.
//
// Duas decisões que valem ser lidas antes de mexer aqui:
//
// **1. O parser não é nosso.** Escrever um "markdown simples à mão" com
// expressões regulares é o caminho mais curto para um XSS: basta uma ordem de
// substituição errada para o texto escapado voltar a ser HTML. `marked` é o
// parser, `dompurify` é a tranca, e nenhum dos dois foi escrito aqui.
//
// **2. A lista é de permissão, não de proibição.** Enumerar o que é perigoso é
// uma corrida que se perde: cada versão de navegador inventa um vetor novo, e
// a lista de proibidos de ontem não o conhece. `ALLOWED_TAGS` diz o que **pode**
// existir; o resto some, inclusive o que ninguém previu.
//
// O módulo não importa React de propósito. O chat da task 06 (AC-CHAT-12) usa
// exatamente esta função, e uma dependência de componente aqui obrigaria a
// duplicá-la lá — que é como as duas sanitizações divergem.
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/** Descrição escrita na v0.7.0 ou depois: pode conter markdown. */
export const FORMATO_MARKDOWN = 'markdown';

/** Descrição escrita antes, ou por cliente que não conhece o campo: texto puro. */
export const FORMATO_TEXTO = 'texto';

/**
 * O que pode existir no HTML de um chamado.
 *
 * `a` e `img` estão de fora por decisão desta versão, não por esquecimento. A
 * imagem do chamado é o anexo, que passa por validação de tipo e sobe para o
 * Storage da sala (ADR 0007); uma `<img>` escrita na descrição apontaria para
 * qualquer servidor da internet e entregaria a ele o IP de toda a turma ao
 * carregar. Links cairiam na mesma conversa, com phishing por cima — e a
 * v0.7.0 não tem por que abrir essa porta para ganhar uma sublinha azul.
 */
export const TAGS_PERMITIDAS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
];

/**
 * Nenhum atributo passa.
 *
 * Sem atributo nenhum não há `onerror`, não há `href`, não há `style` e não há
 * o próximo atributo executável que algum navegador inventar. O único que se
 * perde é o `class="language-js"` que o `marked` põe no bloco de código, e o
 * destaque de sintaxe não está no escopo desta versão.
 */
const ATRIBUTOS_PERMITIDOS = [];

const OPCOES_DE_SANITIZACAO = {
  ALLOWED_TAGS: TAGS_PERMITIDAS,
  ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  // Sem isto, o conteúdo de um `<script>` removido sobreviveria como texto
  // visível no card — feio, e a um `innerHTML` de distância de voltar a ser
  // código.
  FORBID_CONTENTS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template'],
};

const OPCOES_DO_PARSER = {
  // `breaks` exige `gfm`. A quebra de linha simples virar `<br>` é requisito:
  // o aluno escreve o erro em três linhas e espera vê-lo em três linhas.
  gfm: true,
  breaks: true,
  // O parser não recebe o texto em pedaços; pedir que ele não se prepare para
  // isso evita estado entre chamadas.
  async: false,
};

/**
 * Converte markdown em HTML seguro para ir ao DOM.
 *
 * A ordem importa e é a única correta: **parse primeiro, sanitização depois**.
 * Sanitizar antes deixaria o `marked` reconstruir HTML a partir do markdown já
 * limpo — e o que ele reconstrói não passou por tranca nenhuma.
 *
 * @param {string|null|undefined} texto o que o aluno escreveu.
 * @returns {string} HTML sem tag fora da lista, sem atributo e sem URL executável.
 */
export function paraHtmlSeguro(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') return '';

  const html = marked.parse(texto, OPCOES_DO_PARSER);

  return DOMPurify.sanitize(html, OPCOES_DE_SANITIZACAO).trim();
}

/**
 * Como a descrição de um documento deve ser lida.
 *
 * O padrão é `texto`, e é o padrão porque é a verdade sobre o banco: todo
 * chamado gravado até a v0.6.0 é texto puro, e nenhum deles tem este campo.
 * Interpretar o legado como markdown transformaria `2 * 3 * 4` em `2 3 4` com
 * itálico no meio, num card que já está na tela de alguém (AC-COR-05).
 *
 * Valor desconhecido também cai em `texto`: se uma versão futura inventar um
 * formato que esta não sabe renderizar, mostrar o texto cru é degradação; tentar
 * adivinhar é risco.
 *
 * @param {{formato?: string}|null|undefined} documento chamado ou mensagem.
 * @returns {'markdown'|'texto'}
 */
export function formatoDoTexto(documento) {
  return documento && documento.formato === FORMATO_MARKDOWN ? FORMATO_MARKDOWN : FORMATO_TEXTO;
}
