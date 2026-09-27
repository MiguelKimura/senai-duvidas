# Como sai uma versão, e como se volta atrás

> AC-CI-07, AC-CI-08. Este documento é para ser aberto **durante** um release, não antes.
> Ele diz o que fazer, na ordem, e o que fazer quando der errado.

O público deste sistema são turmas em aula. Uma versão ruim em produção não é um gráfico
que piora: é uma aula de duas horas que para. Por isso o procedimento abaixo tem duas
metades do mesmo tamanho — publicar e reverter — e a segunda é a que precisa estar
decorada.

---

## 1. Os dois ambientes

Este projeto tem **um único projeto Firebase real**, no plano Spark (gratuito) —
`senai-duvidas`. Não há orçamento nem plano para manter um segundo projeto só
para testes, então produção e homologação **compartilham banco, Storage e
Authentication**. O que separa os dois ambientes não é o projeto: é o canal do
Firebase Hosting.

| Ambiente | Sai de | Canal do Hosting | Quem usa |
|---|---|---|---|
| **Homologação** | `dev` | canal de pré-visualização `homologacao`, temporário | quem desenvolve e o professor que topa testar |
| **Produção** | `main` | canal `live` — a URL que a turma acessa | alunos e professores, em aula |

**O dado é o mesmo dos dois lados.** Clicar no link de homologação lê e escreve
no banco real. Enquanto a base for descartável — o caso hoje, com a turma que
gerou os dados originais já formada —, isso não é um problema. Quando houver
alunos de verdade matriculados, use o canal de homologação só para **olhar a
tela renderizando**, não para exercitar fluxos que gravam dado (abrir chamado,
mandar mensagem, entrar numa sala) — isso mistura teste com produção de verdade.

Uma consequência direta: **as Security Rules só mudam por `main`.** Um canal de
pré-visualização usa o Firestore e o Storage do projeto inteiro — não há como
isolar rules por canal —, então publicar rules a partir de `dev` colocaria a
turma sob uma regra que ainda não passou pela revisão. Uma feature de `dev` que
dependa de uma rule nova só funciona de ponta a ponta depois que aquele PR
chegar a `main`; até lá, o canal de homologação mostra a tela, mas a escrita que
a rule nova autorizaria ainda vai ser negada. Teste esses fluxos contra o
emulador (`npm run emulators`) — ele *não* toca no projeto real e não tem essa
limitação.

`main` é o que a turma vê. `dev` é integração. Nada chega em `main` a não ser por Pull
Request de `dev`, com o CI verde e uma aprovação — a configuração exata está em
[`PROTECAO-BRANCHES.md`](PROTECAO-BRANCHES.md).

**O merge de `dev` em `main` é o release.** Não há botão a apertar depois. Isso é
deliberado: um passo manual entre "aprovado" e "publicado" é um passo que um dia não é
dado, e a versão que a turma usa passa a ser diferente da que foi revisada.

## 2. Publicar uma versão

### 2.1 Antes de abrir o PR de release

Tudo isto roda na sua máquina e não depende de ninguém:

```bash
npm ci                     # a instalação reprodutível, a mesma do CI
npm run lint               # zero warnings
npm run test:ci            # unitários + cobertura (≥ 80% linhas, ≥ 75% branches)
npm run test:rules         # Security Rules contra o emulador
npm run test:e2e           # fluxos críticos no navegador
npm run build && npm run orcamento   # bundle inicial < 300 KB gzip
npm run orcamento:suite    # as três suítes somadas < 5 min
```

Depois, os três arquivos que declaram a versão — e que precisam concordar, porque
`src/__tests__/release.test.js` reprova se divergirem:

