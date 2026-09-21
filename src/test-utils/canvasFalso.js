// Canvas e `createImageBitmap` para o jsdom.
//
// O jsdom não decodifica imagem e não desenha nada: `getContext('2d')` lança
// "Not implemented" e `toBlob` não existe. Sem um substituto, a compressão do
// AC-IMG-07 só poderia ser testada num navegador de verdade — e o que ela
// decide (quanto reduzir, em que proporção, quando não mexer) é aritmética,
// que não precisa de GPU para ser provada.
//
// O que este fake substitui são **as APIs do navegador**, não o código sob
// teste: `comprimirImagem` roda inteira, com as contas dela, e só recebe um
// decodificador e um codificador de mentira nas pontas.

/** @type {WeakMap<Blob, {largura: number, altura: number}>} */
let dimensoes = new WeakMap();

/** @type {Array<{origem: object, largura: number, altura: number}>} */
let desenhos = [];

const original = {
  createImageBitmap: undefined,
  getContext: undefined,
  toBlob: undefined,
  instalado: false,
};

/**
 * Declara o tamanho em pixels que o "decodificador" vai enxergar no arquivo.
 *
 * @param {Blob} arquivo
 * @param {number} largura
 * @param {number} altura
 * @returns {Blob} o mesmo arquivo, para encadear.
 */
export function comDimensoes(arquivo, largura, altura) {
  dimensoes.set(arquivo, { largura, altura });
  return arquivo;
}

/** Os `drawImage` que aconteceram, na ordem, com o tamanho de destino. */
export function desenhosFeitos() {
  return desenhos;
}

/**
 * Instala o fake.
 *
 * @param {{falharAoCodificar?: boolean}} [opcoes] `falharAoCodificar` reproduz
 *   o `toBlob` que devolve `null` — acontece quando a imagem é grande demais
 *   para a memória da aba, que é o caso das máquinas de laboratório.
 */
export function instalarCanvasFalso({ falharAoCodificar = false } = {}) {
  if (!original.instalado) {
    original.createImageBitmap = globalThis.createImageBitmap;
    original.getContext = HTMLCanvasElement.prototype.getContext;
    original.toBlob = HTMLCanvasElement.prototype.toBlob;
    original.instalado = true;
  }

  desenhos = [];

  globalThis.createImageBitmap = async (arquivo) => {
    const medida = dimensoes.get(arquivo);

    if (!medida)
      throw new Error('Fake de canvas: declare o tamanho com comDimensoes(arquivo, w, h).');

    return { width: medida.largura, height: medida.altura, close() {} };
  };

  HTMLCanvasElement.prototype.getContext = function getContextFalso() {
    return {
      drawImage: (origem, _x, _y, largura, altura) => {
        desenhos.push({ origem, largura, altura });
      },
    };
  };

  HTMLCanvasElement.prototype.toBlob = function toBlobFalso(retorno, tipo, _qualidade) {
    if (falharAoCodificar) {
      retorno(null);
      return;
    }

    // Um byte por pixel: não é a taxa de nenhum codec real, mas guarda a
    // propriedade que importa — menos pixels, menos bytes.
    const bytes = new Uint8Array(Math.max(1, Math.round((this.width * this.height) / 100)));

    retorno(new Blob([bytes], { type: tipo }));
  };
}

/** Devolve o jsdom ao estado de antes. */
export function restaurarCanvas() {
  if (!original.instalado) return;

  globalThis.createImageBitmap = original.createImageBitmap;
  HTMLCanvasElement.prototype.getContext = original.getContext;
  HTMLCanvasElement.prototype.toBlob = original.toBlob;
  dimensoes = new WeakMap();
  desenhos = [];
}
