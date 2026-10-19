// Migração do campo de anexo — a etapa 1 da mudança em duas fases.
//
// Até a v0.5.0 o anexo era uma string de URL em `imagem`. A v0.6.0 grava
// **os dois**: `imagem` como sempre, e `anexo` em objeto ao lado, com o
// caminho no Storage e as dimensões. `imagem` só sai na 1.0.0.
//
// Este script é opcional. O app lê os dois formatos sozinho — é o que
// `normalizarAnexo` faz, permanentemente nesta versão —, então nada quebra
// sem ele. O que ele compra é homogeneidade: com `anexo` preenchido em todo
// documento, a 1.0.0 pode remover `imagem` sem precisar de outra migração no
// dia do deploy, com a turma em aula.
//
// O que o script toca é dado real de fila. As exigências são duras e estão
// todas aqui: idempotência, `--dry-run` que não grava, e `imagem` jamais
// tocado — nem alterado, nem apagado.
const { planejar, migrar, formatarRelatorio, lerOpcoes } = require('../migrar-anexos');
const { normalizarAnexo } = require('../../src/services/anexos');

/** Um documento como o script o recebe do Firestore: id mais os dados. */
function documento(id, dados) {
  return { id, dados };
}

const URL_ANTIGA = 'https://exemplo.br/erro.png';

describe('planejar — quem precisa de anexo e quem não precisa', () => {
  it('marca para migrar o chamado que só tem imagem em string', () => {
    const plano = planejar([documento('c1', { descricao: 'erro', imagem: URL_ANTIGA })]);

    expect(plano.aMigrar).toEqual([
      { id: 'c1', campos: { anexo: { url: URL_ANTIGA, origem: 'url' } } },
    ]);
  });

  it('não toca no chamado que já tem anexo — é o que faz rodar duas vezes ser inócuo', () => {
    const plano = planejar([
      documento('c1', { imagem: URL_ANTIGA, anexo: { url: URL_ANTIGA, origem: 'url' } }),
    ]);

    expect(plano.aMigrar).toEqual([]);
    expect(plano.jaTinham).toBe(1);
  });

  it('não inventa anexo para chamado sem imagem nenhuma', () => {
    const plano = planejar([documento('c1', { descricao: 'sem print', imagem: null })]);

    expect(plano.aMigrar).toEqual([]);
    expect(plano.semAnexo).toBe(1);
  });

  it('ignora imagem que não é endereço de imagem', () => {
    // Campo sujo existe: alguém colou a descrição no lugar do link. Copiar
    // aquilo para `anexo` só espalharia o problema para o formato novo.
    const plano = planejar([documento('c1', { imagem: 'o erro do vscode' })]);

    expect(plano.aMigrar).toEqual([]);
    expect(plano.ilegiveis).toBe(1);
  });

  it('conta tudo o que leu', () => {
    const plano = planejar([
      documento('a', { imagem: URL_ANTIGA }),
      documento('b', { imagem: URL_ANTIGA, anexo: { url: URL_ANTIGA, origem: 'url' } }),
      documento('c', { imagem: null }),
    ]);

    expect(plano.total).toBe(3);
  });

  it('o anexo que ele monta é o mesmo que o app lê do campo antigo', () => {
    // A duplicação de regra entre script e app é o risco desta migração. Se
    // `normalizarAnexo` mudar de forma, este caso quebra antes de a diferença
    // chegar ao banco.
    const [{ campos }] = planejar([documento('c1', { imagem: URL_ANTIGA })]).aMigrar;

    expect(campos.anexo).toEqual(normalizarAnexo(URL_ANTIGA));
  });
});

