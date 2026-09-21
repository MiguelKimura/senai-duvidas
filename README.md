# Projeto Dúvidas SENAI

Sistema de gestão de dúvidas para as aulas de laboratório do SENAI.

Em vez de levantar a mão e esperar, o aluno abre um **chamado** descrevendo o problema — com
anexo de imagem, se ajudar a explicar. O chamado entra numa fila que o professor vê em tempo
real, na ordem de chegada, e ele atende sem precisar varrer a sala com os olhos. Há também um
chat da turma para as dúvidas que se resolvem com uma frase.

**Para quem é:** alunos e professores do SENAI, em laboratório, durante a aula. Máquinas
compartilhadas, relógios de sistema frequentemente errados, rede instável. Toda decisão técnica
deste repositório assume esse cenário — e assume que uma falha em produção interrompe uma turma
inteira.

**Versão atual:** 0.5.0 · [CHANGELOG](CHANGELOG.md) · [Histórico e decisões](docs/HISTORICO.md)

---

## Como rodar

Três comandos:

```bash
git clone https://github.com/MiguelKimura/senai-duvidas.git
cd senai-duvidas
npm install
npm start
```

O app sobe em <http://localhost:3000>.

Sem `.env`, a aplicação usa a configuração do Firebase embutida no código e **avisa no
console** quais variáveis faltaram. Isso funciona, mas aponta para o projeto de produção. Para
apontar para outro projeto, copie o modelo e preencha:

```bash
cp .env.example .env
```

