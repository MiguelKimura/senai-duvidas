// O serviço de anexos — AC-IMG-02 a AC-IMG-09, AC-SEC-08, AC-CHAMADO-08.
//
// Ciclo 1: a porta de entrada. Antes de comprimir, antes de subir e antes de
// gravar qualquer coisa, o arquivo precisa ser o que diz ser.
//
// A extensão do arquivo é um nome, e nome não é prova: renomear `virus.exe`
// para `print.png` leva três segundos e engana qualquer `endsWith('.png')`.
// O que prova é o começo do conteúdo — os *magic bytes*, que todo formato de
// imagem carrega nos primeiros bytes e que nenhum renomeio altera (AC-SEC-08).
import { validarArquivo } from '../anexos';

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
// `MZ` — o cabeçalho de todo executável do Windows.
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0, 0x04, 0, 0, 0];

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
