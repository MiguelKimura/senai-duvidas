# Projeto Dúvidas SENAI

Sistema de gestão de dúvidas para as aulas de laboratório do SENAI.

Em vez de levantar a mão e esperar, o aluno abre um **chamado** descrevendo o problema — com
anexo de imagem, se ajudar a explicar. O chamado entra numa fila que o professor vê em tempo
real, na ordem de chegada, e ele atende sem precisar varrer a sala com os olhos. Há também um
chat da turma para as dúvidas que se resolvem com uma frase, e conversa direta para o que não
é da turma.

**Para quem é:** alunos e professores do SENAI, em laboratório, durante a aula. Máquinas
compartilhadas, relógios de sistema frequentemente errados, rede instável. Toda decisão técnica
deste repositório assume esse cenário — e assume que uma falha em produção interrompe uma turma
inteira.

**Versão atual:** 1.0.0 · [CHANGELOG](CHANGELOG.md) · [Histórico e decisões](docs/HISTORICO.md)

---

## Como é, por dentro

| Aluno | Professor |
|---|---|
| ![Fila da sala vista pelo aluno, com os cards coloridos das dúvidas abertas](docs/imagens/aluno-fila-da-sala.png) | ![Tela do professor, com o painel da turma, a fila de chamados e o painel de premiações](docs/imagens/professor-fila-da-sala.png) |
| Entra com um PIN de seis dígitos, abre a dúvida com print e cor, e exclui a própria quando resolve | Cria a sala, distribui o PIN, acompanha a fila em tempo real, marca como atendido e modera o chat |

O passo a passo completo está nos dois manuais:
[**do aluno**](docs/MANUAL-ALUNO.md) e [**do professor**](docs/MANUAL-PROFESSOR.md).

## Como rodar

Três comandos:

```bash
git clone https://github.com/MiguelKimura/senai-duvidas.git
cd senai-duvidas
npm install
npm start
```

O app sobe em <http://localhost:3000>. Não há passo manual escondido: sem `.env`, a aplicação
usa a configuração do Firebase embutida no código e **avisa no console** quais variáveis
faltaram. Isso funciona, mas aponta para o projeto de produção. Para apontar para outro
projeto, copie o modelo e preencha:

```bash
cp .env.example .env
```

