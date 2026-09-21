// O serviço de anexos — AC-IMG-02 a AC-IMG-09, AC-SEC-08, AC-CHAMADO-08.
//
// Ciclo 1: a porta de entrada. Antes de comprimir, antes de subir e antes de
// gravar qualquer coisa, o arquivo precisa ser o que diz ser.
//
// A extensão do arquivo é um nome, e nome não é prova: renomear `virus.exe`
// para `print.png` leva três segundos e engana qualquer `endsWith('.png')`.
// O que prova é o começo do conteúdo — os *magic bytes*, que todo formato de
// imagem carrega nos primeiros bytes e que nenhum renomeio altera (AC-SEC-08).
import { LIMITE_DE_BYTES, comprimirImagem, validarArquivo } from '../anexos';
import {
  comDimensoes,
  desenhosFeitos,
  instalarCanvasFalso,
  restaurarCanvas,
} from '../../test-utils';

/**
 * Monta um `File` com os bytes exatos que o teste quer no começo.
 *
 * Só os primeiros bytes importam: é tudo o que `validarArquivo` lê, e é tudo
 * o que o navegador precisaria ler para desenhar — ou recusar — a imagem.
 */
function arquivoComBytes(bytes, nome, tipo) {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

/** Cabeçalho de PNG seguido de enchimento, como um arquivo de verdade. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];
// WEBP é um contêiner RIFF: `RIFF` nos bytes 0-3, `WEBP` a partir do 8.
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
// `MZ` — o cabeçalho de todo executável do Windows.
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0, 0x04, 0, 0, 0];
// `BM` — bitmap do Windows. É imagem de verdade, e mesmo assim não entra.
const BMP = [0x42, 0x4d, 0x36, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Mente sobre o tamanho sem alocar os bytes: `size` é tudo o que se lê. */
function comTamanho(arquivo, bytes) {
  Object.defineProperty(arquivo, 'size', { value: bytes });
  return arquivo;
}

describe('validarArquivo — o tipo real, não a extensão (AC-SEC-08)', () => {
  it('rejeita um .exe renomeado para .png, mesmo com o MIME mentindo junto', async () => {
    const disfarcado = arquivoComBytes(EXE, 'print.png', 'image/png');

    const resultado = await validarArquivo(disfarcado);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/não é uma imagem/i);
  });

  it('rejeita um arquivo vazio, que não tem assinatura nenhuma', async () => {
    const vazio = new File([], 'print.png', { type: 'image/png' });

    await expect(validarArquivo(vazio)).resolves.toMatchObject({ ok: false });
  });

  it('aceita o PNG de verdade mesmo quando o MIME do navegador vem vazio', async () => {
    // Windows sem a extensão registrada entrega `type: ''`. O conteúdo é o
    // mesmo PNG, e é o conteúdo que decide.
    const semMime = arquivoComBytes(PNG, 'print', '');

    await expect(validarArquivo(semMime)).resolves.toMatchObject({
      ok: true,
      tipo: 'image/png',
    });
  });

  it('não confia no MIME declarado: o tipo devolvido é o lido do conteúdo', async () => {
    const jpegChamadoDePng = arquivoComBytes(JPEG, 'print.png', 'image/png');

    await expect(validarArquivo(jpegChamadoDePng)).resolves.toMatchObject({
      ok: true,
      tipo: 'image/jpeg',
    });
  });
});

describe('validarArquivo — os quatro formatos aceitos (AC-IMG-05)', () => {
  const ACEITOS = [
    ['PNG', PNG, 'image/png', 'png'],
    ['JPEG', JPEG, 'image/jpeg', 'jpg'],
    ['GIF', GIF, 'image/gif', 'gif'],
    ['WEBP', WEBP, 'image/webp', 'webp'],
  ];

  it.each(ACEITOS)(
    'aceita %s e devolve o tipo e a extensão dele',
    async (_nome, bytes, tipo, extensao) => {
      const arquivo = arquivoComBytes(bytes, 'print.bin', 'application/octet-stream');

      await expect(validarArquivo(arquivo)).resolves.toEqual({
        ok: true,
        erro: null,
        tipo,
        extensao,
      });
    }
  );

  it('a extensão vem do conteúdo, e é ela que nomeia o arquivo no Storage', async () => {
    // O aluno renomeou o print para `.txt`. O Storage precisa guardá-lo como
    // `.png`, senão o navegador que o baixar não sabe o que fazer com ele.
    const png = arquivoComBytes(PNG, 'print.txt', 'text/plain');

    await expect(validarArquivo(png)).resolves.toMatchObject({ extensao: 'png' });
  });

  it('rejeita BMP, que é imagem de verdade mas não está na lista', async () => {
    const resultado = await validarArquivo(arquivoComBytes(BMP, 'foto.bmp', 'image/bmp'));

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/PNG, JPEG, WEBP ou GIF/);
  });
});

