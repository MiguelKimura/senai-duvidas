// O orçamento do bundle inicial — AC-PERF-02.
//
// O critério tem duas metades, e até a 1.0.0 nenhuma das duas tinha prova:
//
//   1. **o teto.** O bundle inicial precisa ficar abaixo de 300 KB gzip. Ele
//      estava em 219 KB — e isso é irrelevante, porque nada media e nada
//      quebrava se estourasse. Um orçamento sem alarme não é um orçamento; é
//      uma frase num documento. A regressão que o estoura não é grande: é uma
//      dependência nova de 90 KB entrando num PR que passa em tudo.
//   2. **o code-splitting por rota.** Havia um `main.js` só. O aluno que abria
//      o app para fazer login baixava a tela do professor, o painel de perks e a
//      animação de premiação — tudo, antes de digitar o e-mail. Numa 3G de
//      celular no pátio, isso é a diferença entre entrar na aula e desistir.
//
// Este arquivo testa as funções puras do verificador contra árvores de build
// falsas, escritas em diretório temporário. O `build/` de verdade não serve de
// fixture: o teste passaria a depender de alguém ter rodado `npm run build`
// antes, e passaria em silêncio quando ninguém tivesse rodado.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  TETO_INICIAL_EM_BYTES,
  chunksDeRota,
  medirEntrypoints,
  relatorio,
  verificarOrcamento,
} = require('../verificarOrcamentoDoBundle');

/** Uma árvore de build falsa, com o `asset-manifest.json` que o CRA escreve. */
function montarBuild({ entrypoints, arquivos, chunks = [] }) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'orcamento-'));

  fs.mkdirSync(path.join(raiz, 'static', 'js'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'static', 'css'), { recursive: true });

  Object.entries(arquivos).forEach(([relativo, conteudo]) => {
    fs.writeFileSync(path.join(raiz, relativo.split('/').join(path.sep)), conteudo);
  });

  chunks.forEach((nome) => {
    fs.writeFileSync(path.join(raiz, 'static', 'js', nome), 'console.log(1);');
  });

  fs.writeFileSync(
    path.join(raiz, 'asset-manifest.json'),
    JSON.stringify({ files: {}, entrypoints })
  );

  return raiz;
}

/**
 * Texto que comprime mal, para que os bytes gzip sejam previsíveis.
 *
 * Um `'a'.repeat(n)` comprimiria para quase nada, e o teste mediria a eficiência
 * do zlib em vez do orçamento. A primeira tentativa foi um gerador congruente
 * linear, e ela também não serviu: os bits baixos de um LCG módulo 2^31 têm
 * período curtíssimo, e o gzip achou o padrão.
 *
 * SHA-256 encadeado não tem padrão para achar, e continua determinístico — o
 * mesmo `bytes` produz o mesmo arquivo em qualquer máquina.
 *
 * @param {number} bytes o tamanho, que o gzip praticamente não reduz.
 */
function pesoAproximado(bytes) {
  const pedacos = [];
  let bloco = Buffer.from('semente-do-orcamento');

  for (let total = 0; total < bytes; total += bloco.length) {
    bloco = crypto.createHash('sha256').update(bloco).digest();
    pedacos.push(bloco);
  }

  return Buffer.concat(pedacos).subarray(0, bytes).toString('base64');
}

/** O tamanho gzip de verdade, para a asserção não repetir a implementação. */
function gzipDe(texto) {
  return zlib.gzipSync(Buffer.from(texto), { level: 9 }).length;
}

describe('TETO_INICIAL_EM_BYTES', () => {
  it('é os 300 KB do critério, em bytes', () => {
    expect(TETO_INICIAL_EM_BYTES).toBe(300 * 1024);
  });
});

