// Nenhuma espera cega na suíte end-to-end — AC-TEST-09.
//
// A regra está em `scripts/varrerEsperaCega.js`, e este arquivo cobre as duas
// metades dela, como `cicloRedGreenRefactor.test.js` faz com a regra do histórico:
//
//   * **a regra em si**, contra textos sintéticos. É aqui que se prova que ela
//     reprova — o `waitForTimeout`, o `setTimeout` embrulhado em `Promise`, o
//     `new Date()` cru — e que ela **não** reprova o que só parece: o teto
//     `test.setTimeout(120000)`, que é o oposto de uma espera, e um comentário
//     que menciona a API sem a chamar.
//   * **a suíte de verdade**, arquivo por arquivo. Uma regra correta que ninguém
//     aponta para a pasta não guarda nada.
//
// Por que o teste mora em `src/__tests__/` e não ao lado dos specs que ele lê:
// `npm run test:ci` roda com `--roots src --roots scripts`, e um arquivo fora
// desses dois lugares não roda no CI. Um guarda que não roda não guarda.
const {
  EXCECOES,
  arquivosDaSuite,
  esperasCegasEm,
  relativo,
  semComentarios,
  varrer,
} = require('../../scripts/varrerEsperaCega');

describe('a leitura do código, sem os comentários', () => {
  it('apaga o comentário de linha e mantém a linha', () => {
    expect(semComentarios('const a = 1; // waitForTimeout')).toBe('const a = 1; ');
  });

  it('apaga o comentário de bloco sem mudar a contagem de linhas', () => {
    const texto = '/*\n * await page.waitForTimeout(500)\n */\nconst a = 1;';

    expect(semComentarios(texto).split('\n')).toHaveLength(4);
    expect(esperasCegasEm(texto)).toEqual([]);
  });

  it('não confunde o `//` de uma URL com um comentário', () => {
    // Sem a guarda, `http://` viraria comentário e a linha inteira desapareceria
    // da varredura — e uma espera cega depois de uma URL na mesma linha passaria.
    expect(semComentarios("goto('http://x'); await page.waitForTimeout(1);")).toContain(
      'waitForTimeout'
    );
  });
});

describe('a regra da espera cega', () => {
  it('reprova waitForTimeout, dizendo onde e por quê', () => {
    const [problema] = esperasCegasEm('a\nawait page.waitForTimeout(500);\n');

    expect(problema.numero).toBe(2);
    expect(problema.motivo).toMatch(/espere por condi/i);
  });

  it('reprova o setTimeout embrulhado em Promise, que é o mesmo sono à mão', () => {
    expect(esperasCegasEm('await new Promise((r) => setTimeout(r, 500));')).toHaveLength(1);
  });

  it('reprova new Date() sem argumento', () => {
    expect(esperasCegasEm('const agora = new Date();')).toHaveLength(1);
  });

  it('NÃO reprova test.setTimeout, que é teto e não espera', () => {
    // A distinção que faz esta varredura valer a pena em vez de um `grep`:
    // `test.setTimeout` não espera nada, e tirá-lo deixaria um `waitFor` que
    // nunca resolve pendurar o CI.
    expect(esperasCegasEm('test.setTimeout(120000);')).toEqual([]);
  });

  it('NÃO reprova new Date(valor), que é conversão e não leitura de relógio', () => {
    expect(esperasCegasEm("new Date('2026-03-10T13:45:00.000Z')")).toEqual([]);
  });
});

describe('a suíte e2e de verdade', () => {
  const arquivos = arquivosDaSuite();

  it('tem os specs dos fluxos críticos, e é neles que a varredura está olhando', () => {
    // Sem esta asserção, apagar a pasta deixaria a varredura verde por vacuidade.
    const nomes = arquivos.map(relativo);

    for (const spec of ['login', 'sala', 'chamado', 'chat', 'compatibilidade']) {
      expect(nomes).toContain(`tests/e2e/${spec}.spec.js`);
    }
  });

  it('não tem uma espera cega (AC-TEST-09)', () => {
    const { ok, problemas } = varrer();

    // A mensagem faz parte do teste: `expect(problemas).toEqual([])` mostra o
    // arquivo, a linha e o motivo de cada um, que é o que serve para corrigir.
    expect(problemas).toEqual([]);
    expect(ok).toBe(true);
  });

  it('cada exceção nomeada continua sendo exercida pelo arquivo que a pediu', () => {
    // Uma exceção que sobrevive ao motivo é uma licença permanente. As duas que
    // existem são verificadas pela varredura, e esta asserção garante que as duas
    // ainda apontam para arquivos que existem.
    for (const { arquivo } of EXCECOES) {
      expect(arquivos.map(relativo)).toContain(arquivo);
    }
  });
});
