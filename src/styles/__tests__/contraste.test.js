// O contraste da interface inteira — AC-ANIM-10.
//
// `src/utils/__tests__/paleta.test.js` já roda a conta da WCAG sobre a paleta
// do card: nove fundos, um texto, nove asserções. O que ele **não** cobre é o
// resto do app — o vermelho dos botões, o cinza dos rótulos, o azul dos links
// do chat —, e é ali que estão as reprovações de verdade.
//
// Este teste fecha o outro lado. Ele lê `tokens.css`, resolve os apelidos e
// roda a mesma conta sobre os pares que a interface realmente pratica. Cada
// par traz **onde** ele acontece, com arquivo e seletor: o par que ninguém
// consegue apontar na tela é par imaginário, e a tabela cresceria sem limite.
//
// Por que a tabela é escrita à mão, e não extraída do CSS: saber qual fundo
// está atrás de um texto exige resolver a cascata e a árvore do documento, e
// jsdom não aplica folha de estilo. Uma extração automática erraria o fundo e
// aprovaria o par errado — e um teste de contraste que aprova o errado é pior
// do que nenhum. A tabela é a leitura humana do CSS, conferida pela máquina.
//
// O que fazer quando este teste ficar vermelho: **mudar a cor**, nunca o
// piso. 4,5:1 é o mínimo da WCAG AA para texto normal e 3:1 o de elemento não
// textual; os dois números são de fora deste projeto e não se negociam aqui.
const fs = require('fs');
const path = require('path');

const { CONTRASTE_MINIMO, razaoContraste } = require('../../utils/paleta');

/** O piso da WCAG 2.1 para o que não é texto: borda, ícone, anel de foco. */
const CONTRASTE_MINIMO_NAO_TEXTUAL = 3;

const CAMINHO_TOKENS = path.join(__dirname, '..', 'tokens.css');

/**
 * Os nomes de cor do CSS que os tokens ainda usam, em hexadecimal.
 *
 * `razaoContraste` recusa o que não é hexadecimal de propósito — devolver um
 * número plausível para uma string desconhecida faria este arquivo inteiro
 * passar à toa. Traduzir aqui é explícito e a lista é curta; se ela crescer, o
 * sinal é que `tokens.css` está voltando a misturar notações.
 */
const NOMES_CSS = { white: '#ffffff' };

function lerTokens() {
  const css = fs.readFileSync(CAMINHO_TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = {};

  for (const [, nome, valor] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[nome] = valor.trim();
  }

  return tokens;
}

const TOKENS = lerTokens();

/** Segue `var(--outro)` até o literal e traduz o nome CSS, se houver. */
function corDe(nome) {
  let valor = TOKENS[nome];

  if (valor === undefined) throw new Error(`Token inexistente: ${nome}`);

  const apelido = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valor);
  if (apelido) valor = corDe(apelido[1]);

  return NOMES_CSS[valor] || valor;
}

/**
 * Os pares de **texto** que a interface pratica, com o lugar de cada um.
 *
 * A ordem é a de leitura da tela: primeiro o texto comum, depois os estados,
 * depois o texto sobre cor cheia.
 */
const PARES_DE_TEXTO = [
  ['--cor-texto-titulo', '--cor-superficie', 'Toast.css .toast-titulo, ConfirmarAcao.css h2'],
  ['--cor-texto-titulo', '--cor-fundo-pagina', 'Salas.css .tela-salas h1'],
  ['--cor-texto-titulo', '--cor-fundo-caixa', 'FilaDeChamados.css .fila-vazia'],
  ['--cor-texto-rotulo', '--cor-superficie', 'ConfirmarAcao.css .confirmar-texto'],
  ['--cor-texto-rotulo', '--cor-fundo-caixa', 'CampoAnexo.css .campo-anexo-dica'],
  ['--cor-texto-rotulo', '--cor-fundo-tela', 'TelaAluno.css, Perks.css .perk-descricao'],
  ['--cor-texto-discreto', '--cor-superficie', 'Salas.css .sala-cartao-dados'],
  ['--cor-texto-discreto', '--cor-fundo-caixa', 'PainelAvancado.css .painel-dica'],
  ['--cor-texto-discreto', '--cor-fundo-chat', 'Chat.css .mensagens-aviso, .conversa-previa'],
  ['--cor-erro', '--cor-superficie', 'Salas.css .salas-erro, Perks.css .perks-erro'],
  ['--cor-erro', '--cor-fundo-caixa', 'CampoAnexo.css .campo-anexo-erro'],
  ['--cor-primaria', '--cor-superficie', 'Chat.css .chat-aba--ativa, Perks.css .perk-pontos'],
  ['--cor-primaria', '--cor-fundo-pagina', 'Salas.css .sala-cartao-destaque'],
  ['--cor-sucesso', '--cor-superficie', 'Toast.css .toast--sucesso'],
  ['--cor-aviso', '--cor-superficie', 'Toast.css .toast--aviso'],
  ['--cor-informacao', '--cor-superficie', 'Toast.css .toast--informacao'],
  ['--cor-texto-invertido', '--cor-primaria', 'App.css button, Chat.css .enviar-btn'],
  ['--cor-texto-invertido', '--cor-primaria-hover', 'App.css button:hover'],
  ['--cor-texto-invertido', '--cor-sucesso', 'Chat.css .mensagem-selo'],
];

