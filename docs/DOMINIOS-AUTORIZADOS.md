# Domínios autorizados do Firebase Auth e HTTPS obrigatório

> Referente ao **AC-SEC-06**. Metade deste critério é código e está testada;
> a outra metade é configuração do console do Firebase e **precisa ser
> aplicada à mão**, uma vez, por quem administra o projeto. Este documento diz
> exatamente o quê, e por quê.

## Por que isto importa neste projeto

O app roda em laboratório: rede compartilhada, máquinas compartilhadas, turma
inteira no mesmo switch.

- **Em HTTP**, o token do Firebase e o conteúdo do chat viajam legíveis. Um
  aluno com um sniffer assume a sessão da professora sem precisar de senha.
- **Com a lista de domínios autorizados aberta**, qualquer página hospedada em
  qualquer lugar consegue abrir o popup de login deste projeto e receber a
  credencial de volta. É phishing com a tela real do Google, apontando para o
  banco de dados real da escola.

## A parte que é código (testada)

| O quê | Onde | Teste |
|---|---|---|
| Redireciona HTTP para HTTPS antes de a aplicação montar | `src/utils/httpsObrigatorio.js`, chamado em `src/index.js` | `src/utils/__tests__/httpsObrigatorio.test.js` |
| `authDomain` vem de `REACT_APP_FIREBASE_AUTH_DOMAIN`, nunca versionado | `src/firebase.js` | `src/__tests__/firebaseConfig.test.js` |

`localhost`, `127.0.0.1` e `::1` são exceções deliberadas: `npm start` e os
emuladores servem em HTTP, e redirecionar ali impediria rodar o projeto.

## A parte que é console (aplicar à mão)

**Firebase Console → Authentication → Settings → Authorized domains.**

A lista precisa conter **exatamente** estes domínios, e nenhum outro:

| Domínio | Por que está na lista |
|---|---|
| `localhost` | Desenvolvimento. O Firebase o inclui por padrão e ele não representa risco: só resolve na própria máquina. |
| `senai-duvidas.firebaseapp.com` | Domínio do Firebase Hosting, usado pelo handler do OAuth. |
| `senai-duvidas.web.app` | O outro domínio que o Hosting publica por padrão. |
| *(domínio próprio, quando existir)* | Acrescentar aqui **no mesmo dia** em que o domínio entrar no ar. |

**Remover** qualquer domínio que não esteja na tabela — em especial domínios de
preview de deploy e de testes antigos. Cada entrada extra é uma origem a mais
autorizada a receber credencial deste projeto.

### Como conferir

1. Abrir o console no caminho acima e comparar a lista com a tabela.
2. Em outra origem qualquer (por exemplo, um `index.html` servido de outro
   domínio), tentar `signInWithPopup` com a config deste projeto: o Firebase
   precisa recusar com `auth/unauthorized-domain`.

Não existe API de cliente que leia essa lista, então não há como cobrir este
passo com teste automatizado. É por isso que o AC-SEC-06 está marcado como 🟡
em `docs/CRITERIOS-DE-ACEITE.md`, com a parte que falta nomeada — mesmo
tratamento dado ao AC-CI-04, que também depende de configuração de UI.

## Hosting

O Firebase Hosting já serve HTTPS e redireciona HTTP por conta própria, mas só
no domínio dele. O guarda em `src/index.js` cobre o caso de alguém abrir o app
por um IP da rede local ou por um domínio novo ainda sem o redirecionamento
configurado — situação em que a aula inteira rodaria em HTTP sem ninguém notar.
