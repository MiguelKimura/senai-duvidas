# Bloqueios conhecidos

> Limites técnicos que uma task encontrou, não conseguiu resolver dentro do
> escopo dela, e resolveu da melhor forma possível — com a causa e a proposta
> escritas aqui, em vez de silenciosamente reduzidas.
>
> Uma entrada só sai daqui quando a task que a fecha entrega o teste que prova
> que ela foi fechada.

---

## B-001 — O limite de tentativas de PIN é por usuário, não por origem

- **Versão:** 0.5.0 (task 03)
- **Critério afetado:** AC-SALA-12
- **Estado:** implementado com a alternativa mais segura possível no modelo atual

### O limite

`tentativasPin/{uid}` guarda o contador e a janela, e a rule valida as duas
coisas com o relógio do servidor: 5 tentativas em 5 minutos, e a janela só
reinicia depois de vencida. Isso **funciona** contra o cenário real de sala de
aula — o aluno que tenta adivinhar o PIN da turma do colega —, e funciona
porque a contagem e o tempo são do servidor, não do cliente.

O que ele não cobre: **um atacante que crie contas novas**. Cada conta ganha a
própria janela de cinco tentativas. Com cadastro aberto por Google, criar
contas é barato, e um milhão de combinações dividido por cinco são 200 mil
contas — inviável na mão, viável com script.

### Por que não foi resolvido nesta task

As Security Rules não conseguem manter um contador por IP nem por sala:

1. **Não há acesso ao IP.** `request` não expõe origem. Não existe expressão de
   rule que diga "esta requisição veio da mesma máquina da anterior".
2. **Um contador por sala seria escrito por quem ataca.** Para contar as
   tentativas de uma sala, o documento do contador precisaria ser gravável por
   qualquer um que tente entrar — inclusive para zerá-lo. Quem pode somar 1
   pode gravar 0.
3. **Rules não têm estado próprio.** Elas leem e validam documentos; não
   mantêm nada por conta.

### O que foi feito, então

- Contador por usuário, com janela validada pelo servidor (o que **é**
  possível em rules, e é a maior parte da defesa real).
- Leitura do índice de PINs amarrada a uma tentativa recém-contada
  (`pinTentado` + `ultimaTentativaEm`): sem a amarra, dava para consultar o
  índice sem nunca contar tentativa, e o contador seria decoração.
- `indicePins` sem `list`: não há como varrer o índice; é preciso já saber o
  número para perguntar por ele.
- Regeração de PIN em um clique, para o professor fechar a porta quando
  desconfiar.

### Proposta para fechar

Uma **Cloud Function** `entrarComPin(pin)` que:

1. Faça a conferência do resumo no servidor, como a rule faz hoje.
2. Mantenha um contador por **sala** e outro por **IP de origem** — ambos em
   documentos que só a Function escreve, o que resolve o item 2 acima.
3. Aplique atraso progressivo (100 ms, 200 ms, 400 ms…) por origem, tornando a
   varredura cara mesmo com muitas contas.
4. Devolva a mesma mensagem genérica de hoje, para não virar oráculo.

O modelo já está desenhado para essa troca: quem confere o PIN **já é o
servidor**, e o cliente já não lê o segredo. Migrar significa mover a
conferência da rule para a Function e apertar a rule de `membros` para aceitar
apenas escrita vinda dela. Nenhum dado muda de forma.

**Custo de não fazer agora:** o ataque exige criar centenas de milhares de
contas para varrer o espaço, e produz um rastro visível no console do Firebase
Auth. Para o uso previsto — dez salas, um semestre —, o risco aceito é
consciente, e a mitigação operacional é o professor regerar o PIN.

---

## B-002 — A responsividade é provada no texto do CSS, não no pixel

- **Versão:** 0.10.0 (task 08)
- **Critério afetado:** AC-ANIM-08
- **Estado:** implementado; a prova automatizada cobre a regra, não o layout

### O limite

`src/styles/__tests__/responsividade.test.js` lê as folhas de estilo **como
texto**. Ele prova que a regra que evita o problema existe, que ela está no
ponto de corte combinado, e que ninguém inventou um quinto ponto de corte no
caminho. O que ele não prova é que um pixel caiu onde deveria.

A razão é do ambiente, não de preguiça: o jsdom não aplica folha de estilo nem
calcula layout. `getComputedStyle` ali devolve o valor declarado inline, não o
resultado da cascata — não existe, dentro do Jest, largura de elemento para
medir. Um teste que afirmasse "o card cabe em 360px" estaria afirmando algo que
o ambiente não tem como saber, e um teste que aprova o que não mediu é pior do
que nenhum.

### O que ficou provado, então

- Nenhuma folha inventa um ponto de corte fora dos quatro combinados (480,
  768, 1024, 1440);
- o chat vira painel de tela cheia abaixo de 768px;
- o diálogo ocupa a tela inteira abaixo de 480px;
- nenhuma largura fixa passa de 360px, que é o compromisso de não haver
  rolagem lateral;
- as duas telas de sala deixaram de se dimensionar por `calc(100vh - 120px)`
  dentro de uma coluna de `height: 95vh`.

Esse último item é o argumento de que o teste vale apesar do limite: **foi ele
que pegou o defeito**. Duas contas sobre a mesma janela, a de dentro maior —
na 1024×768 do laboratório a coluna tem 730px e o conteúdo pedia 776. A lista
vazava por baixo e o botão `+`, que é `position: fixed`, cobria o último card.
Num monitor de 1080px a conta fecha, e é por isso que ninguém nunca tinha visto
o defeito: ele só aparece exatamente na tela onde o app roda de verdade.

### Proposta para fechar

`npm run test:e2e` (Playwright), previsto para a v1.0.0, roda num navegador com
layout real. Fechar este item é um arquivo de teste que, para cada um dos dois
tamanhos que importam:

1. abre a página no viewport exato (1024×768 e 360×640);
2. afirma `document.documentElement.scrollWidth <= clientWidth` — a ausência de
   rolagem lateral, que é o defeito de celular;
3. afirma que o último card da fila não fica coberto pelo botão flutuante,
   comparando os dois retângulos — o defeito de laboratório;
4. tira uma imagem de referência por viewport, para a regressão visual.

Nada no código precisa mudar para isso acontecer: o que falta é o navegador,
não a folha de estilo.

**Custo de não fazer agora:** uma regressão de layout que não passe por
nenhuma das regras guardadas acima entra sem ser vista, e só aparece quando
alguém abrir o app na tela do laboratório. A mitigação até lá é a conferência
manual nas duas resoluções antes do release.