describe('validarArquivo — o limite de 5 MB (AC-IMG-06)', () => {
  it('aceita um arquivo exatamente no limite', async () => {
    const noLimite = comTamanho(
      arquivoComBytes(PNG, 'print.png', 'image/png'),
      LIMITE_DE_BYTES
    );

    await expect(validarArquivo(noLimite)).resolves.toMatchObject({ ok: true });
  });

  it('rejeita um byte acima do limite, dizendo o tamanho e o teto', async () => {
    const grande = comTamanho(
      arquivoComBytes(PNG, 'print.png', 'image/png'),
      LIMITE_DE_BYTES + 1
    );

    const resultado = await validarArquivo(grande);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/5 MB/);
  });

  it('o GIF grande recebe a mensagem própria dele, e não a genérica', async () => {
    // GIF não é recomprimido — recomprimir mata a animação. Então a saída do
    // aluno é outra, e a mensagem precisa dizer qual (AC-IMG-07).
    const gifGrande = comTamanho(
      arquivoComBytes(GIF, 'tela.gif', 'image/gif'),
      6 * 1024 * 1024
    );

    const resultado = await validarArquivo(gifGrande);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/GIF/);
    expect(resultado.erro).toMatch(/anima/i);
  });

  it('o limite é de 5 MB, e não outro número qualquer', () => {
    expect(LIMITE_DE_BYTES).toBe(5 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// Compressão no cliente — AC-IMG-07.
//
// Não é otimização: é requisito de custo. O Storage do plano gratuito tem
// cota, e a rede do laboratório é compartilhada por quarenta máquinas. Um
// print de monitor 4K sai com 3840px e alguns megabytes; a mesma imagem em
// 1600px continua legível para quem vai ler a mensagem de erro nela e custa
// uma fração disso, na banda de subida e no armazenamento.
//
// O jsdom não decodifica nem desenha imagem — quem faz esse papel aqui é
// `test-utils/canvasFalso`, que substitui **as APIs do navegador**, não o
// código sob teste. As contas de proporção são de `comprimirImagem`.
// ---------------------------------------------------------------------------
describe('comprimirImagem — o lado maior cabe em 1600px (AC-IMG-07)', () => {
  beforeEach(() => instalarCanvasFalso());
  afterEach(() => restaurarCanvas());

  it('reduz 3000x2000 para 1600x1067, preservando a proporção', async () => {
    const original = comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 3000, 2000);

    const resultado = await comprimirImagem(original);

    expect(resultado.largura).toBe(1600);
    expect(resultado.altura).toBe(1067);
  });

  it('a altura manda quando a imagem é mais alta que larga', async () => {
    const original = comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 800, 3000);

    const resultado = await comprimirImagem(original);

    expect(resultado).toMatchObject({ largura: 427, altura: 1600 });
  });

  it('desenha no canvas exatamente no tamanho reduzido', async () => {
    const original = comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 3000, 2000);

    await comprimirImagem(original);

    expect(desenhosFeitos()).toEqual([
      expect.objectContaining({ largura: 1600, altura: 1067 }),
    ]);
  });

  it('a imagem menor que o teto sai intacta, sem passar pelo canvas', async () => {
    // Recodificar um print de 1200px não ganharia bytes e perderia nitidez no
    // texto, que é justamente o que o professor precisa ler.
    const pequena = comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 1200, 800);

    const resultado = await comprimirImagem(pequena);

    expect(resultado.blob).toBe(pequena);
    expect(resultado.recomprimida).toBe(false);
    expect(desenhosFeitos()).toHaveLength(0);
  });

  it('o arquivo comprimido pesa menos que o original', async () => {
    const original = comTamanho(
      comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 4000, 3000),
      4 * 1024 * 1024
    );

    const resultado = await comprimirImagem(original);

    expect(resultado.blob.size).toBeLessThan(original.size);
    expect(resultado.recomprimida).toBe(true);
  });

  it('mantém o formato do original: um PNG continua PNG', async () => {
    const original = comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 3000, 2000);

    const resultado = await comprimirImagem(original);

    expect(resultado.blob.type).toBe('image/png');
  });
});

describe('comprimirImagem — o GIF não é recomprimido (AC-IMG-07)', () => {
  beforeEach(() => instalarCanvasFalso());
  afterEach(() => restaurarCanvas());

  it('devolve o GIF original, mesmo passando de 1600px', async () => {
    // Um canvas desenha um quadro só: recomprimir um GIF é entregar a imagem
    // parada de volta, sem a animação que era o motivo de ele ter sido feito.
    const gif = comDimensoes(arquivoComBytes(GIF, 'tela.gif', 'image/gif'), 3000, 2000);

    const resultado = await comprimirImagem(gif);

    expect(resultado.blob).toBe(gif);
    expect(resultado.recomprimida).toBe(false);
    expect(desenhosFeitos()).toHaveLength(0);
  });

  it('ainda assim informa as dimensões reais do GIF', async () => {
    const gif = comDimensoes(arquivoComBytes(GIF, 'tela.gif', 'image/gif'), 3000, 2000);

    await expect(comprimirImagem(gif)).resolves.toMatchObject({ largura: 3000, altura: 2000 });
  });
});

describe('comprimirImagem — quando o navegador não dá conta', () => {
  afterEach(() => restaurarCanvas());

  it('volta ao arquivo original se o canvas não conseguir codificar', async () => {
    // `toBlob` devolve `null` quando falta memória para a imagem — o que
    // acontece nas máquinas de 4 GB do laboratório. Subir o original é pior
    // que subir o comprimido e muito melhor que não subir nada.
    instalarCanvasFalso({ falharAoCodificar: true });
    const original = comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 3000, 2000);

    const resultado = await comprimirImagem(original);

    expect(resultado.blob).toBe(original);
    expect(resultado.recomprimida).toBe(false);
  });
});
