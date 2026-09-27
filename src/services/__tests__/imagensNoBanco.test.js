// As imagens do computador guardadas no próprio Firestore (v1.1.0).
//
// O Cloud Storage deixou de estar disponível no plano gratuito do projeto, e o
// upload ficava parado. A imagem passa a morar num documento à parte,
// `salas/{salaId}/imagens/{chamadoId}`, como data URL comprimida: fora do
// documento do chamado, para que a fila da turma não baixe todas as imagens a
// cada reemissão — ela só é lida quando alguém clica no olho do card.
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  __documentosDe,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import {
  ORIGEM_DO_BANCO,
  comprimirParaOBanco,
  enviarImagemParaOBanco,
  lerImagemDoBanco,
} from '../imagensNoBanco';
import {
  camposDoAnexo,
  normalizarAnexo,
  removerAnexoDoChamado,
  removerImagemDoBanco,
} from '../anexos';
import { marcarAtendido } from '../chamados';
import {
  comDimensoes,
  desenhosFeitos,
  instalarCanvasFalso,
  restaurarCanvas,
} from '../../test-utils';

const SALA = 'sala-3b';
const IMAGENS = `salas/${SALA}/imagens`;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0, 0x04, 0, 0, 0];

function print(largura = 800, altura = 600) {
  return comDimensoes(
    new File([new Uint8Array(PNG)], 'print.png', { type: 'image/png' }),
    largura,
    altura
  );
}

beforeEach(() => {
  __resetarFirestore();
  __resetarAuth();
  __definirUsuarioAtual({ uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana' });
  instalarCanvasFalso();
});

afterEach(() => restaurarCanvas());

describe('enviarImagemParaOBanco — onde a imagem vai parar', () => {
  it('grava a imagem num documento à parte, com o id do chamado', async () => {
    await enviarImagemParaOBanco(print(), { salaId: SALA, chamadoId: 'c1' });

    const [gravada] = __documentosDe(IMAGENS);

    expect(gravada.id).toBe('c1');
    expect(gravada.dados).toMatch(/^data:image\/[a-z]+;base64,/);
    expect(gravada.autorUid).toBe('uid-ana');
  });

  it('devolve o anexo de origem banco, com a prévia só para o formulário', async () => {
    const anexo = await enviarImagemParaOBanco(print(), { salaId: SALA, chamadoId: 'c1' });

    expect(anexo).toMatchObject({ origem: ORIGEM_DO_BANCO, id: 'c1' });
    expect(anexo.url).toMatch(/^data:image\//);
  });

  it('recusa o arquivo que não é imagem sem gravar nada', async () => {
    const exe = new File([new Uint8Array(EXE)], 'print.png', { type: 'image/png' });

    await expect(
      enviarImagemParaOBanco(exe, { salaId: SALA, chamadoId: 'c1' })
    ).rejects.toThrow();
    expect(__documentosDe(IMAGENS)).toEqual([]);
  });

  it('a recusa do servidor vira uma frase em português', async () => {
    __recusarEscritaEm(`${IMAGENS}/c1`);

    await expect(
      enviarImagemParaOBanco(print(), { salaId: SALA, chamadoId: 'c1' })
    ).rejects.toThrow(/sala|imagem/i);
  });

  it('um sinal já abortado não grava nada', async () => {
    const abortador = new AbortController();
    abortador.abort();

    await expect(
      enviarImagemParaOBanco(print(), {
        salaId: SALA,
        chamadoId: 'c1',
        sinal: abortador.signal,
      })
    ).rejects.toMatchObject({ cancelado: true });
    expect(__documentosDe(IMAGENS)).toEqual([]);
  });
});

describe('comprimirParaOBanco — cabe no documento', () => {
  it('reduz a imagem em degraus até caber no teto', async () => {
    // Com o canvas falso, 1 byte a cada 100 pixels: um teto baixo força as
    // tentativas menores.
    const resultado = await comprimirParaOBanco(print(3000, 2000), 'image/png', { teto: 900 });

    const lados = desenhosFeitos().map((desenho) => Math.max(desenho.largura, desenho.altura));

    expect(lados[lados.length - 1]).toBeLessThan(lados[0]);
    expect(resultado.dados.length).toBeLessThanOrEqual(900);
  });

  it('desiste com uma frase acionável quando nem a menor versão cabe', async () => {
    await expect(
      comprimirParaOBanco(print(3000, 2000), 'image/png', { teto: 10 })
    ).rejects.toThrow(/recorte/i);
  });
});

describe('lerImagemDoBanco', () => {
  it('devolve a data URL da imagem', async () => {
    __semearColecao(IMAGENS, [{ id: 'c1', dados: 'data:image/png;base64,AAAA' }]);

    await expect(lerImagemDoBanco(SALA, 'c1')).resolves.toBe('data:image/png;base64,AAAA');
  });

  it('não devolve nada que não seja imagem — o valor vai parar num src', async () => {
    __semearColecao(IMAGENS, [{ id: 'c1', dados: ['javascript', 'alert(1)'].join(':') }]);

    await expect(lerImagemDoBanco(SALA, 'c1')).resolves.toBeNull();
  });

  it('imagem que não existe é null, e não exceção', async () => {
    await expect(lerImagemDoBanco(SALA, 'nao-existe')).resolves.toBeNull();
  });
});

describe('o anexo de origem banco no chamado', () => {
  const ANEXO = {
    origem: 'banco',
    id: 'c1',
    url: 'data:image/png;base64,AAAA',
    largura: 800,
    altura: 600,
  };

  it('normalizarAnexo aceita o anexo sem URL, pelo id', () => {
    const { url: _url, ...semUrl } = ANEXO;

    expect(normalizarAnexo(semUrl)).toEqual(semUrl);
  });

  it('o chamado não carrega a imagem: camposDoAnexo tira a prévia', () => {
    const campos = camposDoAnexo(ANEXO);

    expect(campos.imagem).toBeNull();
    expect(campos.anexo).toEqual({ origem: 'banco', id: 'c1', largura: 800, altura: 600 });
  });

  it('excluir o chamado apaga a imagem do banco', async () => {
    __semearColecao(IMAGENS, [{ id: 'c1', dados: 'data:image/png;base64,AAAA' }]);

    await removerAnexoDoChamado(SALA, { id: 'c1', anexo: { origem: 'banco', id: 'c1' } });

    expect(__documentosDe(IMAGENS)).toEqual([]);
  });

  it('removerImagemDoBanco apaga, e não lança se já não existe', async () => {
    __semearColecao(IMAGENS, [{ id: 'c1', dados: 'data:image/png;base64,AAAA' }]);

    await removerImagemDoBanco(SALA, 'c1');
    await expect(removerImagemDoBanco(SALA, 'c1')).resolves.toBeUndefined();

    expect(__documentosDe(IMAGENS)).toEqual([]);
  });

  it('marcar o chamado como resolvido apaga a imagem e tira o anexo do card', async () => {
    __semearColecao(IMAGENS, [{ id: 'c1', dados: 'data:image/png;base64,AAAA' }]);
    __semearColecao(`salas/${SALA}/chamados`, [
      { id: 'c1', descricao: 'erro', anexo: { origem: 'banco', id: 'c1' }, imagem: null },
    ]);

    await marcarAtendido(SALA, 'c1', true, { origem: 'banco', id: 'c1' });

    expect(__documentosDe(IMAGENS)).toEqual([]);
    expect(__documentosDe(`salas/${SALA}/chamados`)[0]).toMatchObject({
      atendido: true,
      anexo: null,
      imagem: null,
    });
  });
});
