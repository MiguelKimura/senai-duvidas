// Geração do CHANGELOG a partir dos commits — AC-CI-09.
//
// O critério é explícito: o CHANGELOG é **gerado** a partir dos commits
// convencionais, não escrito à mão. A diferença não é de gosto. Changelog
// escrito à mão é escrito no fim, de memória, pela pessoa que fez a mudança —
// e o que ficou de fora é exatamente o que ninguém lembrou. Gerado, ele é um
// reflexo do que de fato entrou.
//
// A parte que fala com o git fica isolada: aqui se testa a transformação pura
// de uma lista de assuntos de commit em seções no formato Keep a Changelog.
const {
  classificar,
  agruparPorSecao,
  gerarSecaoDaVersao,
  SECOES,
} = require('../gerarChangelog');

describe('classificar', () => {
  it('lê tipo, escopo e descrição de um commit convencional', () => {
    expect(classificar('feat(salas): adiciona entrada por PIN')).toEqual({
      tipo: 'feat',
      escopo: 'salas',
      descricao: 'adiciona entrada por PIN',
      quebra: false,
    });
  });

  it('aceita commit sem escopo', () => {
    expect(classificar('fix: corrige a ordenação da fila')).toMatchObject({
      tipo: 'fix',
      escopo: null,
      descricao: 'corrige a ordenação da fila',
    });
  });

  it('marca o `!` como quebra de contrato', () => {
    expect(classificar('feat(chamados)!: escopa a fila por sala')).toMatchObject({
      tipo: 'feat',
      quebra: true,
    });
  });

  it('devolve null para assunto fora do padrão, em vez de inventar um tipo', () => {
    expect(classificar('ajustes gerais')).toBeNull();
    expect(classificar('WIP')).toBeNull();
    expect(classificar('feat sem dois pontos')).toBeNull();
  });
});

describe('agruparPorSecao', () => {
  const assuntos = [
    'feat(salas): adiciona entrada por PIN',
    'feat(chat): agrupa mensagens do mesmo autor',
    'fix(tempo): usa o horário do servidor na ordenação',
    'chore(infra): fixa as portas do emulador',
    'docs(manual): escreve o manual do professor',
    'test(chat): cobre a negação de leitura de DM',
    'ajustes gerais',
  ];

  it('manda feat para Adicionado e fix para Corrigido', () => {
    const secoes = agruparPorSecao(assuntos);

    expect(secoes.Adicionado).toHaveLength(2);
    expect(secoes.Corrigido).toEqual(['**tempo:** usa o horário do servidor na ordenação']);
  });

  it('junta chore, docs e test em Alterado, que é onde o Keep a Changelog os põe', () => {
    const secoes = agruparPorSecao(assuntos);

    expect(secoes.Alterado).toEqual(
      expect.arrayContaining([
        '**infra:** fixa as portas do emulador',
        '**manual:** escreve o manual do professor',
        '**chat:** cobre a negação de leitura de DM',
      ])
    );
  });

  it('ignora em silêncio o commit que não segue o padrão', () => {
    const todos = Object.values(agruparPorSecao(assuntos)).flat();

    expect(todos.join('\n')).not.toContain('ajustes gerais');
  });

  it('não cria seção vazia', () => {
    const secoes = agruparPorSecao(['fix: um ajuste']);

    expect(Object.keys(secoes)).toEqual(['Corrigido']);
  });

  it('destaca a quebra de contrato, que é o que o leitor precisa ver primeiro', () => {
    const secoes = agruparPorSecao(['feat(chamados)!: escopa a fila por sala']);

    expect(secoes.Adicionado[0]).toMatch(/^\*\*BREAKING\*\*/);
  });

  it('usa apenas seções do vocabulário do Keep a Changelog', () => {
    const secoes = agruparPorSecao(assuntos);

    for (const nome of Object.keys(secoes)) {
      expect(SECOES).toContain(nome);
    }
  });
});

describe('gerarSecaoDaVersao', () => {
  it('escreve o cabeçalho no formato Keep a Changelog', () => {
    const texto = gerarSecaoDaVersao({
      versao: '0.2.0',
      data: '2026-09-20',
      assuntos: ['feat(infra): adiciona o harness de testes'],
    });

    expect(texto).toContain('## [0.2.0] - 2026-09-20');
    expect(texto).toContain('### Adicionado');
    expect(texto).toContain('- **infra:** adiciona o harness de testes');
  });

  it('não emite cabeçalho de seção sem item embaixo', () => {
    const texto = gerarSecaoDaVersao({
      versao: '0.2.0',
      data: '2026-09-20',
      assuntos: ['fix(chat): corrige o scroll'],
    });

    expect(texto).not.toContain('### Adicionado');
    expect(texto).toContain('### Corrigido');
  });

  it('diz que não houve mudança em vez de gerar uma versão em branco', () => {
    const texto = gerarSecaoDaVersao({ versao: '0.2.1', data: '2026-09-20', assuntos: [] });

    expect(texto).toContain('## [0.2.1] - 2026-09-20');
    expect(texto).toMatch(/nenhuma mudança/i);
  });

  it('é determinístico: a mesma entrada gera exatamente o mesmo texto', () => {
    const entrada = {
      versao: '0.2.0',
      data: '2026-09-20',
      assuntos: ['feat(a): um', 'fix(b): dois'],
    };

    expect(gerarSecaoDaVersao(entrada)).toBe(gerarSecaoDaVersao(entrada));
  });
});