/**
 * O que não é texto e ainda assim precisa ser visto: o anel de foco.
 *
 * Ele é o único elemento do projeto que precisa aparecer sobre **qualquer**
 * superfície, inclusive sobre o vermelho cheio dos botões — é por isso que ele
 * é o quase-preto, e não a cor da identidade.
 */
const PARES_NAO_TEXTUAIS = [
  ['--cor-foco', '--cor-superficie', 'o anel de foco sobre caixa branca'],
  ['--cor-foco', '--cor-fundo-pagina', 'o anel de foco sobre a página'],
  ['--cor-foco', '--cor-fundo-chat', 'o anel de foco dentro do chat'],
  ['--cor-foco', '--cor-primaria', 'o anel de foco sobre o botão vermelho'],
];

describe('contraste dos tokens (AC-ANIM-10)', () => {
  it.each(PARES_DE_TEXTO)('AA em %s sobre %s — %s', (texto, fundo) => {
    expect(razaoContraste(corDe(texto), corDe(fundo))).toBeGreaterThanOrEqual(
      CONTRASTE_MINIMO
    );
  });

  it.each(PARES_NAO_TEXTUAIS)('3:1 em %s sobre %s — %s', (frente, fundo) => {
    expect(razaoContraste(corDe(frente), corDe(fundo))).toBeGreaterThanOrEqual(
      CONTRASTE_MINIMO_NAO_TEXTUAL
    );
  });

  // A tabela acima é uma leitura humana do CSS e pode envelhecer sem avisar.
  // Este é o guarda dela: um token de cor que não aparece em par nenhum ou é
  // decoração pura — e então é nomeado abaixo — ou é um texto que ninguém
  // conferiu. Sem isto, acrescentar `--cor-nova` e usá-la passaria em branco.
  it('não deixa cor de fora da tabela sem motivo declarado', () => {
    /** Cores que não encostam em texto, e por quê. */
    const SEM_TEXTO_EM_CIMA = {
      '--cor-fundo-tela': 'superfície, aparece como fundo nos pares acima',
      '--cor-fundo-pagina': 'superfície',
      '--cor-fundo-caixa': 'superfície',
      '--cor-fundo-chat': 'superfície',
      '--cor-superficie': 'superfície',
      '--cor-borda': 'traço de 1px entre superfícies claras, sem texto',
      '--cor-borda-campo': 'idem, no contorno dos campos de formulário',
      '--cor-mensagem-enviada': 'sem uso no CSS desde a v0.10.0; ver ADR 0011',
      '--cor-mensagem-recebida': 'idem — o selo passou a usar --cor-sucesso',
      '--sombra-foco': 'halo translúcido, some sob qualquer conta de contraste',
    };

    const conferidas = new Set(
      [...PARES_DE_TEXTO, ...PARES_NAO_TEXTUAIS].flatMap(([a, b]) => [a, b])
    );

    const esquecidas = Object.keys(TOKENS)
      .filter((nome) => nome.startsWith('--cor-') || nome.startsWith('--sombra-foco'))
      .filter((nome) => !conferidas.has(nome))
      .filter((nome) => !(nome in SEM_TEXTO_EM_CIMA));

    expect(esquecidas).toEqual([]);
  });
});
