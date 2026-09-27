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
import { CONTRASTE_MINIMO, razaoContraste } from './paleta';

/** O quase-preto da paleta do card. Mesma tinta, mesma conta de contraste. */
export const TEXTO_ESCURO = '#1a1a1a';

/**
 * Saturação fixa. Só o matiz varia com a semente.
 *
 * Deixar a saturação variar junto multiplicaria as combinações sem ganhar
 * distinção: o que o olho separa num balão de fala é o matiz.
 */
const SATURACAO = 0.62;

/**
 * Onde a busca de luminosidade começa, e como ela anda.
 *
 * Começa **escuro de propósito**. A busca sobe até o primeiro tom que passa no
 * contraste, então o ponto de partida baixo é o que garante a cor mais saturada
 * que ainda se lê. Partir claro entregaria mil tons de quase-branco, todos
 * aprovados no contraste e nenhum distinguível do vizinho — que é o mesmo que
 * não ter cor por usuário.
 */
const LUMINOSIDADE_INICIAL = 0.58;
const PASSO_DE_LUMINOSIDADE = 0.02;

/**
 * O teto da busca.
 *
 * Hoje nenhum matiz chega perto dele: contra `TEXTO_ESCURO`, o pior caso passa
 * bem antes. Ele existe porque a alternativa é um `while` sem saída — e o dia
 * em que alguém trocar a cor do texto, o laço sem teto trava o navegador da
 * turma inteira em vez de entregar uma cor feia.
 */
const LUMINOSIDADE_MAXIMA = 0.96;

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
 * A cor de um matiz, clareada até o texto se ler por cima dela.
 *
 * A paleta do card (task 05) resolveu o contraste com nove cores escolhidas à
 * mão e verificadas uma a uma no teste. Aqui não existe lista para revisar: o
 * matiz sai de um hash, e qualquer um dos 360 pode aparecer. Então a
 * verificação **é** a busca — a função não devolve nenhum tom que ela própria
 * não tenha medido.
 *
 * Sobe de baixo para cima e para no primeiro que passa. Isso não é detalhe de
 * implementação: é o que mantém as cores saturadas. Descer do branco pararia
 * no primeiro tom claro, e a conversa inteira ficaria pastel.
 *
 * @param {number} matiz 0–360.
 * @param {{luminosidadeInicial?: number, passos?: number, texto?: string}} [opcoes]
 *   `passos` limita a busca; `0` devolve o ponto de partida sem procurar, que é
 *   como o teste prova que o tom escolhido é mesmo o primeiro aprovado.
 * @returns {{fundo: string, texto: string, matiz: number, luminosidade: number}}
 */
export function corDeMatiz(matiz, opcoes = {}) {
  const {
    luminosidadeInicial = LUMINOSIDADE_INICIAL,
    passos = Math.ceil((LUMINOSIDADE_MAXIMA - luminosidadeInicial) / PASSO_DE_LUMINOSIDADE),
    texto = TEXTO_ESCURO,
  } = opcoes;

  let luminosidade = luminosidadeInicial;
  let fundo = hslParaHexadecimal(matiz, SATURACAO, luminosidade);

  for (let passo = 0; passo < passos; passo += 1) {
    if (razaoContraste(fundo, texto) >= CONTRASTE_MINIMO) break;

    luminosidade = Math.min(luminosidade + PASSO_DE_LUMINOSIDADE, LUMINOSIDADE_MAXIMA);
    fundo = hslParaHexadecimal(matiz, SATURACAO, luminosidade);
  }

  return { fundo, texto, matiz, luminosidade };
}

/**
 * A cor estável de uma pessoa, a partir de uma semente qualquer.
 *
 * @param {string|null|undefined} semente UID de preferência; e-mail no legado.
 * @returns {{fundo: string, texto: string}} hexadecimais prontos para o estilo.
 */
export function corUsuario(semente) {
  const valor = typeof semente === 'string' && semente !== '' ? semente : 'sem-identidade';
  const { fundo, texto } = corDeMatiz(resumo(valor) % 360);

  return { fundo, texto };
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
