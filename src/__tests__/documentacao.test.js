// A documentação da 1.0.0 — AC-DOC-01 a AC-DOC-07.
//
// Documentação é a entrega que o cliente pediu por escrito, e é a única do
// projeto que apodrece sem ninguém notar: o teste fica verde, o build passa, e o
// README continua dizendo que a versão é a 0.5.0 e que "a 0.2.0 é uma fundação
// de testes". Foi exatamente o que a auditoria da 1.0.0 encontrou.
//
// Este arquivo verifica o que dá para verificar, e é sincero sobre o limite:
// **nenhum teste sabe se um texto está bom.** O que ele sabe é se o texto
// concorda com o código — a versão, os scripts, os arquivos que os links
// prometem, as capturas que os manuais exibem, os ADRs que os outros documentos
// citam. É a classe de defeito que a revisão humana não pega, porque ninguém
// reconfere trinta links à mão; a qualidade do texto é justamente o que a revisão
// humana pega.
//
// A regra de ouro daqui: toda asserção é sobre uma **promessa que o documento
// faz** e que o repositório pode confirmar ou desmentir. Nada de contar palavras
// nem de exigir seção com nome exato por gosto.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');

const ler = (...partes) => fs.readFileSync(path.join(RAIZ, ...partes), 'utf8');
const existe = (...partes) => fs.existsSync(path.join(RAIZ, ...partes));

function pacote() {
  return JSON.parse(ler('package.json'));
}

/**
 * Todo arquivo `.md` que o repositório mantém como documentação.
 *
 * `tasks/` entra: as tasks citam documentos e scripts, e um link quebrado ali
 * manda a sessão seguinte procurar um arquivo que não existe.
 */
function documentos() {
  const pastas = ['.', 'docs', 'docs/adr', 'tasks'];

  return pastas.flatMap((pasta) =>
    fs
      .readdirSync(path.join(RAIZ, pasta))
      .filter((nome) => nome.endsWith('.md'))
      .map((nome) => (pasta === '.' ? nome : `${pasta}/${nome}`))
  );
}

/**
 * Os destinos relativos dos links de um documento.
 *
 * Fora: `http(s)`, `mailto`, âncora pura, e o que não parece caminho — os
 * documentos citam `[texto](url)` e `[x](javascript:alert(1))` como **exemplos**
 * de markdown, e reprovar um exemplo seria reprovar a explicação.
 */
