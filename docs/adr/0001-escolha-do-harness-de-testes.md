# ADR 0001 — Harness de testes: Jest do react-scripts, RTL e emuladores

- **Status:** aceito
- **Data:** 2026-09-20
- **Versão:** 0.2.0
- **Critérios:** AC-TEST-01, AC-TEST-03, AC-TEST-04, AC-TEST-05, AC-TEST-09

## Contexto

A v0.1.0 chegou a rodar em sala sem um único teste. Toda mudança era uma aposta, e o roadmap
até a 1.0.0 prevê nove tasks que mexem em autenticação, em ordenação de fila e em escopo de
dados — exatamente as partes onde um erro silencioso só aparece com a turma na frente da tela.

Antes de mudar qualquer comportamento, era preciso uma rede: uma suíte que descrevesse o que o
sistema faz hoje, **incluindo o que ele faz de errado**, para que as tasks seguintes mudassem
esse comportamento de forma deliberada em vez de acidental.

A decisão a tomar era qual ferramental sustenta essa rede, num projeto Create React App com
Firebase como back-end inteiro.

## Decisão

Quatro peças:

1. **Jest do `react-scripts`**, sem ejetar, exposto por `npm run test:ci`
   (`CI=true react-scripts test --watchAll=false --coverage`). Limiares de cobertura em
   `package.json`: 80% de linhas e 75% de branches, globais.
2. **React Testing Library** com `@testing-library/jest-dom`, testando por papel e por texto
   visível sempre que a interface expõe um.
3. **Fakes em memória do SDK do Firebase** em `src/__mocks__/firebase/`, para a suíte unitária:
   `firestore`, `auth`, `app` e `storage`.
4. **Firebase Emulator Suite** para o que fake nenhum consegue provar — as Security Rules —,
   com `@firebase/rules-unit-testing` e um Jest separado (`jest.rules.config.js`).

Testes determinísticos por construção: o relógio é mockado por `src/test-utils/relogio.js`, e
nenhum teste dorme esperando alguma coisa acontecer (AC-TEST-09).

## Alternativas consideradas

**Vitest.** Mais rápido e com API melhor. Descartado: trocar o runner exigiria ejetar do
`react-scripts` ou adicionar uma camada de build paralela, e essa é uma mudança de
infraestrutura grande para fazer _antes_ de existir qualquer teste que prove que nada quebrou.
Vale reavaliar quando o projeto sair do Create React App — o custo da troca cai muito depois que
a suíte existe, porque aí ela mesma valida a migração.

**Ejetar do `react-scripts`** para configurar Jest livremente. Descartado pelo mesmo motivo,
com um agravante: ejetar é irreversível e despeja centenas de linhas de config no repositório,
que passam a ser manutenção nossa.

**Só emulador, sem fakes.** Descartado por custo de tempo. Cada teste de componente passaria a
depender de um processo Java externo; a suíte unitária, que hoje roda em 8 segundos, levaria
minutos, e o AC-TEST-08 (5 minutos no CI) ficaria apertado. Emulador é para o que ele é
insubstituível: rules.

**Só fakes, sem emulador.** Descartado por não provar nada sobre segurança. Um fake responde o
que programamos para ele responder; as Security Rules são avaliadas por um motor do Google, e a
única forma honesta de testá-las é rodá-las nesse motor.

## Consequências

**Boas**

- A suíte unitária roda em segundos, então é rodada de verdade, e não só no CI.
- As rules ganham um baseline executável: o estado inseguro de hoje está documentado em testes
  que passam. Quando a task 03 endurecer, esses testes invertem de `assertSucceeds` para
  `assertFails`, e é essa inversão que comprova a correção.
- O limiar de cobertura quebra o build, então cobertura deixa de ser um número que ninguém lê.

**Ruins, e aceitas**

- Dois arquivos de configuração do Jest, com a regra de nunca misturá-los: os mocks manuais de
  `src/__mocks__/` sequestrariam o SDK real que o emulador precisa.
- `npm run test:rules` depende de Java instalado, o que é mais um pré-requisito na máquina de
  quem desenvolve e mais um passo no CI.
- O ambiente `node` do Jest 27 não expõe `fetch` nem os web streams, então
  `tests/rules/setup.js` precisa de um polyfill via `undici`. É dívida que some sozinha quando o
  projeto chegar a um Jest mais novo.
- Fakes precisam acompanhar o SDK. Se o `firebase` subir de major, eles mentem até serem
  atualizados — e mentem em silêncio, que é o pior modo de falhar.