Cada variável está documentada em [`.env.example`](.env.example). Nenhum segredo de verdade vive
no repositório: as chaves do cliente Firebase são públicas por natureza (o bundle as expõe), e
quem protege os dados são as Security Rules em `firestore.rules` e `storage.rules`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento na porta 3000 |
| `npm run build` | Build de produção em `build/` |
| `npm test` | Testes unitários em modo watch |
| `npm run test:ci` | Testes uma vez, sem watch, com cobertura — **é o que vale no CI** |
| `npm run test:rules` | Testes das Security Rules; sobe o emulador, roda e desliga |
| `npm run emulators` | Sobe o Firebase Emulator Suite para uso manual (UI em <http://localhost:4000>) |
| `npm run lint` | ESLint com `--max-warnings=0` |
| `npm run format` | Prettier em tudo que é versionado |
| `npm run changelog -- <base>..<head>` | Gera a seção do CHANGELOG a partir dos commits |

`npm run test:rules` e `npm run emulators` precisam de **Java 11 ou superior** instalado: os
emuladores de Firestore e Storage são aplicações Java. O resto precisa só de **Node 20**.

## Arquitetura

Create React App (React 18) com Firebase como back-end inteiro. Não há servidor próprio: o
navegador fala direto com o Firestore, e é por isso que as Security Rules não são um detalhe de
configuração, e sim a camada de autorização do sistema.

```
src/
  App.js              roteamento (react-router-dom 6) e resolução de papel
  AuthContext.js      segundo contexto de autenticação, hoje sem nenhum consumidor
  firebase.js         inicialização do SDK, config por REACT_APP_*, helpers de auth e upload
  components/
    Login.js          entrada por e-mail e senha
    Cadastro.js       criação de conta; consulta `autorizados` para liberar professor
    TelaAluno.js      fila de chamados, criação por modal, exclusão do próprio
    TelaProfessor.js  fila de chamados com exclusão de qualquer um
    Chat.js           chat da turma
    Modal.js          formulário de novo chamado
    Footer.js
  utils/permissoes.js leitura de `autorizados/{email}.Tipo`
  styles/             CSS por componente
  styles/tokens.css   fonte única de cores, espaçamentos, raios, sombras e durações
  test-utils/         fábricas de dados, relógio determinístico, render com provedores
  __mocks__/firebase/ fakes em memória do SDK, usados pela suíte unitária
tests/rules/          testes de Security Rules contra o emulador
scripts/              ferramentas de linha de comando (gerador de changelog)
```

**Coleções do Firestore**

| Coleção | O que guarda |
|---|---|
| `usuarios/{uid}` | `nome`, `email`, `tipo` (`aluno` ou `professor`) |
| `autorizados/{email}` | `Tipo` — a lista, mantida à mão no console, de quem pode ser professor |
| `chamados/{id}` | `nome`, `email`, `descricao`, `horario`, `cor`, `imagem` |
| `chat/{id}` | `nome`, `email`, `texto`, `horario` |

### Estado desta versão

A 0.2.0 é uma fundação de testes, não uma versão de funcionalidades. Os problemas conhecidos da
0.1.0 **continuam todos lá** — de propósito. Cada um está fixado em um teste de caracterização,
que descreve o comportamento atual *incluindo o que está errado*, para que a task que for
corrigi-lo mude o teste de forma explícita em vez de mudar o sistema por acidente.

A lista completa, com a task responsável por cada item, está no [CHANGELOG](CHANGELOG.md) sob a
seção `[0.1.0]`, e narrada em [`docs/HISTORICO.md`](docs/HISTORICO.md).

## Testes

| Suíte | Onde | Contra o quê roda |
|---|---|---|
| Unitários e de componente | `src/**/__tests__/` | jsdom, com fakes do Firebase em `src/__mocks__/` |
| Security Rules | `tests/rules/` | Firebase Emulator Suite, projeto `demo-senai-duvidas` |

Cobertura mínima exigida: **80% de linhas e 75% de branches**, globais. O limiar vive em
`package.json` e faz `npm run test:ci` sair diferente de zero quando a cobertura cai — limiar
que não morde não é limiar.

Os testes de integração nunca tocam o projeto de produção: `tests/rules/projetoDeTeste.js` recusa
qualquer `projectId` que não comece com `demo-` (prefixo que faz o SDK do Firebase se recusar a
sair para a rede) e exige que haja um emulador rodando.

## Branches e contribuição

`main` é o que os usuários veem. `dev` é integração. Trabalho novo sai de `dev` como
`feat/…`, `fix/…` ou `chore/…`, e volta por Pull Request contra `dev`, com CI verde.

O passo a passo completo — commits convencionais, ciclo red-green-refactor, como rodar os
emuladores — está em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentação

| Documento | O que é |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Fluxo de branches, padrão de commits, como rodar tudo |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou em cada versão (gerado dos commits) |
| [`docs/HISTORICO.md`](docs/HISTORICO.md) | A memória do projeto: por que cada decisão foi tomada |
| [`docs/CRITERIOS-DE-ACEITE.md`](docs/CRITERIOS-DE-ACEITE.md) | Todos os critérios, com ID estável e prioridade |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | O caminho da 0.1.0 até a 1.0.0, versão por versão |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | O modelo de dados por sala, o fluxo do PIN e o custo de leitura |
| [`docs/MIGRACOES.md`](docs/MIGRACOES.md) | Como rodar e como reverter cada migração de dados |
| [`docs/BLOQUEIOS.md`](docs/BLOQUEIOS.md) | Limites técnicos conhecidos, com causa e proposta |
| [`docs/adr/`](docs/adr/) | Decisões arquiteturais, uma por arquivo |
| [`docs/PROTECAO-BRANCHES.md`](docs/PROTECAO-BRANCHES.md) | Configuração de proteção a aplicar no GitHub |
| [`docs/AUTOMACAO.md`](docs/AUTOMACAO.md) | A fila automatizada que executa as tasks |
| [`docs/COMO-RODAR-AS-TASKS.md`](docs/COMO-RODAR-AS-TASKS.md) | Como executar as tasks do roadmap |
| [`tasks/`](tasks/) | Uma task por versão, cada uma pronta para rodar como sessão one-shot |