1. `package.json` › `version`, segundo o [SemVer](https://semver.org/lang/pt-BR/);
2. `CHANGELOG.md`, com a seção **gerada** dos commits, nunca escrita à mão:
   ```bash
   npm run changelog -- origin/dev..HEAD --versao 1.0.0 --data 2026-09-26
   ```
   A saída vai no topo do arquivo, acima da seção anterior;
3. `docs/HISTORICO.md`, com a narrativa da versão — o que mudou, por quê, o que foi
   descartado e o que o usuário sente na prática.

### 2.2 O PR de release

```bash
git switch dev && git pull
# abra o PR de dev -> main pela interface do GitHub
gh pr create --base main --head dev --title "release: versão 1.0.0" --body-file .github/pull_request_template.md
```

O PR precisa dos cinco checks verdes: `lint`, `test`, `test-rules`, `e2e`, `build`.

### 2.3 O que acontece no merge

`.github/workflows/release.yml` dispara no push para `main` e faz, nesta ordem:

1. **verificar** — lint, unitários, rules, end-to-end, build e orçamento do bundle. Um
   `main` vermelho ainda dá para descobrir aqui, e dois PRs verdes podem produzir um
   `main` vermelho ao se encontrarem;
2. **publicar** — lê a versão do `package.json`, recorta a seção do `CHANGELOG.md`, cria a
   tag `vX.Y.Z`, publica o release no GitHub com essa seção como corpo, e faz o deploy de
   produção.

A tag desta versão é **`v1.0.0`**.

A criação da tag é idempotente: se `vX.Y.Z` já existe no remoto, o workflow diz isso e não
faz nada. Uma tag publicada nunca é movida — quem instalou a `v1.0.0` precisa continuar
tendo a mesma `v1.0.0`.

### 2.4 Homologação

`.github/workflows/homologacao.yml` dispara no push para `dev` e publica num **canal de
pré-visualização** do Hosting (`hosting:channel:deploy`, não `deploy` puro), no mesmo
projeto de produção — não existe um segundo projeto. O canal expira em 30 dias e é
recriado a cada push; a URL fica visível no log da action. Não cria tag e não publica
release: homologação não é uma versão, é o estado atual de `dev`. E não publica
`firestore.rules` nem `storage.rules` — só o Hosting muda por esse caminho (§ 1).

### 2.5 O que falta configurar uma vez, à mão

O deploy depende de coisas que só o dono do projeto cria, e que não existem em nenhuma API
que a automação possa chamar. Está registrado em [`BLOQUEIOS.md`](BLOQUEIOS.md):

| O que | Onde | Nome |
|---|---|---|
| O único projeto Firebase (`senai-duvidas`) | console do Firebase | variáveis de repositório `FIREBASE_PROJETO_PRODUCAO` **e** `FIREBASE_PROJETO_HOMOLOGACAO`, com **o mesmo valor** |
| Conta de serviço com papel de deploy | IAM do projeto | segredo `FIREBASE_SERVICE_ACCOUNT` (JSON) |
| Domínios autorizados do Auth | Authentication → Settings | ver [`DOMINIOS-AUTORIZADOS.md`](DOMINIOS-AUTORIZADOS.md) |

Enquanto o segredo não existir, o workflow **não falha**: ele marca a versão, publica o
release no GitHub e emite um aviso dizendo que o deploy não rodou. Falhar ali deixaria a
tag sem criar e faria parecer que o release não saiu, quando o que falta é uma
configuração de painel.

O deploy publica três coisas juntas — `hosting`, `firestore:rules` e `storage` — e a ordem
importa: **as rules vão junto com o código que as pressupõe**. Publicar o app novo contra
as rules antigas é o cenário em que a tela existe e o servidor nega tudo o que ela tenta.

---

## 3. Reverter

Três situações, três respostas. A primeira pergunta é sempre a mesma: **algum dado já foi
escrito no formato novo?**

### 3.1 Só o código está ruim, o dado não mudou

O caminho mais rápido, e o que serve para 90% dos casos. O Firebase Hosting guarda as
versões anteriores:

```bash
# lista as versões publicadas
npx firebase hosting:versions:list --project <projeto-de-producao>

# republica a anterior no canal ativo
npx firebase hosting:clone <projeto>:live <projeto>:live --version-id <id-anterior>
```

Isso volta a tela em segundos, sem tocar no banco e sem esperar CI. **Faça isso primeiro**,
e só depois conserte o repositório:

```bash
git switch main && git pull
git revert --no-commit <sha-do-merge>^..<sha-do-merge>
git commit -m "revert: volta a versão 1.0.0 por <motivo>"
# abra PR de revert para main
```

O `revert` no repositório não é opcional: sem ele, o próximo merge em `main` republica o
código que acabou de ser tirado do ar.

### 3.2 As rules estão ruins

Rules são publicadas junto do código, e voltam junto:

```bash
git checkout <tag-anterior> -- firestore.rules storage.rules
npx firebase deploy --only firestore:rules,storage --project <projeto-de-producao>
```

Rules podem ser revertidas sem reverter o app, e às vezes é o que se quer: uma rule nova
negando demais é resolvida em um minuto sem tirar a tela do ar.

### 3.3 Uma migração de dados já rodou

Aqui não há atalho, e é por isso que cada migração nasce com o caminho de volta escrito.
Abra [`MIGRACOES.md`](MIGRACOES.md): ele tem, por migração, o comando de aplicar, o de
`--dry-run` e o de reverter.

As três regras que tornam isso possível, e que valem para toda migração nova:

- **idempotente** — rodar duas vezes não duplica nem corrompe nada;
- **aditiva** — o campo novo nasce ao lado do antigo, e o antigo só cai numa versão
  posterior. É por isso que `horarioIso`, `imagem` como string e `nome`/`email` nas
  mensagens **continuam sendo escritos na 1.0.0**;
- **reversível** — existe o script que desfaz, e ele foi rodado ao menos uma vez contra o
  emulador.

Ordem de reversão quando há migração no meio: **primeiro o código** (§ 3.1, para parar de
escrever no formato novo), **depois o dado**. O contrário deixa a versão nova lendo um
banco que já voltou, que é o pior dos dois estados.

### 3.4 Quem avisa a turma

Um rollback em horário de aula precisa de um aviso humano, porque o aluno com a tela aberta
não recarrega sozinho. A ordem é: republicar, avisar os professores das turmas em aula,
pedir que a turma recarregue a página.

---

## 4. Checklist de release

Para copiar no PR:

- [ ] `npm run lint`, `test:ci`, `test:rules`, `test:e2e`, `build`, `orcamento` verdes na máquina
- [ ] cobertura ≥ 80% linhas / ≥ 75% branches
- [ ] `package.json`, `CHANGELOG.md` e `docs/HISTORICO.md` concordam sobre a versão
- [ ] seção do CHANGELOG **gerada** por `npm run changelog`
- [ ] compatibilidade retroativa provada por teste (documento no formato antigo continua legível)
- [ ] compatibilidade futura provada por teste (leitor antigo não quebra no documento novo)
- [ ] migração nova, se houver: idempotente, aditiva e reversível, com entrada em `MIGRACOES.md`
- [ ] cinco checks verdes no PR de `dev` → `main`
- [ ] depois do merge: tag `vX.Y.Z` criada e release publicado
- [ ] depois do deploy: abrir a tela de login em produção e entrar com uma conta de teste
