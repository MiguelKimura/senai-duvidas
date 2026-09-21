// A cor de quem fala no chat — AC-CHAT-02.
//
// Uma regra e uma só: **a cor é função da semente, e de mais nada**. Nem do
// relógio, nem da ordem das mensagens, nem — principalmente — de quem está
// olhando a tela. Duas pessoas abrindo a mesma conversa em dois computadores
// precisam ver exatamente as mesmas cores, hoje e no ano que vem.
//
// A v0.7.0 escrevia `gerarCorParaUsuario(mensagem.email || usuarioEmail)`. O
// `||` é o bug inteiro: mensagem sem `email` — toda mensagem da v0.1.0 — caía
// no e-mail do leitor. Aqui não existe fallback para o leitor, e a função nem
// recebe quem está lendo.
//
// A cor de fundo também não pode ser qualquer uma: ela carrega texto por cima.
// `razaoContraste()` vem de `utils/paleta.js` (task 05), a mesma conta que
// protege a paleta do card — duas implementações de contraste divergiriam, e a
// que divergisse em silêncio seria a do chat.
/** O quase-preto da paleta do card. Mesma tinta, mesma conta de contraste. */
export const TEXTO_ESCURO = '#1a1a1a';

/**
 * Saturação fixa. Só o matiz varia com a semente.
 *
 * Deixar a saturação variar junto multiplicaria as combinações sem ganhar
 * distinção: o que o olho separa num balão de fala é o matiz.
 */
const SATURACAO = 0.62;

/** A luminosidade do fundo. Fixa nesta etapa; o ciclo 2 a torna verificada. */
const LUMINOSIDADE_INICIAL = 0.78;

/**
 * Resumo FNV-1a de 32 bits.
 *
 * Trocou o `hash = (hash << 5) - hash + c` da v0.1.0 porque aquele agrupa: com
 * sementes de mesmo comprimento e prefixo parecido — que é exatamente a forma
 * de um UID do Firebase — os matizes caíam perto uns dos outros. FNV-1a espalha
 * e continua cabendo em cinco linhas, sem dependência nenhuma.
 *
 * @param {string} texto
 * @returns {number} inteiro sem sinal de 32 bits.
 */
function resumo(texto) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** Um canal 0–255 já em dois dígitos hexadecimais. */
function emHexadecimal(canal) {
  return Math.round(canal * 255)
    .toString(16)
    .padStart(2, '0');
}

/**
 * HSL para hexadecimal.
 *
 * A conversão existe aqui porque a conta de contraste da task 05 lê
 * hexadecimal, e porque `hsl()` no `style` de um elemento é descartado pelo
 * jsdom (ver `src/test-utils/corDeFundo.js`) — gravar hexadecimal torna a cor
 * verificável no teste sem nenhum truque de ambiente.
 *
 * @param {number} matiz 0–360.
 * @param {number} saturacao 0–1.
 * @param {number} luminosidade 0–1.
 * @returns {string} `#rrggbb`.
 */
function hslParaHexadecimal(matiz, saturacao, luminosidade) {
  const amplitude = (1 - Math.abs(2 * luminosidade - 1)) * saturacao;
  const setor = matiz / 60;
  const secundario = amplitude * (1 - Math.abs((setor % 2) - 1));
  const base = luminosidade - amplitude / 2;

  const ordens = [
    [amplitude, secundario, 0],
    [secundario, amplitude, 0],
    [0, amplitude, secundario],
    [0, secundario, amplitude],
    [secundario, 0, amplitude],
    [amplitude, 0, secundario],
  ];

  const [vermelho, verde, azul] = ordens[Math.floor(setor) % 6];

  return `#${emHexadecimal(vermelho + base)}${emHexadecimal(verde + base)}${emHexadecimal(
    azul + base
  )}`;
}

/**
 * A cor estável de uma pessoa, a partir de uma semente qualquer.
 *
 * @param {string|null|undefined} semente UID de preferência; e-mail no legado.
 * @returns {{fundo: string, texto: string}} hexadecimais prontos para o estilo.
 */
export function corUsuario(semente) {
  const valor = typeof semente === 'string' && semente !== '' ? semente : 'sem-identidade';
  const matiz = resumo(valor) % 360;

  return {
    fundo: hslParaHexadecimal(matiz, SATURACAO, LUMINOSIDADE_INICIAL),
    texto: TEXTO_ESCURO,
  };
}

/**
 * De onde sai a semente de uma mensagem já gravada.
 *
 * A ordem é a da compatibilidade retroativa, não a da conveniência:
 *
 *   `autorUid` — o campo desta versão. É o único que não muda quando a pessoa
 *                troca de e-mail, e é o mesmo em qualquer dispositivo.
 *   `email`    — o que a v0.1.0 gravava. Caminho legado, testado.
 *   nome       — último recurso, para a mensagem migrada que não tem nenhum
 *                dos dois. Pior que os outros, e ainda assim estável.
 *
 * Note o que **não** está na lista: quem está lendo. Uma mensagem sem nenhuma
 * identidade recebe a cor neutra de `corUsuario('')` — igual para todo mundo.
 *
 * @param {{autorUid?: string, email?: string, autorNome?: string, nome?: string}} mensagem
 * @returns {{fundo: string, texto: string}}
 */
export function corDaMensagem(mensagem) {
  const dados = mensagem || {};

  return corUsuario(dados.autorUid || dados.email || dados.autorNome || dados.nome || '');
}