describe('medirEntrypoints', () => {
  it('mede cada entrypoint do manifesto, em bytes crus e em gzip', () => {
    const js = pesoAproximado(50000);
    const css = pesoAproximado(5000);

    const raiz = montarBuild({
      entrypoints: ['static/css/main.abc.css', 'static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': js, 'static/css/main.abc.css': css },
    });

    const medidas = medirEntrypoints(raiz);

    expect(medidas.map(({ nome }) => nome)).toEqual([
      'static/css/main.abc.css',
      'static/js/main.abc.js',
    ]);
    expect(medidas[1].bytes).toBe(Buffer.byteLength(js));
    expect(medidas[1].gzip).toBe(gzipDe(js));
  });

  it('a barra inicial do manifesto não vira caminho absoluto', () => {
    // O CRA escreve `/static/js/main.js` quando `homepage` não é definido.
    // Juntar isso com `path.join` no Windows dá um caminho que não existe, e o
    // erro que sai é um ENOENT sem explicação nenhuma.
    const raiz = montarBuild({
      entrypoints: ['/static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': 'console.log(1);' },
    });

    expect(medirEntrypoints(raiz)[0].bytes).toBeGreaterThan(0);
  });

  it('reclama quando não há build nenhum, em vez de dizer que está tudo bem', () => {
    const vazio = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-build-'));

    expect(() => medirEntrypoints(vazio)).toThrow(/asset-manifest\.json/);
  });
});

describe('chunksDeRota', () => {
  it('conta os chunks que não são o entrypoint — as rotas carregadas sob demanda', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': 'console.log(1);' },
      chunks: ['123.def.chunk.js', '456.ghi.chunk.js'],
    });

    expect(chunksDeRota(raiz)).toHaveLength(2);
  });

  it('um build sem divisão nenhuma devolve lista vazia', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': 'console.log(1);' },
    });

    expect(chunksDeRota(raiz)).toEqual([]);
  });
});

describe('verificarOrcamento', () => {
  it('aprova o bundle que cabe no teto', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(20000) },
      chunks: ['123.def.chunk.js'],
    });

    const resultado = verificarOrcamento({ diretorio: raiz });

    expect(resultado.dentroDoOrcamento).toBe(true);
    expect(resultado.gzipTotal).toBeLessThan(TETO_INICIAL_EM_BYTES);
  });

  it('reprova o bundle que estoura o teto', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(400 * 1024) },
      chunks: ['123.def.chunk.js'],
    });

    const resultado = verificarOrcamento({ diretorio: raiz });

    expect(resultado.dentroDoOrcamento).toBe(false);
  });

  it('reprova o build sem divisão por rota, ainda que ele caiba no teto', () => {
    // As duas metades do critério são independentes: um app pequeno e monolítico
    // cabe no teto hoje e volta a não caber na primeira tela nova. A divisão é
    // o que mantém o teto verdadeiro com o tempo.
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(20000) },
    });

    const resultado = verificarOrcamento({ diretorio: raiz });

    expect(resultado.dentroDoOrcamento).toBe(false);
    expect(resultado.motivos.join(' ')).toMatch(/divis|chunk/i);
  });

  it('o teto é parametrizável, para o teste poder apertá-lo sem inflar o bundle', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(20000) },
      chunks: ['123.def.chunk.js'],
    });

    expect(verificarOrcamento({ diretorio: raiz, teto: 100 }).dentroDoOrcamento).toBe(false);
  });

  it('exige um mínimo de chunks configurável — uma rota dividida não é divisão', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(1000) },
      chunks: ['123.def.chunk.js'],
    });

    expect(verificarOrcamento({ diretorio: raiz, minimoDeChunks: 5 }).dentroDoOrcamento).toBe(
      false
    );
  });
});

describe('relatorio', () => {
  it('diz o número, o teto e a folga — quem lê o CI precisa do número', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(20000) },
      chunks: ['123.def.chunk.js'],
    });

    const texto = relatorio(verificarOrcamento({ diretorio: raiz }));

    expect(texto).toMatch(/KB/);
    expect(texto).toMatch(/300/);
    expect(texto).toMatch(/main\.abc\.js/);
  });

  it('quando reprova, o texto diz por quê', () => {
    const raiz = montarBuild({
      entrypoints: ['static/js/main.abc.js'],
      arquivos: { 'static/js/main.abc.js': pesoAproximado(400 * 1024) },
    });

    const texto = relatorio(verificarOrcamento({ diretorio: raiz }));

    expect(texto).toMatch(/orçamento|excedeu|estourou/i);
    expect(texto).toMatch(/divis|chunk/i);
  });
});
