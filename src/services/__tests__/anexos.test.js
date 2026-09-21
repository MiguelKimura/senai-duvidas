// O serviço de anexos — AC-IMG-02 a AC-IMG-09, AC-SEC-08, AC-CHAMADO-08.
//
// Ciclo 1: a porta de entrada. Antes de comprimir, antes de subir e antes de
// gravar qualquer coisa, o arquivo precisa ser o que diz ser.
//
// A extensão do arquivo é um nome, e nome não é prova: renomear `virus.exe`
// para `print.png` leva três segundos e engana qualquer `endsWith('.png')`.
// O que prova é o começo do conteúdo — os *magic bytes*, que todo formato de
// imagem carrega nos primeiros bytes e que nenhum renomeio altera (AC-SEC-08).
import {
  __arquivosEnviados,
  __avancarUploads,
  __concluirUploads,
  __falharUploads,
  __resetarStorage,
  __segurarUploads,
  __uploadsPendentes,
} from 'firebase/storage';
import { LIMITE_DE_BYTES, comprimirImagem, enviarAnexo, validarArquivo } from '../anexos';
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

// ---------------------------------------------------------------------------
// O upload — AC-IMG-02, AC-IMG-08, AC-IMG-09, AC-IMG-11.
//
// O anexo mora em `salas/{salaId}/chamados/{chamadoId}/{arquivo}`. O escopo
// por sala não é organização: é o que permite que a Storage Rule pergunte
// "quem está enviando é membro desta sala?" — pergunta impossível de fazer no
// `imagens/{nome}` global da v0.1.0, onde dois alunos que mandassem
// `print.png` se sobrescreviam.
// ---------------------------------------------------------------------------
describe('enviarAnexo — onde o arquivo vai parar (AC-IMG-11)', () => {
  beforeEach(() => {
    __resetarStorage();
    instalarCanvasFalso();
  });
  afterEach(() => restaurarCanvas());

  function print() {
    return comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 800, 600);
  }

  it('grava dentro da pasta da sala e do chamado', async () => {
    await enviarAnexo(print(), { salaId: 'sala-3b', chamadoId: 'chamado-9' });

    expect(__arquivosEnviados()).toEqual([
      expect.stringMatching(/^salas\/sala-3b\/chamados\/chamado-9\/[^/]+\.png$/),
    ]);
  });

  it('devolve a URL, o caminho, as dimensões e o tamanho do que subiu', async () => {
    const resultado = await enviarAnexo(print(), { salaId: 'sala-3b', chamadoId: 'chamado-9' });

    expect(resultado).toMatchObject({
      url: expect.stringContaining('salas/sala-3b/chamados/chamado-9/'),
      caminho: expect.stringContaining('salas/sala-3b/chamados/chamado-9/'),
      largura: 800,
      altura: 600,
      tipo: 'image/png',
      origem: 'upload',
    });
    expect(resultado.bytes).toBeGreaterThan(0);
  });

  it('nomeia o arquivo com a extensão do conteúdo, não com a do nome original', async () => {
    const disfarcado = comDimensoes(arquivoComBytes(PNG, 'print.txt', 'text/plain'), 800, 600);

    const { caminho } = await enviarAnexo(disfarcado, { salaId: 's1', chamadoId: 'c1' });

    expect(caminho.endsWith('.png')).toBe(true);
  });

  it('dois alunos que enviem "print.png" não se sobrescrevem', async () => {
    await enviarAnexo(print(), { salaId: 's1', chamadoId: 'c1' });
    await enviarAnexo(print(), { salaId: 's1', chamadoId: 'c1' });

    expect(__arquivosEnviados()).toHaveLength(2);
  });

  it('o nome do arquivo não carrega o relógio da máquina do aluno', async () => {
    const agora = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(agora);

    const { caminho } = await enviarAnexo(print(), { salaId: 's1', chamadoId: 'c1' });

    expect(caminho).not.toContain(String(agora));
    Date.now.mockRestore();
  });

  it('recusa antes de subir um byte quando o arquivo não é imagem', async () => {
    const exe = arquivoComBytes(EXE, 'print.png', 'image/png');

    await expect(enviarAnexo(exe, { salaId: 's1', chamadoId: 'c1' })).rejects.toThrow(
      /não é uma imagem/i
    );
    expect(__arquivosEnviados()).toEqual([]);
  });

  it('sobe a versão comprimida, e não o original de 3000px (AC-IMG-07)', async () => {
    const grande = comTamanho(
      comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 3000, 2000),
      3 * 1024 * 1024
    );

    const resultado = await enviarAnexo(grande, { salaId: 's1', chamadoId: 'c1' });

    expect(resultado).toMatchObject({ largura: 1600, altura: 1067 });
    expect(resultado.bytes).toBeLessThan(grande.size);
  });
});

