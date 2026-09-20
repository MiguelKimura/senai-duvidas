// O pipeline de CI — AC-CI-03, AC-CI-05, AC-TEST-08.
//
// Um workflow do GitHub Actions só é exercitado de verdade no GitHub, e
// descobrir que ele está quebrado no primeiro PR é tarde. Este teste cobre o
// que dá para verificar em casa: que o arquivo existe, que dispara nas branches
// certas, que os jobs se encadeiam na ordem prometida e — o ponto principal —
// que os nomes dos jobs são exatamente os que `docs/PROTECAO-BRANCHES.md` manda
// marcar como obrigatórios no GitHub.
//
// Essa última verificação é a que importa a longo prazo. A proteção de branch é
// configurada na UI pelo nome do check; renomear um job aqui, sem atualizar o
// documento, faz a proteção continuar exigindo um check que nunca mais roda —
// e um check que nunca roda nunca reprova. O PR passaria a ser mesclável sem
// CI nenhum, silenciosamente. Aqui o desencontro vira teste vermelho.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_CI = path.join(RAIZ, '.github', 'workflows', 'ci.yml');
const CAMINHO_PROTECAO = path.join(RAIZ, 'docs', 'PROTECAO-BRANCHES.md');
const CAMINHO_TEMPLATE = path.join(RAIZ, '.github', 'pull_request_template.md');

function lerCi() {
  return yaml.safeLoad(fs.readFileSync(CAMINHO_CI, 'utf8'));
}

/** Os checks que o documento de proteção manda exigir no GitHub. */
function checksObrigatoriosDocumentados() {
  const doc = fs.readFileSync(CAMINHO_PROTECAO, 'utf8');
  const linha = /Checks obrigat[óo]rios:\s*(.+)/.exec(doc);

  if (!linha) throw new Error('docs/PROTECAO-BRANCHES.md não lista os checks obrigatórios.');

  return [...linha[1].matchAll(/`([^`]+)`/g)].map(([, nome]) => nome);
}

describe('.github/workflows/ci.yml', () => {
  it('existe', () => {
    expect(fs.existsSync(CAMINHO_CI)).toBe(true);
  });

  it('dispara em push e em pull request para main e dev', () => {
    // `on` vira `true` no YAML 1.1, que é o que o js-yaml 3 implementa.
    const gatilhos = lerCi().on || lerCi()[true];

    expect(gatilhos.push.branches).toEqual(expect.arrayContaining(['main', 'dev']));
    expect(gatilhos.pull_request.branches).toEqual(expect.arrayContaining(['main', 'dev']));
  });

  it('define exatamente os jobs que a proteção de branch exige', () => {
    const jobs = Object.keys(lerCi().jobs);

    for (const check of checksObrigatoriosDocumentados()) {
      expect(jobs).toContain(check);
    }
  });

  it('encadeia lint -> test -> test-rules -> build', () => {
    const { jobs } = lerCi();

    expect(jobs.lint.needs).toBeUndefined();
    expect([].concat(jobs.test.needs)).toContain('lint');
    expect([].concat(jobs['test-rules'].needs)).toContain('test');
    expect([].concat(jobs.build.needs)).toContain('test-rules');
  });

  it('roda cada job em Node 20 com instalação reprodutível', () => {
    const { jobs } = lerCi();

    for (const [nome, job] of Object.entries(jobs)) {
      const passos = job.steps;
      const node = passos.find((passo) => String(passo.uses || '').includes('actions/setup-node'));

      // O job de commits só lê o histórico do git: não instala nada.
      if (nome === 'commits') continue;

      expect(String(node.with['node-version'])).toBe('20');
      expect(node.with.cache).toBe('npm');
      expect(passos.some((passo) => passo.run === 'npm ci')).toBe(true);
    }
  });

  it('cada job roda o script que lhe dá nome', () => {
    const { jobs } = lerCi();
    const comandos = (job) => job.steps.map((passo) => passo.run).join('\n');

    expect(comandos(jobs.lint)).toContain('npm run lint');
    expect(comandos(jobs.test)).toContain('npm run test:ci');
    expect(comandos(jobs['test-rules'])).toContain('npm run test:rules');
    expect(comandos(jobs.build)).toContain('npm run build');
  });

  it('dá Java ao job de rules, sem o qual o emulador do Firestore não sobe', () => {
    const passos = lerCi().jobs['test-rules'].steps;

    expect(passos.some((passo) => String(passo.uses || '').includes('actions/setup-java'))).toBe(
      true
    );
  });

  it('publica a cobertura como artefato', () => {
    const passos = lerCi().jobs.test.steps;
    const upload = passos.find((passo) => String(passo.uses || '').includes('upload-artifact'));

    expect(upload).toBeDefined();
    expect(upload.with.path).toMatch(/coverage/);
    // `always()`: cobertura de uma suíte que falhou é justamente a que se quer ler.
    expect(upload.if).toMatch(/always\(\)/);
  });

  it('limita cada job a 5 minutos, que é o teto do AC-TEST-08', () => {
    const { jobs } = lerCi();

    for (const [nome, job] of Object.entries(jobs)) {
      expect(job['timeout-minutes']).toBeDefined();
      expect(job['timeout-minutes']).toBeLessThanOrEqual(5);
      expect(nome).toBeTruthy();
    }
  });

  it('valida Conventional Commits nos commits do PR', () => {
    const { jobs } = lerCi();

    expect(jobs.commits).toBeDefined();
    expect(jobs.commits.steps.map((passo) => passo.run).join('\n')).toMatch(
      /feat\|fix\|docs\|style\|refactor\|perf\|test\|build\|ci\|chore/
    );
  });

  it('não pede mais permissão ao token do que ler o repositório', () => {
    expect(lerCi().permissions).toEqual({ contents: 'read' });
  });
});

describe('.github/pull_request_template.md', () => {
  it('traz as seções que o tasks/_PROTOCOLO.md exige no corpo do PR', () => {
    const template = fs.readFileSync(CAMINHO_TEMPLATE, 'utf8');

    for (const secao of [
      'Resumo',
      'Critérios de aceite atendidos',
      'Ciclo Red-Green-Refactor',
      'Compatibilidade',
      'Verificação',
      'Riscos e plano de reversão',
    ]) {
      expect(template).toContain(secao);
    }
  });
});
