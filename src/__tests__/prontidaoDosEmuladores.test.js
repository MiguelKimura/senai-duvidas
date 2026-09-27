// A espera pelos emuladores não pode ser cobrada de um teste — AC-TEST-06, AC-TEST-09.
//
// O defeito que este arquivo fixa apareceu rodando a suíte inteira numa máquina
// carregada, e é do tipo pior de todos: reprovou **seis testes** que não tinham
// nada de errado, e não reprovou nenhuma vez quando os mesmos arquivos foram
// rodados sozinhos.
//
// **O que acontecia.** `aguardarEmuladores()` é uma espera por condição — está
// certa, e é o que o AC-TEST-09 pede em vez de um `sleep`. O problema é **onde**
// ela era aguardada: dentro de `limparTudo()`, que roda no `beforeEach` de todo
// spec. Numa subida a frio, os emuladores de Auth e de Storage abrem a porta
// depois do de Firestore — e o `webServer` do Playwright só sabe esperar **uma**
// URL, que é a do Firestore. O resto da espera caía no orçamento do primeiro
// teste que precisasse do banco.
//
// E aí vem a parte que transforma um teste lento numa suíte vermelha: a promessa
// é **memoizada**. O primeiro teste estoura o teto de 60s (ou o de 120s, no de
// carga) esperando a porta; o segundo aguarda a *mesma* promessa, ainda pendente,
// e estoura também; e assim por diante, até os emuladores subirem. Na execução
// que revelou isto, os cinco testes de carga e o primeiro de chamado morreram em
// cascata, cada um com "Test timeout exceeded while running beforeEach hook" —
// uma mensagem que aponta para o teste, e não para a causa.
//
// **A regra que fica.** A prontidão da infraestrutura é pré-condição da suíte, e
// não custo de um teste. Ela é aguardada uma vez em `globalSetup`, que roda antes
// de existir o primeiro teste e tem orçamento próprio. É por isso que a primeira
// asserção compara os dois orçamentos: enquanto a espera puder levar mais tempo
// do que um teste inteiro tem, ela não pode morar num hook por teste.
//
// O arquivo é lido como **texto**, e não `require`ado: `playwright.config.js`
// importa `@playwright/test`, que não carrega dentro do Jest. Ler o fonte é o que
// `ci.test.js` e `orcamentoDaSuite.test.js` já fazem com os arquivos que
// descrevem o pipeline.
const fs = require('fs');
const path = require('path');

const { ESPERA_MAXIMA_MS } = require('../../tests/e2e/fixtures/emulador');

const RAIZ = path.join(__dirname, '..', '..');

const ler = (relativo) => fs.readFileSync(path.join(RAIZ, relativo), 'utf8');

const CONFIGURACAO = ler('playwright.config.js');

/** O valor de uma chave numérica de primeiro nível da configuração. */
function numeroDe(chave) {
  const encontrado = new RegExp(`^\\s{2}${chave}:\\s*(\\d+)`, 'm').exec(CONFIGURACAO);

  return encontrado ? Number(encontrado[1]) : null;
}

/** O caminho declarado em `globalSetup`, ou `null` se não houver nenhum. */
function globalSetupDeclarado() {
  const encontrado = /globalSetup:\s*(?:require\.resolve\()?['"]([^'"]+)['"]/.exec(CONFIGURACAO);

  return encontrado ? encontrado[1] : null;
}

describe('a prontidão dos emuladores é pré-condição da suíte, não custo de um teste', () => {
  it('a espera pela porta pode levar mais tempo do que um teste inteiro tem', () => {
    // A premissa do arquivo, escrita como asserção: é esta desigualdade que faz
    // a espera não poder morar num `beforeEach`. Se um dia a espera passar a
    // caber com folga no teto de um teste, esta asserção quebra e o raciocínio
    // acima precisa ser relido — não apagado.
    expect(numeroDe('timeout')).toBeGreaterThan(0);
    expect(ESPERA_MAXIMA_MS).toBeGreaterThan(numeroDe('timeout'));
  });

  it('o Playwright espera os emuladores antes do primeiro teste, em `globalSetup`', () => {
    const declarado = globalSetupDeclarado();

    expect(declarado).not.toBeNull();
    expect(fs.existsSync(path.join(RAIZ, declarado))).toBe(true);
  });

  it('o `globalSetup` aguarda a sonda, em vez de só existir', () => {
    const fonte = ler(globalSetupDeclarado());

    // `aguardarEmuladores` é quem sonda Auth, Firestore e Storage — os três, em
    // vez do único que o `webServer` do Playwright consegue esperar.
    expect(fonte).toMatch(/aguardarEmuladores/);
    expect(fonte).toMatch(/await\s+aguardarEmuladores\(\)/);
  });

  it('a sonda cobre os três emuladores, e não só o do Firestore', () => {
    const fonte = ler(path.join('tests', 'e2e', 'fixtures', 'emulador.js'));

    // O `webServer` esperar só o Firestore é o que criou o problema; a sonda
    // existir para os três é o que o resolve. Se alguém tirar Auth ou Storage
    // daqui, o `globalSetup` volta a liberar a suíte cedo demais.
    for (const emulador of ['Auth', 'Firestore', 'Storage']) {
      expect(fonte).toContain(`['${emulador}'`);
    }
  });
});