describe('migrar — a gravação', () => {
  it('grava apenas o campo anexo, e em ninguém mais', async () => {
    const gravados = [];

    await migrar({
      documentos: [documento('c1', { imagem: URL_ANTIGA })],
      gravar: (id, campos) => {
        gravados.push({ id, campos });
        return Promise.resolve();
      },
    });

    expect(gravados).toEqual([
      { id: 'c1', campos: { anexo: { url: URL_ANTIGA, origem: 'url' } } },
    ]);
  });

  it('NUNCA escreve em imagem — nem para alterar, nem para apagar', async () => {
    const gravados = [];

    await migrar({
      documentos: [documento('c1', { imagem: URL_ANTIGA })],
      gravar: (id, campos) => {
        gravados.push(campos);
        return Promise.resolve();
      },
    });

    gravados.forEach((campos) => expect('imagem' in campos).toBe(false));
  });

  it('--dry-run não grava nada, e ainda assim diz o que gravaria', async () => {
    const gravar = jest.fn();

    const relatorio = await migrar({
      documentos: [documento('c1', { imagem: URL_ANTIGA })],
      simulacao: true,
      gravar,
    });

    expect(gravar).not.toHaveBeenCalled();
    expect(relatorio).toMatchObject({ atualizados: 1, simulacao: true });
  });

  it('a segunda rodada não tem o que fazer (idempotência)', async () => {
    const banco = { c1: { imagem: URL_ANTIGA } };
    const gravar = (id, campos) => {
      banco[id] = { ...banco[id], ...campos };
      return Promise.resolve();
    };

    await migrar({ documentos: [documento('c1', banco.c1)], gravar });
    const segunda = await migrar({ documentos: [documento('c1', banco.c1)], gravar });

    expect(segunda.atualizados).toBe(0);
    expect(segunda.jaTinham).toBe(1);
  });

  it('uma falha não derruba a rodada, e aparece no relatório', async () => {
    const relatorio = await migrar({
      documentos: [
        documento('c1', { imagem: URL_ANTIGA }),
        documento('c2', { imagem: URL_ANTIGA }),
      ],
      gravar: (id) => (id === 'c1' ? Promise.reject(new Error('sem permissão')) : Promise.resolve()),
    });

    expect(relatorio.atualizados).toBe(1);
    expect(relatorio.falhas).toEqual([{ id: 'c1', erro: 'sem permissão' }]);
  });
});

describe('reversão — desfazer é apagar um campo que ninguém precisa', () => {
  it('a reversão remove anexo e deixa imagem intacta', async () => {
    const gravados = [];

    await migrar({
      documentos: [
        documento('c1', { imagem: URL_ANTIGA, anexo: { url: URL_ANTIGA, origem: 'url' } }),
      ],
      reverter: true,
      gravar: (id, campos) => {
        gravados.push({ id, campos });
        return Promise.resolve();
      },
    });

    expect(gravados).toEqual([{ id: 'c1', campos: { anexo: null } }]);
  });

  it('a reversão não mexe no anexo de upload, que tem caminho no Storage', async () => {
    // Um anexo de `origem: upload` não veio de `imagem`: ele nasceu assim, e
    // apagá-lo perderia o caminho do arquivo — o único jeito de o chamado
    // excluído levar o anexo junto depois (AC-CHAMADO-08).
    const gravar = jest.fn();

    await migrar({
      documentos: [
        documento('c1', {
          imagem: 'https://fake.storage/a.png',
          anexo: { url: 'https://fake.storage/a.png', origem: 'upload', caminho: 'salas/s/c/a.png' },
        }),
      ],
      reverter: true,
      gravar,
    });

    expect(gravar).not.toHaveBeenCalled();
  });
});

describe('lerOpcoes — o padrão seguro é não escrever', () => {
  it('sem argumento nenhum, não está confirmado nem é simulação', () => {
    expect(lerOpcoes([])).toMatchObject({ simulacao: false, confirmado: false, reverter: false });
  });

  it('reconhece --dry-run, --confirmar e --reverter', () => {
    expect(lerOpcoes(['--dry-run', '--confirmar', '--reverter'])).toMatchObject({
      simulacao: true,
      confirmado: true,
      reverter: true,
    });
  });

  it('aceita uma coleção específica e cai no padrão sem ela', () => {
    expect(lerOpcoes(['--colecao', 'salas/sala-3b/chamados']).colecoes).toEqual([
      'salas/sala-3b/chamados',
    ]);
    expect(lerOpcoes([]).colecoes).toEqual(['chamados']);
  });
});

describe('formatarRelatorio — o que a pessoa que rodou o script lê', () => {
  const base = {
    colecao: 'chamados',
    total: 4,
    atualizados: 2,
    jaTinham: 1,
    semAnexo: 1,
    ilegiveis: 0,
    falhas: [],
    simulacao: false,
  };

  it('resume o que aconteceu', () => {
    expect(formatarRelatorio(base)).toContain('4 lidos');
    expect(formatarRelatorio(base)).toContain('2 receberam anexo');
  });

  it('deixa claro quando nada foi gravado', () => {
    expect(formatarRelatorio({ ...base, simulacao: true })).toContain('--dry-run');
  });

  it('lista as falhas com o id e o motivo', () => {
    const texto = formatarRelatorio({ ...base, falhas: [{ id: 'c9', erro: 'sem permissão' }] });

    expect(texto).toContain('c9');
    expect(texto).toContain('sem permissão');
  });
});
