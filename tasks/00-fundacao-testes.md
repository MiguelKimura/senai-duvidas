---
id: 00-fundacao-testes
titulo: "Fundação: harness de testes, emuladores, lint, CI e branches"
versao_origem: 0.1.0
versao_alvo: 0.2.0
tipo: chore
escopo_commit: infra
branch: "chore/fundacao-testes"
branch_base: "dev"
depende_de: []
bloqueia: [01, 02, 03, 04, 05, 06, 07, 08, 09]
criterios: [AC-TEST-01, AC-TEST-03, AC-TEST-04, AC-TEST-05, AC-TEST-07, AC-TEST-08, AC-TEST-09, AC-CI-01, AC-CI-02, AC-CI-03, AC-CI-04, AC-CI-05, AC-CI-06, AC-CI-09, AC-CI-10, AC-DOC-01, AC-DOC-06, AC-ANIM-09, AC-AUTH-10]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: medio
observacao: "Única task autorizada a criar infraestrutura antes de existir teste. Refatoração de comportamento é PROIBIDA aqui."
---

# Você é o engenheiro responsável pela task 00 — Fundação de Testes e CI

Você está rodando uma sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**, um sistema
de gestão de dúvidas usado por **alunos e professores do SENAI** durante as aulas em laboratório.
Não haverá nenhuma instrução adicional de usuário. Conduza a task do início ao fim e termine com
um Pull Request aberto.

## Primeiro passo obrigatório

Leia, na íntegra e antes de qualquer edição:

1. `tasks/_PROTOCOLO.md` — o laço red-green-refactor, o formato do PR, as regras de
   compatibilidade e as restrições de produção. **Tudo ali vale para você.**
2. `docs/CRITERIOS-DE-ACEITE.md` — a lista completa de critérios.
3. `docs/ROADMAP.md` — onde esta task se encaixa.
4. Todo o `src/` — você precisa conhecer o código atual em detalhe.

## Contexto do estado atual

O projeto é um Create React App (React 18, react-router-dom 6, Firebase 11, styled-components)
com esta estrutura:

```
src/
  App.js              -> roteamento + lógica de auth duplicada (Google/GitHub já esboçados)
  AuthContext.js      -> um segundo AuthContext, NÃO usado por ninguém
  firebase.js         -> config hard-coded, helpers de auth, uploadImage, listener solto
  components/
    Login.js          -> e-mail/senha; onAuthStateChanged próprio; navega por usuario.tipo
    Cadastro.js       -> cria usuário; valida professor via utils/permissoes
    TelaAluno.js      -> onSnapshot em TODA a coleção "chamados"; cria chamado; exclui o próprio
    TelaProfessor.js  -> onSnapshot em TODA a coleção "chamados"; exclui qualquer um
    Chat.js           -> onSnapshot em TODA a coleção "chat"; comando !clear sem restrição
    Modal.js          -> descrição + URL de imagem
    Footer.js
  utils/permissoes.js -> lê autorizados/{email}.Tipo
  styles/*.css
```

Problemas conhecidos que você **não** vai corrigir nesta task (eles são o escopo das tasks 01 a 09),
mas que precisa **fixar em testes de caracterização** para que as próximas tasks tenham rede de
segurança:

- Papel do usuário vem do `localStorage` (falha de segurança).
- `horario` é `new Date().toISOString()` do relógio do cliente.
- Coleções `chamados` e `chat` são globais, sem escopo de sala.
- `!clear` apaga o chat inteiro para qualquer usuário.
- Config do Firebase está hard-coded no fonte.

## O que você vai entregar

### 1. Harness de teste unitário
- Configure o Jest do `react-scripts` para rodar em CI: script `test:ci` com
  `CI=true react-scripts test --watchAll=false --coverage`.
- `src/setupTests.js` com `@testing-library/jest-dom`.
- Thresholds de cobertura no `package.json` (`jest.coverageThreshold`): **80% de linhas,
  75% de branches**, globais. O build precisa quebrar abaixo disso.
- Helpers de teste em `src/test-utils/`: `renderComProvedores()`, fábricas de dados
  (`fabricaChamado`, `fabricaUsuario`, `fabricaMensagem`) e mock de relógio determinístico.
- Mocks de Firebase em `src/__mocks__/` para os testes unitários (os de integração usam emulador).

### 2. Firebase Emulator Suite
- `firebase.json` com emuladores de **auth, firestore e storage** em portas fixas.
- `firestore.rules` e `storage.rules` versionados. Nesta task, escreva a versão **mínima que
  reproduz o comportamento atual** e um teste de rules que documente o estado inseguro de hoje
  (marcado com `// TODO(task-03): endurecer`). Não endureça as rules aqui — isso quebraria a
  aplicação antes das tasks que a adaptam.
- `@firebase/rules-unit-testing` como devDependency; script `test:rules`.
- Script `emulators` para subir a suíte localmente.
- Os testes de integração **nunca** podem tocar o projeto de produção `senai-duvidas`. Use um
  `projectId` de teste (ex.: `demo-senai-duvidas`) e garanta por asserção no setup.

### 3. Testes de caracterização (a entrega mais importante)
Escreva testes que **capturam o comportamento atual**, incluindo o que está errado. Eles são o
contrato que as próximas tasks vão mudar de forma consciente. Cobertura mínima:

| Fluxo | O que fixar |
|---|---|
| Login e-mail/senha | credencial válida → redireciona por `usuario.tipo`; inválida → mensagem de erro |
| Cadastro | aluno cria documento em `usuarios/{uid}`; professor não autorizado é barrado |
| Lista de chamados | renderiza cards ordenados por horário crescente |
| Criar chamado | descrição vazia não cria; com descrição cria com `nome`, `email`, `cor`, `horario` |
| Excluir chamado | botão Excluir só aparece para o autor (AC-CHAMADO-04, AC-CHAMADO-05) |
| Anexo por URL | card exibe o ícone de visualização quando há `imagem` |
| Chat | envia mensagem, renderiza lista, cor por e-mail é estável |
| Tela do professor | lista todos os chamados e permite excluir qualquer um |

