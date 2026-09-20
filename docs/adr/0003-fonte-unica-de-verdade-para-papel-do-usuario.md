# ADR 0003 — Fonte única de verdade para o papel do usuário

- **Status:** aceita
- **Data:** 2026-09-20
- **Versão:** 0.3.0
- **Contexto da task:** `tasks/01-auth-oauth-sessao.md`
- **Critérios:** AC-AUTH-06, AC-AUTH-07, AC-SEC-03

## Contexto

Até a v0.2.0 o papel do usuário — aluno ou professor — era decidido assim, em
`src/App.js`:

```js
tipo: localStorage.getItem('tipoUsuario') || 'aluno'
```

`localStorage` é memória do navegador do próprio usuário. Qualquer aluno abria
o DevTools, executava `localStorage.setItem('tipoUsuario','professor')`,
recarregava e entrava na tela do professor — com acesso à fila inteira de
chamados e ao poder de apagar o que quisesse. Não havia exploração a
desenvolver: era uma linha digitada no console.

O problema não era só a linha. Havia **três** implementações de autenticação
concorrentes — `App.js`, um `AuthContext.js` que nenhum componente usava, e
helpers soltos em `firebase.js` com um `onAuthStateChanged` no nível do módulo.
Com três fontes, não existia um lugar onde consertar: qualquer correção numa
delas era contornável pelas outras. E `Login.js` tinha um quarto listener, o
que fazia a tela de login piscar para quem já estava autenticado.

O servidor também não ajudava: as Firestore Rules de `usuarios/{uid}` eram
`allow read, create, update, delete: if true`. Mesmo que o cliente ficasse
correto, bastava uma chamada avulsa ao Firestore para gravar
`tipo: "professor"` no próprio documento.

## Decisão

**O papel do usuário vem do Firestore, e de mais lugar nenhum.** Concretamente:

1. **Uma única fonte no cliente.** `src/services/perfilUsuario.js` é o único
   módulo que decide papel, e `src/contexts/AuthContext.jsx` é o único provider.
   `AuthContext.js` foi apagado, a lógica de auth saiu de `App.js` (que virou só
   roteamento), o listener solto saiu de `firebase.js` e o de `Login.js` também.

2. **Duas fontes no banco, que precisam concordar.** É professor quem satisfaz
   as duas condições ao mesmo tempo:

   - `usuarios/{uid}.tipo === "professor"`, **e**
   - `autorizados/{email}.Tipo === "professor"`.

   `autorizados` é mantida à mão no console do Firebase e tem escrita negada
   pelas rules desde a v0.1.0. É a única das duas que o cliente não consegue
   forjar — e é por isso que ela é obrigatória. O documento `usuarios/{uid}`
   sozinho nunca basta.

3. **A mesma regra no servidor.** `firestore.rules` ganhou `ehAutenticado()`,
   `ehDono()` e `ehProfessor()`, e `usuarios/{uid}` deixou de ser `if true`:
   só o dono escreve o próprio documento, e só grava `tipo: "professor"` quem
   `autorizados` confirma. `ehProfessor()` lê o e-mail do **token**, nunca do
   payload — o corpo da requisição é escolhido pelo cliente, o token é assinado
   pelo Firebase.

4. **Falha de leitura não vira papel.** Se o Firestore não responde, o app não
   assume "aluno": mostra erro em português e oferece "tentar novamente".
   Assumir um papel por indisponibilidade de rede é decidir permissão por acaso.

## Alternativas consideradas

**Custom claims no token do Firebase Auth.** Tecnicamente é a resposta certa:
o papel viajaria assinado dentro do token, sem leitura extra e sem precisar de
`get()` nas rules — que custa leitura e conta na cota. Foi **descartada por
ora** porque exige Cloud Functions com plano Blaze (cartão de crédito), e o
projeto precisa caber no plano gratuito. A lista `autorizados` já existe, já é
mantida no console e já tem escrita negada, então ela entrega a mesma garantia
sem infraestrutura nova. Se o projeto migrar para Blaze, este ADR deve ser
substituído: o `TODO(task-03)` em `firestore.rules` já marca o ponto.

**Confiar só em `usuarios/{uid}.tipo`.** Seria uma leitura a menos, mas o
cliente escreve nesse documento no cadastro. Sem `autorizados`, a promoção
voltaria a depender de o front-end se comportar.

**Confiar só em `autorizados/{email}`.** Removeria o `tipo` do documento de
usuário e, com ele, a compatibilidade retroativa: contas antigas de professor
deixariam de funcionar até alguém reconciliar a lista à mão, possivelmente no
meio de uma aula.

**Endurecer `chamados` e `chat` junto.** Descartada de propósito: essas
coleções ainda não têm escopo de sala, e apertá-las agora derrubaria o app em
produção. É a task 03, que reusa as funções auxiliares criadas aqui.

## Consequências

**Boas**

- A escalada de privilégio deixa de existir, no cliente e no servidor.
- Existe um lugar só para mudar quando a regra de papel mudar.
- A tela de login para de piscar: um listener, não quatro.
- `papel` fica disponível em `useAuth()` com JSDoc, pronto para a task 03.

**Custos aceitos**

- **Uma leitura extra do Firestore por login**, para consultar `autorizados`.
  Para o alvo do projeto (10 salas × 40 alunos), é desprezível dentro do plano
  gratuito.
- **Um `get()` nas rules** a cada escrita de `usuarios/{uid}` que tente gravar
  professor. Escritas nesse caminho acontecem no cadastro e no primeiro login,
  não em loop.
- **Conta legada de professor rebaixada.** Se `usuarios/{uid}.tipo` diz
  professor mas o e-mail sumiu de `autorizados`, a pessoa entra **como aluno**,
  com aviso na tela e registro em log — em vez de ficar travada na porta. A
  alternativa (bloquear) transformaria um erro de cadastro numa aula perdida.
  O log dá ao administrador exatamente o que reconciliar.

**O que passa a ser obrigatório**

- Manter `autorizados/{email}` atualizada no console é agora uma tarefa
  operacional de verdade: quem sai da lista perde o acesso de professor no
  login seguinte.