function linksRelativos(texto) {
  return [...texto.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(([, destino]) => destino)
    .filter((destino) => !/^(?:https?:|mailto:|javascript:|#)/i.test(destino))
    .map((destino) => decodeURIComponent(destino.split('#')[0]))
    .filter((destino) => destino && /[/.]/.test(destino));
}

/** As imagens que um documento exibe, na ordem em que aparecem. */
function imagens(texto) {
  return [...texto.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(([, destino]) =>
    decodeURIComponent(destino)
  );
}

describe('todo link relativo aponta para um arquivo que existe', () => {
  // O defeito mais comum da documentação de um projeto que se mexeu muito, e o
  // mais barato de deixar passar: o arquivo foi renomeado e o link ficou.
  it.each(documentos())('%s', (documento) => {
    const base = path.dirname(path.join(RAIZ, documento));
    const quebrados = linksRelativos(ler(documento)).filter(
      (destino) => !fs.existsSync(path.join(base, destino))
    );

    expect(quebrados).toEqual([]);
  });
});

describe('README.md (AC-DOC-01, AC-CI-10)', () => {
  it('diz a versão que o package.json diz', () => {
    // O README dizia 0.5.0 com o pacote em 0.10.0. Quem chega lê o README
    // primeiro, e a primeira informação que recebia estava cinco versões atrás.
    expect(ler('README.md')).toContain(`**Versão atual:** ${pacote().version}`);
  });

  it('não descreve uma versão que já passou', () => {
    const readme = ler('README.md');

    // A seção "Estado desta versão" narrava a 0.2.0 — "os problemas conhecidos da
    // 0.1.0 continuam todos lá, de propósito". Na 1.0.0 isso é falso, e é o tipo
    // de frase que faz quem avalia o projeto achar que ele parou no início.
    expect(readme).not.toMatch(/A 0\.2\.0 é uma fundação de testes/);
    expect(readme).not.toMatch(/Getting Started with Create React App/);
  });

  it('traz os três comandos do AC-CI-10, em ordem', () => {
    const readme = ler('README.md');
    const posicao = (comando) => readme.indexOf(comando);

    expect(posicao('git clone')).toBeGreaterThan(-1);
    expect(posicao('npm install')).toBeGreaterThan(posicao('git clone'));
    expect(posicao('npm start')).toBeGreaterThan(posicao('npm install'));
  });

  it('documenta todos os scripts do package.json', () => {
    // A tabela de scripts é a que envelhece primeiro: um script novo entra no
    // `package.json` e ninguém volta no README. `test:e2e`, `orcamento` e
    // `build:e2e` nasceram nesta versão e não estavam lá.
    const readme = ler('README.md');

    // `eject` fica fora de propósito: é a saída sem volta do Create React App, e
    // documentá-la seria convidar alguém a usá-la.
    const naoDocumentados = Object.keys(pacote().scripts)
      .filter((script) => script !== 'eject')
      .filter((script) => !readme.includes(`npm run ${script}`) && !readme.includes(`npm ${script}`));

    expect(naoDocumentados).toEqual([]);
  });

  it('não documenta o eject', () => {
    expect(ler('README.md')).not.toMatch(/npm run eject/);
  });

  it('aponta para os dois manuais de usuário', () => {
    const readme = ler('README.md');

    expect(readme).toContain('docs/MANUAL-ALUNO.md');
    expect(readme).toContain('docs/MANUAL-PROFESSOR.md');
  });

  it('avisa o que acontece sem .env, que é como o clone recém-feito sobe', () => {
    expect(ler('README.md')).toMatch(/\.env/);
    expect(existe('.env.example')).toBe(true);
  });
});

describe('docs/MANUAL-ALUNO.md (AC-DOC-03)', () => {
  it('existe', () => {
    // Adiado pela v0.9.0 e de novo pela v0.10.0, cada vez com a mesma frase: "o
    // manual dele é escopo da 1.0.0".
    expect(existe('docs', 'MANUAL-ALUNO.md')).toBe(true);
  });

  // Um manual de aluno que não diz como entrar na sala não é um manual de aluno.
  // Cada item é um assunto que o AC-DOC-03 nomeia.
  it.each([
    ['entrar com o PIN', /PIN/],
    ['abrir uma dúvida', /abrir .*(?:d[úu]vida|chamado)/i],
    ['anexar um print', /anex|print|imagem/i],
    ['escolher a cor', /cor/i],
    ['conversar no chat', /chat/i],
    ['excluir a própria dúvida', /excluir/i],
    ['o que são as insígnias', /ins[íi]gnia|premia[çc]/i],
  ])('explica como %s', (_assunto, padrao) => {
    expect(ler('docs', 'MANUAL-ALUNO.md')).toMatch(padrao);
  });

  it('mostra capturas de tela, e cada uma é um arquivo que existe', () => {
    // "com capturas de tela" é o texto do critério. Um manual que promete a
    // imagem e exibe um quadrado quebrado é pior do que um sem imagem nenhuma.
    const exibidas = imagens(ler('docs', 'MANUAL-ALUNO.md'));

    expect(exibidas.length).toBeGreaterThanOrEqual(4);

    for (const imagem of exibidas) {
      const caminho = path.join(RAIZ, 'docs', imagem);

      expect(fs.existsSync(caminho)).toBe(true);
      // Um PNG de 0 byte existe e não mostra nada.
      expect(fs.statSync(caminho).size).toBeGreaterThan(1000);
    }
  });

  it('toda captura tem texto alternativo', () => {
    // Um manual é lido por quem usa leitor de tela também, e o projeto tem
    // acessibilidade como critério (AC-A11Y-*). `![](imagem.png)` não serve.
    const semTextoAlternativo = [
      ...ler('docs', 'MANUAL-ALUNO.md').matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g),
    ].filter(([, alternativo]) => alternativo.trim().length < 3);

    expect(semTextoAlternativo.map(([, , destino]) => destino)).toEqual([]);
  });
});

describe('as capturas são reproduzíveis, e não recortadas à mão', () => {
  it('existe o script que as gera', () => {
    // Uma captura tirada à mão não se refaz quando a tela muda: ela envelhece em
    // silêncio, e o manual passa a mostrar uma interface que não existe mais.
    expect(existe('scripts', 'gerarCapturas.js')).toBe(true);
    expect(pacote().scripts).toHaveProperty('capturas');
  });

  it('o script grava na pasta que os manuais usam', () => {
    expect(ler('scripts', 'gerarCapturas.js')).toMatch(/imagens/);
  });
});

describe('docs/MANUAL-PROFESSOR.md (AC-DOC-04)', () => {
  it('não continua avisando que cobre só as premiações', () => {
    // O cabeçalho dizia: "Versão 0.9.0. Este manual cobre, por enquanto, as
    // premiações. Salas, PIN e moderação entram aqui na 1.0.0".
    const manual = ler('docs', 'MANUAL-PROFESSOR.md');

    expect(manual).not.toMatch(/por enquanto/i);
    expect(manual).not.toMatch(/entram aqui na 1\.0\.0/);
  });

  it.each([
    ['criar a sala', /criar .*sala/i],
    ['distribuir o PIN', /PIN/],
    ['regerar o PIN', /regerar|gerar (?:um )?(?:novo|outro) PIN/i],
    ['acompanhar a fila', /fila/i],
    ['marcar como atendido', /atendid/i],
    ['moderar o chat', /moderar|apagar (?:a )?mensagem/i],
    ['usar a mensagem direta', /mensagem direta|conversa direta|DM/i],
    ['conceder premiações', /premia[çc]/i],
    ['arquivar a sala', /arquivar/i],
  ])('cobre %s', (_assunto, padrao) => {
    expect(ler('docs', 'MANUAL-PROFESSOR.md')).toMatch(padrao);
  });
});

describe('docs/ARQUITETURA.md (AC-DOC-05)', () => {
  const secoes = () =>
    ler('docs', 'ARQUITETURA.md')
      .split(/^## /m)
      .slice(1);

  it.each([
    ['autenticação e resolução de papel', /autentica/i],
    ['entrada por PIN', /PIN/],
    ['ciclo de vida do chamado', /ciclo de vida do chamado/i],
  ])('tem o diagrama de fluxo de %s', (_fluxo, padrao) => {
    // "Diagrama" aqui é o desenho em bloco de texto que o documento já usa para
    // o PIN — e o que se verifica é que existe um, e não só a prosa: uma seção
    // que fala de autenticação sem desenhar o caminho não é um diagrama de fluxo.
    const secao = secoes().find((texto) => padrao.test(texto.split('\n')[0]));

    expect(secao).toBeDefined();
    expect(secao).toMatch(/```[\s\S]*[│├└─►][\s\S]*```/);
  });

  it('descreve todas as coleções que as rules conhecem', () => {
    // O modelo de dados do documento e as rules discordarem é o defeito que faz
    // alguém implementar contra a página em vez de contra o código.
    const documento = ler('docs', 'ARQUITETURA.md');
    const rules = ler('firestore.rules');
    // `databases` fica fora: `match /databases/{database}/documents` é o invólucro
    // que toda regra de Firestore tem, e não uma coleção do modelo.
    const colecoes = [...rules.matchAll(/match \/([a-zA-Z]+)\/\{/g)]
      .map(([, nome]) => nome)
      .filter((nome) => nome !== 'databases');

    const ausentes = [...new Set(colecoes)].filter((colecao) => !documento.includes(colecao));

    expect(ausentes).toEqual([]);
  });
});

describe('docs/SEGURANCA.md (AC-SEC-06, passo 3 da task 09)', () => {
  it('existe', () => {
    expect(existe('docs', 'SEGURANCA.md')).toBe(true);
  });

  it.each([
    ['o modelo de ameaça', /modelo de amea[çc]a/i],
    ['os domínios autorizados do Firebase Auth', /dom[íi]nios autorizados/i],
    ['a resposta a incidente', /incidente/i],
    ['o deny by default das rules', /deny by default|negar por (?:padr[ãa]o|omiss[ãa]o)/i],
    ['o teto de tamanho do anexo', /5 ?MB/i],
  ])('documenta %s', (_assunto, padrao) => {
    expect(ler('docs', 'SEGURANCA.md')).toMatch(padrao);
  });

  it('nomeia, para cada AC de segurança, o teste que o prova', () => {
    // O passo 3 da task pede a auditoria linha a linha das rules. O que
    // transforma a auditoria em algo que não apodrece é o nome do arquivo de
    // teste ao lado de cada afirmação — e este teste confere que o arquivo citado
    // existe de verdade.
    const doc = ler('docs', 'SEGURANCA.md');

    for (let numero = 1; numero <= 8; numero += 1) {
      expect(doc).toContain(`AC-SEC-0${numero}`);
    }

    const citados = [...doc.matchAll(/`((?:src|tests|scripts)\/[\w./-]+\.(?:js|rules))`/g)].map(
      ([, caminho]) => caminho
    );

    expect(citados.length).toBeGreaterThan(5);
    expect(citados.filter((caminho) => !existe(caminho))).toEqual([]);
  });
});

describe('os ADRs (AC-DOC-07)', () => {
  const adrs = () =>
    fs
      .readdirSync(path.join(RAIZ, 'docs', 'adr'))
      .filter((nome) => /^\d{4}-.+\.md$/.test(nome))
      .sort();

  it('são numerados em sequência, sem buraco', () => {
    // Um buraco na numeração significa um ADR apagado, e um ADR apagado é uma
    // decisão que foi tomada e cuja razão se perdeu.
    const numeros = adrs().map((nome) => Number(nome.slice(0, 4)));

    expect(numeros).toEqual(numeros.map((_, indice) => indice + 1));
  });

  it.each([
    ['a divisão do bundle por rota', /bundle|code.?splitting|rota/i],
    ['a suíte end-to-end', /playwright|end-to-end/i],
  ])('registra a decisão sobre %s', (_decisao, padrao) => {
    // O padrão é conferido no **título** do ADR, e não no corpo: qualquer ADR
    // pode mencionar Playwright de passagem, e uma menção de passagem não é a
    // decisão registrada. O ADR 0011 cita "end-to-end" numa frase sobre o que
    // ficou de fora, e faria esta asserção passar sem que a decisão existisse.
    const titulos = adrs().map((nome) => ler('docs', 'adr', nome).split('\n')[0]);

    expect(titulos.filter((titulo) => padrao.test(titulo))).not.toEqual([]);
  });

  it.each(
    fs
      .readdirSync(path.join(__dirname, '..', '..', 'docs', 'adr'))
      .filter((nome) => /^\d{4}-.+\.md$/.test(nome))
  )('%s tem contexto, decisão e consequências', (nome) => {
    const adr = ler('docs', 'adr', nome);

    expect(adr).toMatch(/^#+ .*contexto/im);
    expect(adr).toMatch(/^#+ .*decis[ãa]o/im);
    expect(adr).toMatch(/^#+ .*consequ[êe]ncia/im);
  });
});

describe('CONTRIBUTING.md (AC-DOC-06)', () => {
  it('manda rodar a suíte end-to-end antes do PR', () => {
    // A suíte e2e nasceu nesta versão. Um contribuidor que siga o CONTRIBUTING à
    // letra abriria o PR sem tê-la rodado, e descobriria no CI.
    expect(ler('CONTRIBUTING.md')).toContain('npm run test:e2e');
  });

  it('descreve o fluxo de branches, o padrão de commits e como rodar os testes', () => {
    const doc = ler('CONTRIBUTING.md');

    expect(doc).toMatch(/Conventional Commits/);
    expect(doc).toMatch(/`dev`/);
    expect(doc).toMatch(/npm run test:ci/);
  });
});
