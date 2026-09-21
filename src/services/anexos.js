// Anexos de imagem dos chamados — AC-IMG-02 a AC-IMG-13, AC-SEC-08.
//
// O problema que este módulo resolve é o print. O aluno fotografa ou recorta a
// tela do erro e, até a v0.5.0, não tinha onde hospedar: o único caminho era
// colar uma URL, que ele não tem. Acabava descrevendo o erro por escrito, mal,
// e o professor perdia a aula pedindo detalhe.
//
// Nada aqui decide interface. Quem desenha o seletor, a zona de soltar e a
// barra de progresso é `components/CampoAnexo.jsx`; este módulo é a regra —
// o que é uma imagem, quanto ela pode pesar, para onde ela vai e como ela sai.

/**
 * O que cada formato aceito carrega nos primeiros bytes (AC-SEC-08).
 *
 * Esta tabela é a única autoridade sobre "isto é uma imagem?". Nem a extensão
 * nem o `type` que o navegador declara entram na decisão: os dois saem do nome
 * do arquivo, e o nome é exatamente o que quem renomeia um `.exe` controla.
 *
 * `deslocamento` existe por causa do WEBP, que é um contêiner RIFF: os quatro
 * primeiros bytes são `RIFF` — os mesmos de um WAV — e o que diz que há uma
 * imagem dentro é o `WEBP` do byte 8.
 */
const ASSINATURAS = [
  { tipo: 'image/png', extensao: 'png', bytes: [0x89, 0x50, 0x4e, 0x47], deslocamento: 0 },
  { tipo: 'image/jpeg', extensao: 'jpg', bytes: [0xff, 0xd8, 0xff], deslocamento: 0 },
  { tipo: 'image/gif', extensao: 'gif', bytes: [0x47, 0x49, 0x46, 0x38], deslocamento: 0 },
  {
    tipo: 'image/webp',
    extensao: 'webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
    deslocamento: 0,
    tambem: { bytes: [0x57, 0x45, 0x42, 0x50], deslocamento: 8 },
  },
];

/**
 * O teto por arquivo, em bytes (AC-IMG-06).
 *
 * Cinco megabytes cobrem com folga um print de tela cheia em PNG, que é o caso
 * real desta funcionalidade. O mesmo número está nas Storage Rules, e é o de
 * lá que vale: um limite que mora só no cliente é um limite que o cliente
 * desliga. O daqui existe para dar a mensagem em português antes de gastar a
 * banda da rede do laboratório.
 */
export const LIMITE_DE_BYTES = 5 * 1024 * 1024;

/** O formato que não é recomprimido, porque recomprimir mata a animação. */
export const TIPO_ANIMADO = 'image/gif';

/** Quantos bytes bastam para reconhecer qualquer assinatura da tabela. */
const BYTES_DA_ASSINATURA = 12;

/** A única frase para "isto não é uma imagem que sabemos abrir" (AC-IMG-05). */
export const ERRO_DE_FORMATO =
  'Esse arquivo não é uma imagem que o sistema aceita. ' +
  'Envie um print em PNG, JPEG, WEBP ou GIF.';

/**
 * Lê o começo do arquivo.
 *
 * `FileReader` sobre uma fatia, e não o arquivo inteiro: uma foto de 5 MB não
 * precisa passar pela memória de uma máquina de laboratório só para que se
 * confiram doze bytes.
 *
 * @param {Blob} arquivo
 * @returns {Promise<Uint8Array>} vazio quando o arquivo não pôde ser lido.
 */
function lerAssinatura(arquivo) {
  return new Promise((resolver) => {
    const leitor = new FileReader();

    leitor.onload = () => resolver(new Uint8Array(leitor.result || new ArrayBuffer(0)));
    leitor.onerror = () => resolver(new Uint8Array(0));

    try {
      leitor.readAsArrayBuffer(arquivo.slice(0, BYTES_DA_ASSINATURA));
    } catch (_erro) {
      resolver(new Uint8Array(0));
    }
  });
}

/** Os bytes de `assinatura` batem com `esperados` a partir de `deslocamento`? */
function combina(assinatura, { bytes, deslocamento }) {
  return bytes.every((byte, indice) => assinatura[deslocamento + indice] === byte);
}

/**
 * O formato reconhecido pelo conteúdo, ou `null`.
 *
 * @param {Uint8Array} assinatura os primeiros bytes do arquivo.
 * @returns {{tipo: string, extensao: string}|null}
 */
export function formatoPelaAssinatura(assinatura) {
  const encontrada = ASSINATURAS.find(
    (formato) =>
      combina(assinatura, formato) && (!formato.tambem || combina(assinatura, formato.tambem))
  );

  return encontrada ? { tipo: encontrada.tipo, extensao: encontrada.extensao } : null;
}

/** O tamanho em MB com uma casa, como a mensagem de erro o escreve. */
function emMegabytes(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
}

/**
 * A frase de "passou do teto", específica por formato (AC-IMG-06).
 *
 * O GIF tem a dele porque a saída do aluno é outra: os demais formatos o
 * cliente comprime sozinho antes de subir, e o GIF não — comprimir um GIF é
 * perder a animação, que costuma ser justamente o que ele queria mostrar.
 */
function erroDeTamanho(bytes, tipo) {
  const medida = `Este arquivo tem ${emMegabytes(bytes)} MB e o limite é 5 MB.`;

  return tipo === TIPO_ANIMADO
    ? `${medida} GIF não é comprimido automaticamente, para não perder a animação — ` +
        'grave a tela em um trecho menor ou envie um print em PNG no lugar.'
    : `${medida} Recorte só a janela do erro e envie de novo.`;
}

/**
 * Diz se o arquivo pode virar anexo, e por qual motivo não pode (AC-IMG-05).
 *
 * Devolve um resultado em vez de lançar: recusar um arquivo é um caminho
 * normal da tela, não uma exceção. Quem chama mostra `erro` ao lado do campo e
 * continua com o formulário montado — inclusive com o texto já digitado
 * (AC-IMG-09).
 *
 * @param {File|Blob} arquivo
 * @returns {Promise<{ok: boolean, erro: string|null, tipo: string|null,
 *   extensao: string|null}>}
 */
export async function validarArquivo(arquivo) {
  const recusa = (erro) => ({ ok: false, erro, tipo: null, extensao: null });

  if (!arquivo) return recusa(ERRO_DE_FORMATO);

  const formato = formatoPelaAssinatura(await lerAssinatura(arquivo));

  // O formato antes do tamanho, de propósito: um `.exe` de 6 MB é um `.exe`, e
  // dizer a ele que "o limite é 5 MB" sugeriria que bastava encolher.
  if (!formato) return recusa(ERRO_DE_FORMATO);

  if (arquivo.size > LIMITE_DE_BYTES) return recusa(erroDeTamanho(arquivo.size, formato.tipo));

  return { ok: true, erro: null, ...formato };
}