Cada variável está documentada em [`.env.example`](.env.example). Nenhum segredo de verdade vive
no repositório: as chaves do cliente Firebase são públicas por natureza (o bundle as expõe), e
quem protege os dados são as Security Rules em `firestore.rules` e `storage.rules`. O detalhe
está em [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

**Requisitos:** Node 20. Os scripts que sobem emuladores (`test:rules`, `test:e2e`,
`emulators`, `capturas`) precisam também de **Java 11 ou superior** — os emuladores de
Firestore e Storage são aplicações Java.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento na porta 3000 |
| `npm run build` | Build de produção em `build/` |
| `npm test` | Testes unitários em modo watch |
| `npm run test:ci` | Testes uma vez, sem watch, com cobertura — **é o que vale no CI** |
| `npm run test:fusos` | A suíte inteira em `UTC` e em `America/New_York`, contra regressão de fuso |
| `npm run test:rules` | Testes das Security Rules; sobe o emulador, roda e desliga |
| `npm run test:e2e` | Playwright: os fluxos críticos num navegador de verdade, contra o Emulator Suite |
| `npm run build:e2e` | O build que a suíte e2e serve, ligado ao Emulator Suite |
| `npm run emulators` | Sobe o Firebase Emulator Suite para uso manual (UI em <http://localhost:4000>) |
| `npm run lint` | ESLint com `--max-warnings=0` |
| `npm run format` | Prettier em tudo que é versionado |
| `npm run orcamento` | Mede o bundle inicial e reprova se passar de 300 KB gzip |
| `npm run orcamento:suite` | Soma o tempo das três suítes e reprova se passar de 5 minutos |
| `npm run changelog -- <base>..<head>` | Gera a seção do CHANGELOG a partir dos commits |
| `npm run capturas` | Refaz as capturas de tela dos manuais a partir do emulador |

Antes de abrir um PR, os quatro que o CI cobra:

```bash
npm run lint && npm run test:ci && npm run test:rules && npm run build
```

## Arquitetura

Create React App (React 18) com Firebase como back-end inteiro. Não há servidor próprio: o
navegador fala direto com o Firestore, e é por isso que as Security Rules não são um detalhe de
configuração, e sim **a camada de autorização do sistema**. A tela nunca é a autorização —
esconder um botão é conforto de interface.

```
src/
  App.js              roteamento (react-router-dom 6); cada tela entra por React.lazy
  firebase.js         inicialização do SDK, config por REACT_APP_*
  components/         telas e peças de interface (chat/ e perks/ em subpastas)
  services/           a regra de negócio: salas, pin, chamados, chat, perks, anexos, tempo
  utils/              markdown sanitizado, paleta, permissões, HTTPS obrigatório
  hooks/              comportamento compartilhado (diálogo modal, exclusão com desfazer)
  styles/             CSS por componente; tokens.css é a fonte única de cor e duração
  test-utils/         fábricas de dados, relógio determinístico, render com provedores
  __mocks__/firebase/ fakes em memória do SDK, usados pela suíte unitária
tests/rules/          Security Rules contra o emulador
tests/e2e/            Playwright: os fluxos críticos em navegador
scripts/              changelog, orçamentos, migrações de dados, capturas dos manuais
```

**As coleções** vivem todas sob `salas/{salaId}` — chamados, chat, membros, conversas diretas,
premiações e o log de auditoria. O modelo completo, com os campos de cada uma e os diagramas de
fluxo, está em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

As coleções globais `chamados` e `chat` são o banco da v0.1.0. Elas continuam legíveis de
propósito: é o fallback que faz um documento antigo continuar aparecendo na tela.

## Testes

| Suíte | Onde | Contra o quê roda |
|---|---|---|
| Unitários e de componente | `src/**/__tests__/`, `scripts/__tests__/` | jsdom, com fakes do Firebase em `src/__mocks__/` |
| Security Rules | `tests/rules/` | Firebase Emulator Suite, projeto `demo-senai-duvidas` |
| End-to-end | `tests/e2e/` | Chromium sobre o build de produção + Emulator Suite |

Cobertura mínima exigida: **80% de linhas e 75% de branches**, globais. O limiar vive em
`package.json` e faz `npm run test:ci` sair diferente de zero quando a cobertura cai — limiar
que não morde não é limiar. A suíte inteira, somadas as três, cabe em **menos de 5 minutos**, e
isso também é verificado.

Os testes de integração nunca tocam o projeto de produção: `tests/rules/projetoDeTeste.js` recusa
qualquer `projectId` que não comece com `demo-` (prefixo que faz o SDK do Firebase se recusar a
sair para a rede) e exige que haja um emulador rodando.

## Branches e contribuição

`main` é o que os usuários veem. `dev` é integração. Trabalho novo sai de `dev` como
`feat/…`, `fix/…` ou `chore/…`, e volta por Pull Request contra `dev`, com CI verde.

Todo código de produção entra depois de um teste que falhou por ele. O passo a passo completo —
commits convencionais, ciclo red-green-refactor, como rodar os emuladores — está em
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentação

**Para quem usa o sistema**

| Documento | O que é |
|---|---|
| [`docs/MANUAL-ALUNO.md`](docs/MANUAL-ALUNO.md) | Entrar, usar o PIN, abrir dúvida, anexar print, conversar, excluir |
| [`docs/MANUAL-PROFESSOR.md`](docs/MANUAL-PROFESSOR.md) | Criar sala, distribuir o PIN, acompanhar a fila, moderar, premiar, arquivar |

**Para quem desenvolve**

| Documento | O que é |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Fluxo de branches, padrão de commits, como rodar tudo |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou em cada versão (gerado dos commits) |
| [`docs/HISTORICO.md`](docs/HISTORICO.md) | A memória do projeto: por que cada decisão foi tomada, da 0.1.0 à 1.0.0 |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Modelo de dados, diagramas de fluxo, rules e custo de leitura |
| [`docs/SEGURANCA.md`](docs/SEGURANCA.md) | Modelo de ameaça, auditoria das rules, resposta a incidente |
| [`docs/RELEASE.md`](docs/RELEASE.md) | Como publicar uma versão e como voltar atrás |
| [`docs/CRITERIOS-DE-ACEITE.md`](docs/CRITERIOS-DE-ACEITE.md) | Todos os critérios, com ID estável e prioridade |
| [`docs/AUDITORIA-1.0.0.md`](docs/AUDITORIA-1.0.0.md) | Cada critério [MVP] e o teste que o prova |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | O caminho da 0.1.0 até a 1.0.0, versão por versão |
| [`docs/MIGRACOES.md`](docs/MIGRACOES.md) | Como rodar e como reverter cada migração de dados |
| [`docs/BLOQUEIOS.md`](docs/BLOQUEIOS.md) | Limites técnicos conhecidos, com causa e proposta |
| [`docs/adr/`](docs/adr/) | Decisões arquiteturais, uma por arquivo |
| [`docs/DOMINIOS-AUTORIZADOS.md`](docs/DOMINIOS-AUTORIZADOS.md) | A configuração de domínios do Firebase Auth, a aplicar à mão |
| [`docs/PROTECAO-BRANCHES.md`](docs/PROTECAO-BRANCHES.md) | Configuração de proteção a aplicar no GitHub |
| [`docs/AUTOMACAO.md`](docs/AUTOMACAO.md) | A fila automatizada que executa as tasks |
| [`docs/COMO-RODAR-AS-TASKS.md`](docs/COMO-RODAR-AS-TASKS.md) | Como executar as tasks do roadmap |
| [`tasks/`](tasks/) | Uma task por versão, cada uma pronta para rodar como sessão one-shot |
