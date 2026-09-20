# Como contribuir

Este projeto roda em sala de aula. Um bug em produção não é um incidente: é uma turma parada
esperando o professor entender por que o sistema não abre. O processo abaixo existe por causa
disso, e não por formalidade.

## O básico

```bash
git clone https://github.com/MiguelKimura/senai-duvidas.git
cd senai-duvidas
npm install
npm start
```

Precisa de **Node 20**. Para os testes de Security Rules, precisa também de **Java 11+** — os
emuladores de Firestore e Storage são aplicações Java.

## Branches

| Branch | O que é | Quem vê |
|---|---|---|
| `main` | O que está no ar. Sempre estável, sempre deployável. | Alunos e professores |
| `dev` | Integração. Recebe tudo antes de ir para produção. | Só a equipe |

Trabalho novo **sai sempre de `dev`**:

```
feat/<escopo>      nova funcionalidade
fix/<escopo>       correção de bug
chore/<escopo>     infraestrutura, dependências, configuração
docs/<escopo>      só documentação
refactor/<escopo>  mudança interna, sem alterar comportamento
test/<escopo>      só testes
```

```bash
git checkout dev && git pull origin dev
git checkout -b feat/salas
```

O Pull Request é **sempre contra `dev`**. `main` recebe apenas PRs vindos de `dev`, no momento
do release. Nenhuma das duas aceita push direto — veja
[`docs/PROTECAO-BRANCHES.md`](docs/PROTECAO-BRANCHES.md).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/), sempre. O job `commits` do
CI reprova o PR que fugir do padrão.

```
<tipo>(<escopo>): <resumo no imperativo, minúsculo, sem ponto final>

<corpo: o porquê, não o quê — o diff já mostra o quê>

Refs: AC-XXX-01, AC-XXX-02
```

Tipos aceitos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `release`. Use o rodapé `BREAKING CHANGE:` sempre que o contrato de dados ou de rota
mudar.

```
feat(salas): adiciona entrada por PIN
fix(tempo): usa o horário do servidor na ordenação da fila
test(chat): cobre a negação de leitura de DM por terceiros
```

O `CHANGELOG.md` é **gerado** a partir desses assuntos (`npm run changelog`), então um resumo
preguiçoso vira uma linha preguiçosa no changelog que os outros vão ler.

## O ciclo de trabalho: red, green, refactor

Todo código de produção entra depois de um teste que falhou por ele. Em ordem:

1. **RED** — escreva o teste que expressa o critério. Rode-o e confirme que **falha**, e falha
   pelo motivo certo (não por erro de import). Um teste que passa de primeira não prova nada.
2. **GREEN** — escreva o mínimo de código para ele passar. Nada além disso.
3. **REFACTOR** — com o teste verde, melhore o desenho. Rode a suíte inteira antes e depois.

**Commit ao final de cada fase.** O histórico do PR é uma entrega: é por ele que a revisão
confirma que houve TDD de verdade. Um único commit gigante no fim reprova.

Para ficar verde, é **proibido**: apagar teste, marcar `.skip` ou `.todo`, afrouxar asserção,
baixar limiar de cobertura, mockar a própria unidade sob teste, ou capturar exceção sem
verificá-la.

## Rodando os testes

```bash
npm run lint        # ESLint, zero warnings toleradas
npm run test        # unitários, em watch, enquanto você desenvolve
npm run test:ci     # unitários uma vez, com cobertura — é o que o CI roda
npm run test:rules  # Security Rules; sobe o emulador, roda e desliga sozinho
npm run build       # build de produção
```

Antes de abrir o PR, os quatro precisam passar:

```bash
npm run lint && npm run test:ci && npm run test:rules && npm run build
```

### Os emuladores

`npm run test:rules` cuida de tudo sozinho. Para explorar o banco à mão:

```bash
npm run emulators
```

A interface abre em <http://localhost:4000>. Portas: Auth 9099, Firestore 8080, Storage 9199.

Os testes de integração rodam contra o projeto `demo-senai-duvidas`, **nunca** contra produção.
O prefixo `demo-` é o que faz o SDK do Firebase se recusar a falar com a nuvem, e
`tests/rules/projetoDeTeste.js` confere isso de novo em tempo de execução. Se você precisar de um
projectId diferente, ele também precisa começar com `demo-`.

### Cobertura

Mínimo de **80% de linhas e 75% de branches**, globais, verificado por limiar que faz
`npm run test:ci` sair diferente de zero. Baixar o limiar para um PR passar não é uma opção;
se um trecho não dá para testar, o problema é o desenho do trecho.

## Antes de abrir o PR

1. Incremente a `version` do `package.json` segundo [SemVer](https://semver.org/lang/pt-BR/):
   `fix:` → PATCH, `feat:` → MINOR, quebra de contrato → MAJOR (antes da 1.0.0, MINOR com o
   rodapé `BREAKING CHANGE:` documentado).
2. Gere a seção da versão no `CHANGELOG.md`:
   `npm run changelog -- origin/dev..HEAD`
3. Acrescente a entrada da versão em [`docs/HISTORICO.md`](docs/HISTORICO.md) — **o que mudou,
   por quê, o que foi descartado e o que o usuário sente na prática**. Esse arquivo é escrito
   para quem chegar depois.
4. Registre decisões arquiteturais novas como ADR em [`docs/adr/`](docs/adr/).
5. Marque os critérios atendidos em
   [`docs/CRITERIOS-DE-ACEITE.md`](docs/CRITERIOS-DE-ACEITE.md). Nunca reescreva um critério para
   caber na implementação: se o critério estiver errado, diga isso no PR e proponha a redação nova.
6. Preencha o template de PR por inteiro, inclusive a tabela do ciclo red-green-refactor.

## Compatibilidade de dados

O banco de produção tem documentos gravados por todas as versões anteriores. Duas regras não
negociáveis, e as duas exigem **teste**, não boa-fé:

- **Retroativa** — documento no formato antigo (`horario` como string ISO, `imagem` como URL,
  chamado sem `salaId`) continua sendo lido, exibido e ordenado. Nenhum campo é renomeado ou
  removido sem uma fase de leitura dupla.
- **Futura** — campo novo é **aditivo e opcional**, com padrão seguro na leitura, de modo que
  uma aba aberta com a versão anterior não quebre ao receber um documento novo.

Mudança de forma de dado é feita em três releases: *escrever nos dois formatos* → *migrar* →
*parar de escrever no antigo*. Nunca num único release.

## Restrições permanentes

- Nenhum segredo versionado. Config do Firebase por `REACT_APP_*`, com fallback documentado.
- Nenhum `console.log` de dado pessoal no código final.
- Toda escrita no banco valida a entrada antes de gravar.
- Nunca `onSnapshot` em coleção inteira sem `where` e `limit`; todo listener é cancelado no
  unmount.
- Alvo de escala: 10 salas ativas, 40 alunos por sala, 200 chamados e 1000 mensagens por sala,
  dentro do plano gratuito do Firebase.
- Navegadores: Chrome, Edge e Firefox, nas duas últimas versões estáveis. Sem API experimental.
- `npm ci && npm run build` precisa funcionar em máquina limpa.
