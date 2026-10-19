// Nenhum segredo versionado — AC-AUTH-10.
//
// A metade "a config vem de `REACT_APP_*` com fallback documentado" está
// provada desde a v0.2.0, em `src/__tests__/firebaseConfig.test.js`. A outra
// metade — *nenhuma credencial, chave de serviço ou segredo fica versionado no
// repositório* — nunca teve teste, e é a que dói: uma chave de service account
// commitada continua válida depois de apagada, porque o histórico do git a
// guarda para sempre.
//
// O enunciado da task 09 pede explicitamente a varredura **inclusive no
// histórico**, e é o que este arquivo faz. Ele é o único teste do projeto que
// chama `git`, e por um motivo: não existe outra forma de perguntar o que já
// esteve no repositório.
//
// O que ele **não** é: um scanner de segredo genérico. Ele conhece os formatos
// que este projeto usaria se errasse — chave privada PEM, service account do
// Google, token do GitHub — e o arquivo que já quase entrou uma vez, o
// `senai-duvidas-firebase-adminsdk-*.json` que o `.gitignore` nomeia.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');

function git(...argumentos) {
  return execFileSync('git', argumentos, {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Os arquivos que o git versiona hoje. */
function versionadosHoje() {
  return git('ls-files').split('\n').filter(Boolean);
}

/** Todo caminho que já esteve em algum commit alcançável desta branch. */
function versionadosAlgumDia() {
  const saida = git('log', '--pretty=format:', '--name-only', '--all');

  return [...new Set(saida.split('\n').filter(Boolean))];
}

/**
 * Nomes de arquivo que não podem ser versionados, nem hoje nem nunca.
 *
 * `.env` fica de fora da lista por si só e entra pelo teste do `.gitignore`:
 * `.env.example` é um nome que começa com `.env` e **precisa** ser versionado.
 */
const ARQUIVOS_PROIBIDOS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(local|development\.local|test\.local|production\.local)$/,
  /firebase-adminsdk.*\.json$/i,
  /(^|\/)serviceAccount.*\.json$/i,
  /\.(pem|pfx|p12|key|keystore|jks)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.netrc$/,
];

/**
 * Conteúdos que denunciam segredo, com o nome do que cada um é.
 *
 * A chave pública do cliente Firebase (`AIza...`) **não** está aqui de
 * propósito: ela está no fallback de `src/firebase.js`, o bundle a expõe de
 * qualquer forma, e o que protege os dados são as Security Rules. O ADR e o
 * comentário daquele arquivo registram a decisão; transformá-la em falha de
 * teste seria trocar uma decisão documentada por um alarme diário.
 */
const CONTEUDOS_PROIBIDOS = [
  [/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, 'chave privada'],
  [/"type"\s*:\s*"service_account"/, 'service account do Google'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'token do GitHub'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'token do Slack'],
  [/\bsk-[A-Za-z0-9]{32,}/, 'chave de API no formato sk-'],
  [/\bASIA[A-Z0-9]{16}\b|\bAKIA[A-Z0-9]{16}\b/, 'chave da AWS'],
  [/_SECRET\s*=\s*["'][^"'\s]{8,}["']/, 'segredo atribuído em código'],
];

/** Arquivos que o teste não lê: binário e o próprio teste, que cita os padrões. */
const IGNORADOS = [
  /^package-lock\.json$/,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|woff2?)$/i,
  /^src\/__tests__\/segredosVersionados\.test\.js$/,
];

describe('nenhum segredo no repositório de hoje (AC-AUTH-10)', () => {
  const arquivos = versionadosHoje();

  it('o levantamento encontrou arquivos — uma lista vazia aprovaria tudo', () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('nenhum arquivo de credencial está versionado', () => {
    const achados = arquivos.filter((arquivo) =>
      ARQUIVOS_PROIBIDOS.some((padrao) => padrao.test(arquivo))
    );

    expect(achados).toEqual([]);
  });

  it('nenhum conteúdo de segredo aparece em arquivo versionado', () => {
    const achados = [];

    for (const arquivo of arquivos) {
      if (IGNORADOS.some((padrao) => padrao.test(arquivo))) continue;

      const caminho = path.join(RAIZ, arquivo);
      if (!fs.existsSync(caminho)) continue;

      const conteudo = fs.readFileSync(caminho, 'utf8');

      for (const [padrao, nome] of CONTEUDOS_PROIBIDOS) {
        if (padrao.test(conteudo)) achados.push(`${arquivo}: ${nome}`);
      }
    }

    expect(achados).toEqual([]);
  });

  it('a varredura de conteúdo de fato enxerga um segredo', () => {
    const isca = '{ "type": "service_account", "private_key": "-----BEGIN PRIVATE KEY-----" }';
    const nomes = CONTEUDOS_PROIBIDOS.filter(([padrao]) => padrao.test(isca)).map(
      ([, nome]) => nome
    );

    expect(nomes).toEqual(expect.arrayContaining(['chave privada', 'service account do Google']));
  });
});

describe('nenhum segredo no histórico do git (AC-AUTH-10)', () => {
  // Apagar o arquivo no commit seguinte não resolve nada: `git show` do commit
  // antigo devolve a chave inteira, e quem clona o repositório leva o
  // histórico junto. Se este teste ficar vermelho, a correção **não** é apagar
  // o arquivo: é revogar a credencial no console e só depois reescrever o
  // histórico. Está escrito assim em `docs/SEGURANCA.md`.
  it('nenhum arquivo de credencial já esteve versionado', () => {
    const achados = versionadosAlgumDia().filter((arquivo) =>
      ARQUIVOS_PROIBIDOS.some((padrao) => padrao.test(arquivo))
    );

    expect(achados).toEqual([]);
  });

  it('o histórico foi de fato percorrido — um levantamento vazio aprovaria tudo', () => {
    const historico = versionadosAlgumDia();

    expect(historico.length).toBeGreaterThan(50);
    expect(historico).toContain('package.json');
  });
});

describe('o .gitignore protege o que não pode entrar (AC-AUTH-10)', () => {
  const gitignore = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');

  it.each([['.env'], ['.env.local'], ['.env.production.local']])(
    'ignora %s',
    (arquivo) => {
      // `check-ignore` responde pela regra de verdade, e não pela leitura que
      // este teste faria do texto do arquivo.
      let ignorado = true;

      try {
        git('check-ignore', '-q', arquivo);
      } catch {
        ignorado = false;
      }

      expect(ignorado).toBe(true);
    }
  );

  it('não ignora o .env.example, que é o modelo e precisa ser versionado', () => {
    expect(versionadosHoje()).toContain('.env.example');
  });

  it('nomeia a chave de service account que já esteve na pasta do projeto', () => {
    expect(gitignore).toMatch(/firebase-adminsdk/);
  });

  it('o .env.example traz só marcador, nunca a credencial de um projeto real', () => {
    // Deixar os valores em branco não é o que se pede aqui: `seu-projeto` é um
    // marcador útil, que diz o formato esperado sem apontar para lugar nenhum.
    // O que não pode é o exemplo virar cópia do `.env` de alguém — que é como
    // uma chave real entra num arquivo que ninguém desconfia.
    const exemplo = fs.readFileSync(path.join(RAIZ, '.env.example'), 'utf8');
    const preenchidas = [...exemplo.matchAll(/^REACT_APP_[A-Z_]+=(.+)$/gm)].map(([, valor]) =>
      valor.trim()
    );

    for (const valor of preenchidas) {
      expect(valor).toMatch(/seu-projeto/);
      expect(valor).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
      expect(valor).not.toMatch(/\d{1,2}:\d{6,}:web:[0-9a-f]{10,}/);
    }
  });
});
