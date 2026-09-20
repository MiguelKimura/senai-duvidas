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
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'smart'],

    // TODO(task-08): o ícone 👁️ de "ver imagem" é uma <div> com onClick, em
    // TelaAluno e TelaProfessor. Quem navega por teclado não alcança o anexo.
    // Corrigir é trocar por <button> e tratar Enter/Espaço — mudança de
    // marcação e de comportamento, que é exatamente o escopo do AC-ANIM-09.
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
  },
  overrides: [
    {
      // Testes de caracterização.
      files: ['src/**/__tests__/**/*.js', 'src/**/*.test.js'],
      rules: {
        // TODO(task-08): os testes alcançam card, balão de fala e botão do chat
        // por `document.querySelector`, e não por papel ou rótulo, porque hoje
        // esses elementos não expõem nenhum: são <div> sem role e o botão do
        // chat não tem nome acessível. Quando o AC-ANIM-09 der semântica à
        // interface, estas consultas viram `getByRole` e a regra volta a valer.
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
