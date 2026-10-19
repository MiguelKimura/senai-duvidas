// O ciclo red-green-refactor comprovado no histórico — AC-TEST-02.
//
// O critério é literal: "ciclo red-green-refactor **comprovado no histórico de
// commits**". Nada lia o histórico. O `tasks/_PROTOCOLO.md` pede um commit por
// ciclo, o CI valida o formato das mensagens desde a task 00 — e a ordem entre
// elas, que é onde o ciclo aparece, não era verificada por ninguém.
//
// A regra está em `scripts/verificarCicloTdd.js`, e este arquivo cobre as duas
// metades dela:
//
//   * **a regra em si**, contra históricos sintéticos. É aqui que se prova que
//     ela reprova: o commit gigante no fim, a implementação sem teste antes, a
//     branch sem teste nenhum. Um verificador que só diz "sim" não verifica.
//   * **o pipeline**, que é quem tem o histórico. Este teste roda no job `test`,
//     cujo checkout é raso: `git log origin/dev..HEAD` ali não enxerga a branch
//     inteira. Quem tem `fetch-depth: 0` é o job `commits`, e é nele que a
//     verificação precisa estar pendurada — então o que se afirma aqui é que ela
//     está.
//
// O limite da regra, dito sem rodeio: ela não sabe se o commit `test` realmente
// falhava antes da implementação. Nenhuma leitura de histórico sabe. Ela é o piso
// — pega o commit único no fim e a implementação sem teste —, e a revisão humana
// continua sendo o que confirma que o vermelho era vermelho.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  classificar,
  relatorio,
  verificarOrdem,
} = require('../../scripts/verificarCicloTdd');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_CI = path.join(RAIZ, '.github', 'workflows', 'ci.yml');

/** Um histórico que segue o protocolo: teste, código, refatoração. */
const CICLO_LIMPO = [
  'test(chamado): exige a descrição de 1 a 1000 caracteres no cliente',
  'feat(chamado): recusa a descrição fora de 1 a 1000 caracteres no modal',
  'refactor(chamado): tira a regra da descrição de dentro da tela do aluno',
];

describe('a leitura de um assunto de commit', () => {
  it('reparte tipo, escopo e resumo', () => {
    expect(classificar('feat(salas): adiciona a entrada por PIN')).toEqual({
      tipo: 'feat',
      escopo: 'salas',
      resumo: 'adiciona a entrada por PIN',
      assunto: 'feat(salas): adiciona a entrada por PIN',
    });
  });

  it('aceita commit sem escopo e commit com quebra', () => {
    expect(classificar('docs: reescreve o README').tipo).toBe('docs');
    expect(classificar('feat(dados)!: renomeia horario').tipo).toBe('feat');
  });

  it('marca como fora do padrão o que não é Conventional Commits', () => {
    expect(classificar('arrumei umas coisas').tipo).toBeNull();
  });
});

describe('a regra do ciclo', () => {
  it('aprova teste → código → refatoração', () => {
    const resultado = verificarOrdem(CICLO_LIMPO);

    expect(resultado.ok).toBe(true);
    expect(resultado.ciclos).toBe(1);
    expect(resultado.implementacoes).toBe(1);
  });

  it('aprova vários ciclos em sequência', () => {
    const resultado = verificarOrdem([...CICLO_LIMPO, 'test(sec): varre XSS', 'fix(sec): sanitiza']);

    expect(resultado.ok).toBe(true);
    expect(resultado.ciclos).toBe(2);
  });

  it('reprova a implementação que entra sem teste antes', () => {
    const resultado = verificarOrdem(['feat(salas): adiciona a entrada por PIN']);

    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(' ')).toMatch(/o começo da branch/);
  });

  it('reprova o commit único no fim, com código e teste juntos', () => {
    // O desfecho que o protocolo chama de reprovação da task: um commit só, que
    // não mostra ciclo nenhum. Como ele é `feat`, não há teste antes dele.
    const resultado = verificarOrdem(['feat(salas): salas do professor com testes']);

    expect(resultado.ok).toBe(false);
  });

  it('reprova a branch sem commit de teste nenhum', () => {
    const resultado = verificarOrdem(['docs(readme): reescreve', 'chore: sobe versão']);

    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(' ')).toMatch(/nenhum commit de teste/);
  });

  it('reprova a segunda implementação empilhada na primeira', () => {
    // test → feat → feat: o segundo `feat` não tem vermelho próprio. É o jeito
    // mais comum de o ciclo se desfazer sem ninguém notar.
    const resultado = verificarOrdem([
      'test(chamado): exige a descrição',
      'feat(chamado): valida a descrição',
      'feat(chamado): valida também o anexo',
    ]);

    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(' ')).toMatch(/valida também o anexo/);
  });

  it('deixa docs, chore, ci, style e build passarem no meio do ciclo', () => {
    // Eles não mudam comportamento; barrá-los obrigaria a mexer na documentação
    // só antes ou só depois de um ciclo, o que é regra sem motivo.
    for (const neutro of ['docs(perf): registra a conta', 'chore: limpa', 'ci: ajusta o job']) {
      const resultado = verificarOrdem(['test(perf): exige o orçamento', neutro, 'perf(bundle): divide as rotas']);

      expect(resultado.ok).toBe(true);
      expect(resultado.ciclos).toBe(1);
    }
  });

  it('NÃO deixa um refactor separar o teste da implementação', () => {
    // `refactor` fecha um ciclo. O que vem depois dele é outro ciclo, e precisa
    // do próprio vermelho.
    const resultado = verificarOrdem([
      'test(chamado): exige a descrição',
      'refactor(chamado): extrai a validação',
      'feat(chamado): valida a descrição',
    ]);

    expect(resultado.ok).toBe(false);
  });

  it('reprova a mensagem fora do padrão, onde a ordem nem dá para ler', () => {
    const resultado = verificarOrdem(['test(x): algo', 'arrumei umas coisas']);

    expect(resultado.ok).toBe(false);
    expect(resultado.problemas.join(' ')).toMatch(/fora do padrão/);
  });

  it('o relatório conta os ciclos e nomeia o commit problemático', () => {
    const texto = relatorio(verificarOrdem(['feat(x): sem teste antes']), 'origin/dev..HEAD');

    expect(texto).toContain('AC-TEST-02');
    expect(texto).toContain('origin/dev..HEAD');
    expect(texto).toContain('sem teste antes');
  });
});

describe('o pipeline verifica o histórico de verdade', () => {
  const lerCi = () => yaml.safeLoad(fs.readFileSync(CAMINHO_CI, 'utf8'));

  it('o job que já tem o histórico completo é quem roda a verificação', () => {
    // `commits` é o único job com `fetch-depth: 0` e com o `git fetch` da branch
    // base. Pendurar a verificação em qualquer outro job seria rodá-la num
    // clone raso, onde ela não enxerga a branch e passaria por falta de dado.
    const { commits } = lerCi().jobs;
    const passos = commits.steps.map((passo) => passo.run).filter(Boolean).join('\n');

    expect(commits.steps[0].with['fetch-depth']).toBe(0);
    expect(passos).toContain('verificarCicloTdd.js');
  });

  it('a verificação roda contra a branch base do PR, e não contra um intervalo fixo', () => {
    const passos = lerCi()
      .jobs.commits.steps.map((passo) => passo.run)
      .filter(Boolean)
      .join('\n');

    expect(passos).toMatch(/verificarCicloTdd\.js\s+"?origin\/\$(?:\{)?GITHUB_BASE_REF/);
  });
});
