---
id: 01-auth-oauth-sessao
titulo: "Login com Google e GitHub, papel seguro e sessão persistente"
versao_origem: 0.2.0
versao_alvo: 0.3.0
tipo: feat
escopo_commit: auth
branch: feat/auth-social-sessao
branch_base: dev
depende_de: [00-fundacao-testes]
criterios: [AC-AUTH-01, AC-AUTH-02, AC-AUTH-03, AC-AUTH-04, AC-AUTH-05, AC-AUTH-06, AC-AUTH-07, AC-AUTH-08, AC-AUTH-09, AC-AUTH-10, AC-SESSAO-01, AC-SESSAO-02, AC-SESSAO-03, AC-SESSAO-04, AC-SESSAO-05, AC-SEC-03, AC-SEC-06]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: alto
observacao: "Corrige uma escalada de privilégio real: hoje o papel vem do localStorage."
---

# Você é o engenheiro responsável pela task 01 — Autenticação e Sessão

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**, sistema de dúvidas usado por
alunos e professores do SENAI. Sem instrução adicional de usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md` (laço red-green-refactor, formato do PR, compatibilidade, restrições de
produção), `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md` e todo o `src/`. A task 00 já deixou
harness de testes, emuladores, lint, CI e testes de caracterização — **eles são seu contrato:
nenhum pode ser removido ou enfraquecido.**

## O problema que você está resolvendo

Hoje existem **três** implementações concorrentes de autenticação:

- `src/App.js` — tem `onAuthStateChanged`, `signInWithPopup` para Google e GitHub, e monta o objeto
  do usuário lendo `localStorage.getItem('tipoUsuario')`.
- `src/AuthContext.js` — um provider completo que **nenhum componente usa**.
- `src/firebase.js` — helpers `signInWithGoogle`/`signInWithGithub`, tradução de erros, `setPersistence`
  e um `onAuthStateChanged` solto no nível do módulo que só faz `console.log`.

Consequências reais:

1. **Escalada de privilégio (crítica):** `App.js` decide o papel com
   `localStorage.getItem('tipoUsuario') || 'aluno'`. Qualquer aluno abre o DevTools, executa
   `localStorage.setItem('tipoUsuario','professor')`, recarrega e entra na tela do professor.
2. Os botões de Google e GitHub **não existem na interface** — `Login.js` nem recebe as funções que
   `App.js` passa como props.
3. Login social não cria documento em `usuarios/{uid}`, então `Login.js` mostra
   "Usuário não encontrado no banco de dados" e o usuário fica preso.
4. `Login.js` tem `onAuthStateChanged` próprio, competindo com o de `App.js` — daí o "piscar" da
   tela de login.
5. Erros aparecem como `alert()` com mensagem crua do Firebase.

## Critérios de aceite deste escopo

**Autenticação**
- AC-AUTH-01 — cadastro com nome, e-mail e senha cria `usuarios/{uid}` com `nome`, `email`, `tipo`,
  `uid` e `criadoEm` (timestamp do servidor). **[REG]**
- AC-AUTH-02 — login e-mail/senha redireciona para `/aluno` ou `/professor` conforme `tipo`. **[REG]**
- AC-AUTH-03 — botão "Entrar com Google" autentica e, no primeiro acesso, cria `usuarios/{uid}`
  com `tipo: "aluno"`.
- AC-AUTH-04 — botão "Entrar com GitHub" com o mesmo comportamento.
- AC-AUTH-05 — e-mail já existente com outro método exibe mensagem em português explicando como
  vincular a conta; nunca stack trace nem código bruto do Firebase.
- AC-AUTH-06 — papel resolvido **exclusivamente** pelo Firestore (`usuarios/{uid}.tipo` e
  `autorizados/{email}.Tipo`). `localStorage` nunca determina papel.
- AC-AUTH-07 — quem não está em `autorizados/{email}` com `Tipo: "professor"` não se cadastra nem
  opera como professor, mesmo alterando `localStorage`, o payload ou tentando pelo cliente.
- AC-AUTH-08 — logout limpa sessão do Firebase e todo estado local e volta para `/`; o botão
  "voltar" do navegador não expõe dados da sessão anterior.
- AC-AUTH-09 — rota protegida mostra carregamento enquanto resolve o papel e nunca pisca a tela de
  login para quem já está autenticado.
- AC-AUTH-10 — nenhum segredo versionado; config vem de `REACT_APP_*`.

**Sessão**
- AC-SESSAO-01 — fechar e reabrir a aba mantém o login.
- AC-SESSAO-02 — desligar e religar o computador mantém o login (`browserLocalPersistence`).
- AC-SESSAO-03 — sobrevive a Ctrl+F5 e a queda temporária de rede.
- AC-SESSAO-04 — token renovado automaticamente; sem logout após 1 hora de aba aberta.
- AC-SESSAO-05 — botão "Sair" visível em todas as telas autenticadas (laboratório é máquina
  compartilhada).

**Segurança**
- AC-SEC-03 — escalada de aluno para professor impossível pelo cliente.
- AC-SEC-06 — HTTPS apenas; domínios autorizados do Firebase Auth restritos aos domínios reais.

## Desenho pedido

```
src/contexts/AuthContext.jsx     -> único provider: { usuario, papel, carregando, erro,
                                     entrarComEmail, entrarComGoogle, entrarComGithub, sair }
