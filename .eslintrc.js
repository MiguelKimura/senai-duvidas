// ESLint do projeto. `npm run lint` roda com `--max-warnings=0`: warning aqui
// reprova o CI igual a erro, porque warning que ninguém lê não existe.
//
// A regra desta task é estrita: corrigir só violação **mecânica** (import não
// usado, `let` que devia ser `const`). Toda regra que exigiria mudar o
// comportamento da aplicação fica desligada AQUI, com um `TODO(task-NN)`
// apontando quem resolve — nunca silenciada caso a caso no meio do código,
// onde ninguém mais acharia.
module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest', 'plugin:jsx-a11y/recommended', 'prettier'],
  plugins: ['jsx-a11y'],
  // `globalThis` é a forma padrão de alcançar `crypto` — a mesma expressão no
  // navegador, no jsdom e no Node. O preset `react-app` ainda declara o
  // ambiente de linguagem em ES6, de antes de ele existir (task 03).
  globals: { globalThis: 'readonly' },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'smart'],

    // Ligadas na v0.10.0 (AC-ANIM-10). Elas ficaram desligadas da task 00 à
    // 07 por um elemento só: o ícone 👁️ de "ver imagem" era uma <div> com
    // `onClick`, em TelaAluno e em TelaProfessor, e quem navegava por teclado
    // não alcançava o anexo. A task 04 trocou aquela <div> por um <button> ao
    // extrair `AnexoDoCard`; o que sobrou aqui foi o desligamento.
    //
    // Elas valem agora para impedir a **próxima** <div> clicável, que é o
    // caminho por onde esse defeito volta. O `src/components/Lightbox.jsx`
    // carrega a única exceção, silenciada na linha e explicada ali: o fundo
    // do diálogo fecha ao clique, e o teclado sai dele pelo Esc, que o
    // `useDialogoModal` trata.
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/no-static-element-interactions': 'error',
  },
  overrides: [
    {
      // Testes de caracterização.
      files: ['src/**/__tests__/**/*.js', 'src/**/*.test.js'],
      rules: {
        // Desligada por decisão, e não por dívida — o `TODO(task-NN)` que
        // estava aqui saiu na v0.10.0 porque não há task que o resolva.
        //
        // A regra existe para empurrar o teste a consultar por papel e por
        // rótulo, e essa parte já valeu: o que ela apontaria hoje são 132
        // ocorrências em 21 arquivos, e a maioria esmagadora delas **não**
        // tem consulta equivalente por papel:
        //
        //   * a sanitização do Markdown (`TextoMarkdown.test.js`) afirma
        //     sobre `innerHTML`, porque o que ela prova é que o `<script>`
        //     não virou nó — ler por papel leria o DOM já saneado e passaria
        //     mesmo quebrado;
        //   * o foco preso dos diálogos compara `document.activeElement`,
        //     que é a definição de "onde o foco está";
        //   * as asserções de cor e de classe (`corDeFundo`, o escalonamento
        //     dos cards) olham para o nó porque estilo não tem papel.
        //
        // Deixá-la ligada obrigaria a um `eslint-disable` por linha em cada
        // um desses casos, que é exatamente o que o cabeçalho deste arquivo
        // proíbe. O que garante a acessibilidade da interface não é esta
        // regra: são as três do `jsx-a11y` acima e a varredura do `jest-axe`
        // em `src/__tests__/acessibilidade.test.js`.
        'testing-library/no-node-access': 'off',
      },
    },
    {
      // Ferramentas de linha de comando: rodam em Node, fora do bundle.
      files: ['scripts/**/*.js'],
      env: { jest: true, node: true, es2021: true },
    },
    {
      // Testes de Security Rules: rodam em Node contra o emulador, fora do
      // bundle do React.
      files: ['tests/**/*.js'],
      // `es2021` é o que declara `globalThis`, usado pelo polyfill de `fetch`
      // em `tests/rules/setup.js`.
      env: { jest: true, node: true, es2021: true },
      rules: {
        'no-undef': 'error',
      },
    },
  ],
};
