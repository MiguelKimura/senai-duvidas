// O release: tag, deploy e caminho de volta — AC-CI-07, AC-CI-08, AC-CI-06.
//
// Dois critérios estavam sem nada que os provasse, e os dois são sobre o que
// acontece **depois** do merge:
//
//   * **AC-CI-07** — "cada merge em `main` gera uma tag de versão e uma entrada
//     no CHANGELOG". Não havia workflow de release. Um merge em `main` rodava o
//     CI e terminava ali: nada marcava o commit, e daqui a seis meses ninguém
//     saberia qual commit é a 1.0.0 que está no laboratório.
//   * **AC-CI-08** — "o deploy de produção acontece a partir de `main`; `dev`
//     publica em homologação". Não havia procedimento documentado nem
//     automatizado.
//
// O que este arquivo pode verificar e o que não pode: ele lê o YAML e o Markdown,
// e afirma que o gatilho, a ordem e o texto estão onde o critério pede. Ele não
// pode publicar nada, e o primeiro deploy de verdade é o que vai confirmar as
// credenciais do ambiente. A parte que dá para automatizar em casa está
// automatizada; a parte que não dá está nomeada em `docs/RELEASE.md`.
//
// A asserção mais útil daqui é a última do arquivo: `package.json`, `CHANGELOG.md`
// e `docs/HISTORICO.md` precisam concordar sobre qual é a versão. Três lugares que
// dizem a mesma coisa é três lugares para divergir, e a divergência aparece na
// pior hora — no dia em que alguém procura o que mudou na versão que está em
// produção.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_RELEASE = path.join(RAIZ, '.github', 'workflows', 'release.yml');
const CAMINHO_DOC = path.join(RAIZ, 'docs', 'RELEASE.md');

function lerRelease() {
  return yaml.safeLoad(fs.readFileSync(CAMINHO_RELEASE, 'utf8'));
}

function lerDoc() {
  return fs.readFileSync(CAMINHO_DOC, 'utf8');
}

function versaoDoPacote() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
}

/** Todos os `run` de todos os jobs, num texto só. */
function comandosDoWorkflow(workflow) {
  return Object.values(workflow.jobs)
    .flatMap(({ steps }) => steps.map((passo) => passo.run))
    .filter(Boolean)
    .join('\n');
}

describe('.github/workflows/release.yml', () => {
  it('existe', () => {
    expect(fs.existsSync(CAMINHO_RELEASE)).toBe(true);
  });

  it('dispara em push para main, que é o merge do release (AC-CI-07)', () => {
    // `on` vira `true` no YAML 1.1, que é o que o js-yaml 3 implementa — a mesma
    // pegadinha de `src/__tests__/ci.test.js`.
    const workflow = lerRelease();
    const gatilhos = workflow.on || workflow[true];

    expect(gatilhos.push.branches).toEqual(['main']);
    // E **só** main: um release disparado por push em dev publicaria homologação
    // como se fosse produção.
    expect(gatilhos.push.branches).not.toContain('dev');
  });

  it('roda a suíte completa antes de publicar qualquer coisa (AC-CI-07)', () => {
    const comandos = comandosDoWorkflow(lerRelease());

    for (const script of ['npm run lint', 'npm run test:ci', 'npm run test:rules', 'npm run test:e2e', 'npm run build']) {
      expect(comandos).toContain(script);
    }
  });

  it('cria a tag a partir da versão do package.json, e não de um número digitado', () => {
    // Digitar a versão no workflow é garantir que um dia ela discorde do
    // `package.json`. A tag sai de `node -p` sobre o próprio arquivo.
    const comandos = comandosDoWorkflow(lerRelease());

    expect(comandos).toMatch(/package\.json/);
    expect(comandos).toMatch(/git tag/);
    expect(comandos).toMatch(/v\$/);
  });

  it('não repete a tag quando o workflow roda duas vezes', () => {
    // Um push a mais em main — um `docs` de correção, um merge de hotfix — não
    // pode falhar o workflow por tag já existente, e também não pode mover a tag
    // de um release publicado.
    const comandos = comandosDoWorkflow(lerRelease());

    expect(comandos).toMatch(/git (?:ls-remote|rev-parse|tag -l)/);
  });

  it('pede permissão de escrita para poder criar a tag', () => {
    // O `ci.yml` só lê (`contents: read`). Este precisa escrever, e precisa
    // dizer isso — token com permissão implícita é o que faz um workflow
    // inofensivo virar um que apaga branch.
    expect(lerRelease().permissions).toEqual({ contents: 'write' });
  });

  it('extrai do CHANGELOG a seção da versão para o corpo do release (AC-CI-07)', () => {
    const comandos = comandosDoWorkflow(lerRelease());

    expect(comandos).toMatch(/CHANGELOG\.md/);
  });

  it('limita cada job no tempo, como o ci.yml faz', () => {
    for (const job of Object.values(lerRelease().jobs)) {
      expect(job['timeout-minutes']).toBeDefined();
    }
  });
});

describe('docs/RELEASE.md', () => {
  it('existe', () => {
    expect(fs.existsSync(CAMINHO_DOC)).toBe(true);
  });

  it('descreve os dois ambientes e de onde cada um sai (AC-CI-08)', () => {
    const doc = lerDoc();

    expect(doc).toMatch(/produ[çc][ãa]o/i);
    expect(doc).toMatch(/homologa[çc][ãa]o/i);
    // A frase que é o critério: produção de `main`, homologação de `dev`.
    expect(doc).toMatch(/`main`/);
    expect(doc).toMatch(/`dev`/);
  });

  it('traz o procedimento de rollback, com o comando (AC-CI-08)', () => {
    const doc = lerDoc();

    expect(doc).toMatch(/rollback|revers[ãa]o/i);
    // Não basta dizer "reverta": um procedimento de rollback sem comando é um
    // procedimento que ninguém executa às onze da noite.
    expect(doc).toMatch(/firebase hosting:(?:clone|rollback)|git revert/);
  });

  it('diz o que fazer com a migração de dados ao reverter', () => {
    // Reverter o código é fácil; o que morde é o dado já migrado. O documento
    // precisa dizer para onde olhar.
    expect(lerDoc()).toMatch(/MIGRACOES|migra[çc]/i);
  });

  it('nomeia a tag do release desta versão', () => {
    expect(lerDoc()).toContain(`v${versaoDoPacote()}`);
  });
});

describe('a versão é a mesma nos três lugares que a declaram', () => {
  const versao = versaoDoPacote();

  it('o CHANGELOG tem a seção desta versão (AC-CI-07, AC-CI-09)', () => {
    const changelog = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');

    expect(changelog).toMatch(new RegExp(`^## \\[${versao.replace(/\./g, '\\.')}\\]`, 'm'));
  });

  it('a seção desta versão é a primeira do arquivo', () => {
    const changelog = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
    const primeira = /^## \[([^\]]+)\]/m.exec(changelog);

    expect(primeira[1]).toBe(versao);
  });

  it('o HISTORICO tem a entrada desta versão (AC-DOC-02)', () => {
    expect(fs.readFileSync(path.join(RAIZ, 'docs', 'HISTORICO.md'), 'utf8')).toContain(versao);
  });
});