src/services/auth.js             -> chamadas ao Firebase, isoladas e testáveis
src/services/perfilUsuario.js    -> garantirPerfil(user): lê usuarios/{uid}; se não existir,
                                     cria com tipo "aluno"; resolve professor por autorizados/{email}
src/components/RotaProtegida.jsx -> exige autenticação + papel; mostra carregamento; redireciona
src/utils/errosAuth.js           -> código do Firebase -> mensagem em português
```

- **Apague** `src/AuthContext.js` (o provider órfão) e toda a lógica de auth de `App.js`; `App.js`
  passa a ser só roteamento envolvido pelo provider.
- Remova o `onAuthStateChanged` solto no nível do módulo em `src/firebase.js`.
- Remova o `onAuthStateChanged` de `Login.js`.
- Substitua os `alert()` de auth por mensagens renderizadas no formulário.

**Regra de resolução do papel — implemente exatamente assim:**

1. `usuarios/{uid}.tipo === "professor"` **e** `autorizados/{email}.Tipo === "professor"` → professor.
2. Documento `usuarios/{uid}` existe e não satisfaz o item 1 → aluno.
3. Documento não existe (primeiro login social) → cria com `tipo: "aluno"` → aluno.
4. Falha ao ler o Firestore → **não** assume papel nenhum; mostra erro e oferece "tentar novamente".

## Integração

- **Task 00:** os testes de caracterização de login e cadastro vão precisar de ajuste porque a
  fonte do papel muda. Ajuste-os **conscientemente** — atualize a asserção e explique no commit.
  Nunca apague o teste.
- **Task 03 (salas):** vai consumir `usuario.uid` e `papel` do seu contexto. Deixe a API do contexto
  estável e documentada com JSDoc.
- **Task 09 (perks):** vai precisar saber se o usuário é professor **da sala específica** — deixe
  `papel` como papel global e reserve a checagem por sala para a task 03.
- **Firestore Rules:** adicione as funções auxiliares `ehAutenticado()` e `ehProfessor()` em
  `firestore.rules` com testes, mas **não** endureça ainda os caminhos de `chamados` e `chat` —
  isso é da task 03, e endurecer agora quebraria a aplicação.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `perfilUsuario` cria documento no primeiro login social |
| 2 | `perfilUsuario` resolve professor só com `autorizados` + `usuarios` concordando |
| 3 | `localStorage.setItem('tipoUsuario','professor')` **não** torna ninguém professor |
| 4 | `AuthContext` expõe `carregando: true` até resolver o papel |
| 5 | `RotaProtegida` não renderiza `<Login>` para usuário autenticado (anti-piscada) |
| 6 | Botão Google chama `signInWithPopup` com `GoogleAuthProvider` |
| 7 | Botão GitHub idem |
| 8 | `auth/account-exists-with-different-credential` vira mensagem em português |
| 9 | Persistência configurada como `browserLocalPersistence` antes de qualquer login |
| 10 | Sessão restaurada ao remontar a aplicação, sem nova autenticação |
| 11 | `sair()` limpa Firebase **e** todas as chaves locais e redireciona |
| 12 | Botão "Sair" presente em `/aluno` e `/professor` |

## Compatibilidade

- **Retroativa:** usuários que já existem em `usuarios/{uid}` com `tipo` gravado continuam entrando
  normalmente. Teste com um documento sem `criadoEm` (formato antigo) — não pode lançar exceção.
  Contas legadas de professor precisam continuar funcionando: se `usuarios/{uid}.tipo ===
  "professor"` mas o e-mail sumiu de `autorizados`, registre em log e rebaixe para aluno com aviso
  claro, em vez de travar o acesso.
- **Futura:** `criadoEm` e `provedor` são campos **aditivos**. Prove por teste que um leitor que os
  ignora continua funcionando. Não renomeie nem remova `tipo`, `nome`, `email` nem `uid`.
- **Migração:** nenhuma migração destrutiva. Se decidir preencher `criadoEm` retroativamente, faça
  por script idempotente em `scripts/`, documentado e reversível.

## Documentação

Atualize `CHANGELOG.md`, `docs/HISTORICO.md` (conte a história da falha do `localStorage` e por que
a correção veio antes das features) e crie
`docs/adr/0003-fonte-unica-de-verdade-para-papel-do-usuario.md`.

## Como saber que terminou

`npm run lint`, `npm run test:ci`, `npm run test:rules` e `npm run build` verdes; todos os ACs
acima cobertos por teste; nenhum teste da task 00 removido ou pulado; cobertura mantida.

## Pull Request

Contra `dev`, template do `tasks/_PROTOCOLO.md`:

```
feat(auth): adiciona login com Google e GitHub, sessão persistente e papel via Firestore

BREAKING CHANGE: o papel do usuário deixa de ser lido do localStorage e passa a vir
exclusivamente do Firestore.
```

**Versão:** 0.2.0 → 0.3.0 (MINOR com `BREAKING CHANGE` documentado — projeto ainda em 0.y.z)
