// O orçamento de tempo da suíte completa — AC-TEST-08, AC-TEST-06.
//
// O critério diz: "a suíte completa roda em menos de 5 minutos no CI". Até esta
// versão o que existia era `timeout-minutes: 5` em cada job, e
// `src/__tests__/ci.test.js` verificava isso. É uma verificação boa — ela impede
// um job de pendurar o runner —, e não é este critério: cinco jobs de cinco
// minutos são vinte e cinco minutos, e o CI ficaria verde com a suíte levando
// quatro vezes o teto.
//
// A diferença entre as duas coisas é o que este arquivo cobre:
//
//   * **a suíte completa inclui a e2e.** Ela nasceu nesta versão e não estava no
//     pipeline: rodar Playwright só na máquina de quem escreveu é o mesmo que
//     não ter suíte e2e (AC-TEST-06 pede explicitamente headless no CI);
//   * **o tempo é somado e medido**, não declarado. Cada job cronometra o seu
//     comando e publica o número; o último soma e reprova acima de 5 minutos.
//     O número que vale é o do runner do GitHub, não o da máquina de ninguém.
//
// O que este teste **não** pode fazer é rodar a suíte para se cronometrar: ele é
// parte dela. Ele verifica o mecanismo — que os jobs medem, que alguém soma, e
// que o teto somado é o do critério.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  ETAPAS_DA_SUITE,
  TETO_DA_SUITE_EM_MS,
  avaliar,
  relatorio,
} = require('../../scripts/orcamentoDaSuite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_CI = path.join(RAIZ, '.github', 'workflows', 'ci.yml');
const CAMINHO_PROTECAO = path.join(RAIZ, 'docs', 'PROTECAO-BRANCHES.md');

function lerCi() {
  return yaml.safeLoad(fs.readFileSync(CAMINHO_CI, 'utf8'));
}

function lerPacote() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
}

/** Todos os `run` de um job, num texto só. */
function comandosDe(job) {
  return job.steps
    .map((passo) => passo.run)
    .filter(Boolean)
    .join('\n');
}

describe('o teto do orçamento', () => {
  it('é os 5 minutos do AC-TEST-08, e não um número qualquer', () => {
    expect(TETO_DA_SUITE_EM_MS).toBe(5 * 60 * 1000);
  });

  it('nomeia as três suítes que somadas são "a suíte completa"', () => {
    // Unitária, rules e e2e. Se uma quarta suíte nascer e não entrar aqui, o
    // orçamento passa a medir menos do que existe — e o critério volta a ser
    // uma frase.
    expect(ETAPAS_DA_SUITE).toEqual(['unit', 'rules', 'e2e']);
  });
});

describe('a soma das medições', () => {
  const medicao = (nome, ms) => ({ nome, ms });

  it('aprova quando a soma cabe no teto', () => {
    const resultado = avaliar([medicao('unit', 60000), medicao('rules', 40000)], 300000);

    expect(resultado.total).toBe(100000);
    expect(resultado.dentroDoOrcamento).toBe(true);
  });

  it('reprova quando a soma estoura, mesmo com cada etapa pequena', () => {
    // O caso exato que o `timeout-minutes` por job não pega: nenhuma etapa
    // sozinha chega perto do teto, e juntas passam dele.
    const etapas = [
      medicao('unit', 120000),
      medicao('rules', 120000),
      medicao('e2e', 120000),
    ];
    const resultado = avaliar(etapas, 300000);

    expect(resultado.total).toBe(360000);
    expect(resultado.dentroDoOrcamento).toBe(false);
    expect(resultado.motivos.join(' ')).toMatch(/6\.0 min/);
  });

  it('reprova quando uma das etapas não foi medida', () => {
    // Uma etapa ausente somaria zero e faria a suíte "caber" justamente quando
    // ela não rodou. Ausência é reprovação, não é folga.
    const resultado = avaliar([medicao('unit', 60000)], 300000, ETAPAS_DA_SUITE);

    expect(resultado.dentroDoOrcamento).toBe(false);
    expect(resultado.motivos.join(' ')).toMatch(/rules/);
    expect(resultado.motivos.join(' ')).toMatch(/e2e/);
  });

  it('o relatório mostra cada etapa e o total em minutos', () => {
    const texto = relatorio(avaliar([medicao('unit', 65000), medicao('rules', 35000)], 300000));

    expect(texto).toContain('unit');
    expect(texto).toContain('1.1 min');
    expect(texto).toMatch(/total.*1\.7 min/);
    expect(texto).toContain('5.0 min');
  });
});

describe('o pipeline mede o que promete', () => {
  it('tem um job de e2e, que é a suíte que nasceu nesta versão (AC-TEST-06)', () => {
    const { jobs } = lerCi();

    expect(jobs.e2e).toBeDefined();
    expect(comandosDe(jobs.e2e)).toContain('npm run test:e2e');
  });

  it('instala o navegador do Playwright no runner, sem o qual nada abre', () => {
    const passos = lerCi().jobs.e2e.steps;

    expect(comandosDe({ steps: passos })).toMatch(/playwright install/);
  });

  it('dá Java ao job de e2e: o emulador do Firestore é uma aplicação Java', () => {
    const { steps } = lerCi().jobs.e2e;

    expect(steps.some((passo) => String(passo.uses || '').includes('setup-java'))).toBe(true);
  });

  it('cronometra as três etapas e publica o número de cada uma', () => {
    const { jobs } = lerCi();
    const porEtapa = { unit: jobs.test, rules: jobs['test-rules'], e2e: jobs.e2e };

    for (const etapa of ETAPAS_DA_SUITE) {
      expect(comandosDe(porEtapa[etapa])).toMatch(
        new RegExp(`orcamentoDaSuite\\.js medir ${etapa}`)
      );
    }
  });

  it('soma os tempos e reprova o CI acima do teto', () => {
    const { jobs } = lerCi();
    const somador = Object.values(jobs).find((job) =>
      comandosDe(job).includes('orcamento:suite')
    );

    expect(somador).toBeDefined();
    // Quem soma precisa vir depois de quem mede, ou somaria o que ainda não
    // existe e passaria por falta de dado.
    expect([].concat(somador.needs)).toContain('test-rules');
  });

  it('o script de soma está no package.json, e não só no YAML', () => {
    // Um comando que só existe dentro do workflow não pode ser rodado antes do
    // push, e um orçamento que só se descobre no CI é um orçamento que se
    // descobre tarde.
    const { scripts } = lerPacote();

    expect(scripts['orcamento:suite']).toContain('orcamentoDaSuite.js');
    expect(scripts['test:e2e']).toBeDefined();
  });

  it('a proteção de branch exige o check de e2e', () => {
    // Sem isto, o job existe, roda, falha — e o PR continua mesclável.
    const doc = fs.readFileSync(CAMINHO_PROTECAO, 'utf8');
    const linha = /Checks obrigat[óo]rios:\s*(.+)/.exec(doc);

    expect(linha).not.toBeNull();
    expect([...linha[1].matchAll(/`([^`]+)`/g)].map(([, nome]) => nome)).toContain('e2e');
  });
});
