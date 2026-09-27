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
 * O que pode existir no HTML de uma **mensagem de chat** — AC-CHAT-12.
 *
 * A lista do card mais `a`. Nada além disso: a conta que manteve `img` de fora
 * no card vale igual aqui, e com mais força, porque uma imagem remota num chat
 * de 40 pessoas entrega o IP de todo mundo ao servidor de quem a postou.
 */
export const TAGS_PERMITIDAS_NA_MENSAGEM = [...TAGS_PERMITIDAS, 'a'];

/**
 * Os três atributos do link, e a razão de cada um.
 *
 * `href` é o link. `rel` e `target` **não vêm do autor** — são escritos pelo
 * gancho abaixo, depois da sanitização. Estão na lista de permissão porque a
 * lista é aplicada ao resultado final, não porque o markdown possa ditá-los.
 */
const ATRIBUTOS_DO_LINK = ['href', 'rel', 'target'];

/**
 * Os esquemas de URL que podem virar link.
 *
 * Lista de permissão, como as tags. `http` e `https` são a conversa real de
 * uma sala de aula; `mailto` é o e-mail do professor. Fora disso não entra
 * nada — nem `data:`, que embute uma página inteira dentro do próprio link, e
 * muito menos o esquema que executa código.
 */
const ESQUEMAS_PERMITIDOS = /^(https?|mailto):/i;

const OPCOES_DA_MENSAGEM = {
  ...OPCOES_DE_SANITIZACAO,
  ALLOWED_TAGS: TAGS_PERMITIDAS_NA_MENSAGEM,
  ALLOWED_ATTR: ATRIBUTOS_DO_LINK,
  ALLOWED_URI_REGEXP: ESQUEMAS_PERMITIDOS,
};

/**
 * Carimba `rel` e `target` em todo link que sobreviveu à sanitização.
 *
 * `noopener` é o que importa: sem ele, a página aberta recebe `window.opener`
 * e pode trocar o endereço da aba de origem por uma cópia da tela de login do
 * SENAI, enquanto o aluno olha para a aba nova. `noreferrer` evita entregar de
 * onde ele veio.
 *
 * O gancho reescreve o valor em vez de completá-lo: um `rel="opener"` escrito
 * pelo autor do markdown precisa ser **substituído**, não respeitado.
 */
function carimbarLinkSeguro(elemento) {
  if (!elemento.hasAttribute || !elemento.hasAttribute('href')) return;

  elemento.setAttribute('rel', 'noopener noreferrer');
  elemento.setAttribute('target', '_blank');
}

/**
 * Converte a mensagem do chat em HTML seguro, com links clicáveis.
 *
 * É a mesma tranca de `paraHtmlSeguro`, com `a` na lista e os esquemas de URL
 * cortados — não um sanitizador paralelo. Duplicar o sanitizador seria criar
 * duas superfícies de ataque para manter iguais para sempre, e a segunda
 * receberia a próxima correção com atraso, ou nunca.
 *
 * O gancho do DOMPurify é **global**, então ele é registrado e removido em
 * volta desta chamada: sem o `finally`, a descrição do próximo chamado passaria
 * a ser sanitizada com a configuração do chat, e ninguém veria isso acontecer.
 *
 * @param {string|null|undefined} texto o que o aluno escreveu.
 * @returns {string} HTML com `a[href][rel][target]` e nada mais fora da lista.
 */
export function paraHtmlDeMensagem(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') return '';

  const html = marked.parse(texto, OPCOES_DO_PARSER);

  DOMPurify.addHook('afterSanitizeAttributes', carimbarLinkSeguro);

  try {
    return DOMPurify.sanitize(html, OPCOES_DA_MENSAGEM).trim();
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
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