/** Espera o upload chegar ao Storage — validação e compressão são assíncronas. */
async function aguardarUpload() {
  for (let volta = 0; volta < 50 && __uploadsPendentes().length === 0; volta += 1) {
    await new Promise((resolver) => setTimeout(resolver, 0));
  }
}

describe('enviarAnexo — progresso e cancelamento (AC-IMG-08)', () => {
  beforeEach(() => {
    __resetarStorage();
    instalarCanvasFalso();
    __segurarUploads();
  });
  afterEach(() => restaurarCanvas());

  function print() {
    return comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 800, 600);
  }

  it('informa o progresso como fração entre 0 e 1', async () => {
    const progressos = [];
    const envio = enviarAnexo(print(), {
      salaId: 's1',
      chamadoId: 'c1',
      onProgresso: (fracao) => progressos.push(fracao),
    });

    await aguardarUpload();
    __avancarUploads(0.5);
    __concluirUploads();
    await envio;

    expect(progressos).toContain(0.5);
    expect(progressos[progressos.length - 1]).toBe(1);
    expect(Math.min(...progressos)).toBeGreaterThanOrEqual(0);
  });

  it('cancela o upload em andamento quando o sinal é abortado', async () => {
    const controle = new AbortController();
    const envio = enviarAnexo(print(), {
      salaId: 's1',
      chamadoId: 'c1',
      sinal: controle.signal,
    });

    await aguardarUpload();
    const [tarefa] = __uploadsPendentes();
    const cancelar = jest.spyOn(tarefa, 'cancel');

    controle.abort();

    await expect(envio).rejects.toMatchObject({ cancelado: true });
    expect(cancelar).toHaveBeenCalled();
  });

  it('o cancelamento não deixa arquivo no Storage', async () => {
    const controle = new AbortController();
    const envio = enviarAnexo(print(), {
      salaId: 's1',
      chamadoId: 'c1',
      sinal: controle.signal,
    });

    await aguardarUpload();
    controle.abort();
    await expect(envio).rejects.toThrow();

    expect(__arquivosEnviados()).toEqual([]);
  });

  it('um sinal já abortado nem chega a começar o upload', async () => {
    const controle = new AbortController();
    controle.abort();

    await expect(
      enviarAnexo(print(), { salaId: 's1', chamadoId: 'c1', sinal: controle.signal })
    ).rejects.toMatchObject({ cancelado: true });
    expect(__uploadsPendentes()).toHaveLength(0);
  });

  it('depois de cancelar, a mesma tela consegue enviar de novo', async () => {
    const controle = new AbortController();
    const cancelado = enviarAnexo(print(), {
      salaId: 's1',
      chamadoId: 'c1',
      sinal: controle.signal,
    });
    await aguardarUpload();
    controle.abort();
    await expect(cancelado).rejects.toThrow();

    const segundo = enviarAnexo(print(), { salaId: 's1', chamadoId: 'c1' });
    await aguardarUpload();
    __concluirUploads();

    await expect(segundo).resolves.toMatchObject({ origem: 'upload' });
  });
});

describe('enviarAnexo — a falha de rede é acionável (AC-IMG-09)', () => {
  beforeEach(() => {
    __resetarStorage();
    instalarCanvasFalso();
    __segurarUploads();
  });
  afterEach(() => restaurarCanvas());

  function envioEmAndamento() {
    return enviarAnexo(comDimensoes(arquivoComBytes(PNG, 'print.png', 'image/png'), 800, 600), {
      salaId: 's1',
      chamadoId: 'c1',
    });
  }

  it('traduz a falha do Storage numa frase que diz o que fazer', async () => {
    const envio = envioEmAndamento();

    await aguardarUpload();
    __falharUploads('storage/retry-limit-exceeded');

    await expect(envio).rejects.toThrow(/tente de novo/i);
  });

  it('a recusa da rule chega como "você não faz parte desta sala"', async () => {
    const envio = envioEmAndamento();

    await aguardarUpload();
    __falharUploads('storage/unauthorized');

    await expect(envio).rejects.toThrow(/sala/i);
  });

  it('a falha não é marcada como cancelamento — a tela trata os dois diferente', async () => {
    const envio = envioEmAndamento();

    await aguardarUpload();
    __falharUploads('storage/retry-limit-exceeded');

    await expect(envio).rejects.toMatchObject({ cancelado: false });
  });
});