Cada um desses vira também um teste de regressão permanente dos ACs marcados **[REG]**
(AC-CHAMADO-01/02/03/04/07, AC-IMG-01, AC-AUTH-01/02, AC-COR-05).

### 4. Lint e formatação
- ESLint com `react-app` + regras de acessibilidade (`jsx-a11y`) e Prettier.
- Script `lint` com `--max-warnings=0`.
- Corrija apenas violações **mecânicas** (imports não usados, `let` que devia ser `const`).
  Se uma regra exigir mudança de comportamento, desative-a com comentário `// TODO(task-NN)`
  apontando a task que vai resolver.

### 5. CI no GitHub Actions
Existe uma referência pronta em `docs/exemplos/ci.yml` — adote-a como base em
`.github/workflows/ci.yml`, ajustando o que for necessário. Disparado em `push` e
`pull_request` para `main` e `dev`:

```
jobs: lint -> test:ci -> test:rules (com emulador) -> build
```

- Node 20, `npm ci`, cache de dependências.
- Publicar o relatório de cobertura como artefato.
- A suíte completa precisa rodar em **menos de 5 minutos** (AC-TEST-08).
- Um job adicional valida que os commits do PR seguem Conventional Commits.

### 6. Branches e fluxo
- Garanta que existem as branches **`main`** e **`dev`**, com `dev` partindo de `main`.
- `CONTRIBUTING.md` documentando: `main` é o que os usuários veem, `dev` é integração, features
  saem de `dev` como `feat/…`, `fix/…`, `chore/…`, PR sempre contra `dev`, commits convencionais,
  como rodar os testes e os emuladores.
- `docs/PROTECAO-BRANCHES.md` com o passo a passo exato das configurações de proteção a aplicar no
  GitHub (PR obrigatório, CI verde obrigatório, sem push direto) — isso é configuração de UI, então
  documente com precisão em vez de tentar aplicar.
- `.github/pull_request_template.md` com o formato de PR do `tasks/_PROTOCOLO.md`.

### 7. Configuração e segredos
- Mova a config do Firebase para variáveis `REACT_APP_*`, lidas em `src/firebase.js`, com fallback
  para os valores atuais **e** um aviso em `console.warn` quando o fallback for usado (AC-AUTH-10).
- `.env.example` documentando cada variável.
- Confirme que nenhum arquivo de credencial está rastreado pelo git.

### 8. Tokens de design
`src/styles/tokens.css` com custom properties para cores, espaçamentos, raios, sombras e durações
de animação — extraídos dos CSS existentes, sem mudar nenhum valor visual. As tasks seguintes vão
consumir esses tokens. Importe-o em `src/index.css`.

### 9. Documentação
- Reescreva o `README.md`: o que é o projeto, para quem é, como instalar (`git clone`,
  `npm install`, `npm start`), todos os scripts, a arquitetura em alto nível, o fluxo de branches
  e um link para `docs/`.
- Crie `CHANGELOG.md` (Keep a Changelog) com `[0.2.0]` e uma entrada retroativa `[0.1.0]`
  descrevendo o protótipo.
- Crie `docs/HISTORICO.md` com a narrativa das versões 0.1.0 e 0.2.0: o que existia, que problemas
  isso trouxe e por que a fundação de testes veio antes de qualquer feature.
- Crie `docs/adr/0001-escolha-do-harness-de-testes.md` e
  `docs/adr/0002-estrategia-de-branches-main-dev.md`.

## Ordem de trabalho

Esta task é a exceção autorizada ao "teste antes de tudo": não há harness para escrever o primeiro
teste. Siga esta ordem:

1. Harness mínimo funcionando (Jest + RTL + um teste trivial que passa).
2. A partir daí, **todo** o resto segue red-green-refactor — inclusive os testes de caracterização:
   escreva o teste, veja-o falhar por ausência de configuração ou mock, ajuste, veja passar.
3. Emuladores e testes de rules.
4. Lint, CI, docs.

## Como saber que terminou

- `npm run lint` — 0 erros, 0 warnings.
- `npm run test:ci` — tudo verde, cobertura ≥ 80% linhas e ≥ 75% branches.
- `npm run test:rules` — verde no emulador.
- `npm run build` — sucesso.
- `npm ci && npm run build` funciona em diretório limpo (sem `node_modules`).
- O CI roda em menos de 5 minutos.
- Branches `main` e `dev` existem no remoto.
- **Nenhuma mudança de comportamento visível para o usuário.** Se a interface mudou, você saiu do
  escopo: reverta.

## Compatibilidade

- **Retroativa:** nenhuma alteração de modelo de dados nesta task. Prove por teste que a leitura de
  `chamados` e `chat` no formato atual continua idêntica.
- **Futura:** o fallback da config do Firebase garante que um build sem `.env` continua funcionando
  exatamente como hoje. Teste os dois caminhos — com e sem as variáveis definidas.

## Pull Request

Não abra o PR você mesmo — o orquestrador abre. Escreva o título em
`.automation/pr-title.txt` e o corpo em `.automation/pr-body.md`, no formato do
`tasks/_PROTOCOLO.md`. Título:

```
chore(infra): estabelece harness de testes, emuladores e pipeline de CI
```

**Versão:** 0.1.0 → 0.2.0 (MINOR — infraestrutura nova, sem quebra de contrato)
