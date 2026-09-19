# Histórico de Desenvolvimento

> Este documento é a memória do projeto. Cada versão registra **o que existia antes**, **que
> problema real isso causava para alunos e professores**, **que decisão foi tomada e por quê** —
> incluindo o que foi descartado — e **o que o usuário final passa a sentir na prática**.
>
> Toda task do roadmap acrescenta a sua seção aqui antes de abrir o PR. Na v1.0.0, a task 09
> fecha o documento com a seção "O sistema hoje, pelos olhos de quem usa".

---

## v0.1.0 — O protótipo que funcionou

**O que existia**

Um Create React App com Firebase, escrito durante o curso. Um aluno faz login, aperta o `+`,
descreve o problema e o card aparece na tela do professor em tempo real. Tem chat, tem anexo por
URL, tem cadastro com verificação de quem pode ser professor. Funcionou de verdade, em sala.

**Os limites que apareceram com o uso**

- **A fila dependia do relógio do aluno.** O sistema gravava `new Date().toISOString()` no
  computador de quem enviava. Nos laboratórios, muitas máquinas estão com data ou fuso errados —
  então a ordem de atendimento nunca foi confiável, e quem quisesse furar a fila só precisava
  mexer no relógio do Windows.
- **Todo mundo via tudo.** `chamados` e `chat` eram coleções globais. Não havia como separar
  turmas, cursos ou períodos.
- **O papel vinha do navegador.** `App.js` lia `localStorage.getItem('tipoUsuario')` para decidir
  se a pessoa era aluno ou professor. Duas linhas no console do navegador davam acesso à tela do
  professor.
- **`!clear` era de todos.** Qualquer aluno apagava o chat inteiro digitando um comando.
- **Imagem só por link.** O aluno tirava print do erro e não tinha onde hospedar, então acabava
  descrevendo por escrito — e o professor perdia tempo pedindo detalhe.
- **Sem nenhum teste.** Toda mudança era uma aposta.
- **Três implementações de autenticação** convivendo (`App.js`, `AuthContext.js` e `firebase.js`),
  competindo entre si — daí a tela de login que piscava.

**O que o usuário sentia**

O sistema resolvia o problema principal — o professor via as dúvidas sem ninguém levantar a mão —
mas a ordem de atendimento era imprevisível e a turma toda dividia o mesmo espaço.

---

## v0.2.0 — Fundação de testes

*(a preencher pela task 00)*

## v0.3.0 — Login social e sessão que não expira

*(a preencher pela task 01)*

## v0.4.0 — Horário oficial

*(a preencher pela task 02)*

## v0.5.0 — Salas com PIN

*(a preencher pela task 03)*

## v0.6.0 — Imagens do computador

*(a preencher pela task 04)*

## v0.7.0 — Opções avançadas do card

*(a preencher pela task 05)*

## v0.8.0 — Chat novo e mensagens diretas

*(a preencher pela task 06)*

## v0.9.0 — Perks

*(a preencher pela task 07)*

## v0.10.0 — Acabamento e acessibilidade

*(a preencher pela task 08)*

## v1.0.0 — Primeira versão estável

*(a preencher pela task 09, incluindo a seção "O sistema hoje, pelos olhos de quem usa")*
