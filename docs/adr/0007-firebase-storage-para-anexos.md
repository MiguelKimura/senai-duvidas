# ADR 0007 — Firebase Storage para anexos, sem trocar de banco

- **Status:** aceita
- **Data:** 2026-09-21
- **Versão:** 0.6.0
- **Contexto da task:** `tasks/04-upload-imagens.md`
- **Critérios:** AC-IMG-01 a AC-IMG-13, AC-SEC-08, AC-CHAMADO-08

## Contexto

O aluno tira um print do erro que apareceu na tela dele e não tem onde
hospedar. Até a v0.5.0 o único jeito de anexar era **colar uma URL**, e uma URL
é justamente o que quem acabou de apertar PrintScreen não tem. O que acontecia
na prática é que ele descrevia o erro por escrito, mal, e o professor perdia
metade do atendimento pedindo detalhe — em uma aula onde há mais trinta e nove
alunos na fila.

O cliente descreveu o pedido assim: **"mudar o banco de dados pra permitir
imagens, porque o Firebase é burocrático com imagem"**.

A premissa está meio certa e a conclusão está errada, e a diferença entre as
duas custa semanas. O que é verdade: o **Firestore** não guarda binário grande
— o limite é **1 MB por documento**, e um print de tela cheia em PNG passa
disso com folga. O que não é verdade: que isso seja uma limitação do Firebase.
O **Firebase Storage** existe exatamente para esse caso, já está inicializado
em `src/firebase.js` desde a v0.1.0, já tem cota no mesmo plano gratuito e já
compartilha a mesma sessão de autenticação.

O projeto tinha inclusive uma função `uploadImage` em `src/firebase.js` que
**ninguém chamava**, escrita durante o curso e nunca ligada a uma tela.

## Decisão

### 1. O binário vai para o Storage; o Firestore guarda o endereço

`salas/{salaId}/chamados/{chamadoId}/{arquivo}` no Storage. O documento do
chamado guarda a URL e o caminho, que juntos pesam algumas centenas de bytes.

O caminho é **por sala** porque o escopo do projeto é por sala desde o ADR
0005: a rule de leitura do anexo faz a mesma pergunta que a rule do chamado —
`firestore.exists(.../salas/$(salaId)/membros/$(request.auth.uid))`. Um caminho
global não teria como responder isso, porque não haveria sala no caminho para
perguntar sobre.

O nome do arquivo são **16 bytes sorteados**, e não `Date.now()`. Dois motivos:
o relógio das máquinas de laboratório está errado — foi o assunto inteiro da
task 02 — e uma turma que manda print no mesmo minuto colide. Colidir no
Storage é sobrescrever o anexo de outra pessoa, em silêncio.

### 2. Não trocamos de banco

As alternativas consideradas e o motivo de cada uma ter sido descartada estão
na seção "Alternativas" abaixo. O resumo: trocar de banco jogaria fora
autenticação, Security Rules e tempo real — as três coisas que já funcionam —
para resolver um problema que o Storage resolve em uma task.

### 3. O tipo é decidido pelos magic bytes, no cliente e pelo `contentType` na rule

`validarArquivo` lê os primeiros 12 bytes com `FileReader` e confere a
assinatura (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `47 49 46 38`, WEBP `RIFF`
+ `WEBP` no offset 8). Nem a extensão nem o `type` que o navegador declara
entram na decisão: os dois saem do **nome do arquivo**, e o nome é exatamente o
que quem renomeia um `.exe` para `.png` controla.

A rule não consegue ler o conteúdo do arquivo — nenhuma rule consegue —, então
ela confere `contentType` e tamanho. A divisão é deliberada e as duas pontas
precisam existir: o cliente dá a mensagem em português antes de gastar a banda
da rede do laboratório, e a rule é o que vale para quem trocou o app por um
`curl`.

A lista de formatos é **explícita**, e não `image/.*`: `image/svg+xml` é uma
imagem para o navegador e um documento com script dentro para quem o abre.

### 4. A compressão no cliente é requisito, não otimização

Canvas, lado maior limitado a 1600px, `toBlob` com qualidade 0.85. O que reduz
o custo não é o codec: é o número de pixels. 1600px basta para ler uma mensagem
de erro de compilador num print de tela cheia.

GIF **não** é recomprimido: um canvas desenha um quadro só, e o resultado seria
a imagem parada — sem a animação, que costuma ser o motivo de ela existir. GIF
acima de 5 MB é recusado com mensagem própria, que diz o que fazer.

O formato de saída é o mesmo da entrada. Um print de código em PNG convertido
para JPEG ganha exatamente os artefatos que borram a linha do erro.

### 5. O campo `imagem` não muda de forma nesta versão

A v0.6.0 grava **os dois**: `imagem` continua sendo a string de URL, e `anexo`
é o objeto novo ao lado, com `caminho`, `largura`, `altura`, `bytes` e
`origem`. A leitura entende os dois, permanentemente nesta versão.

`imagem` só sai na 1.0.0. É a migração em duas fases da seção 4 do
`tasks/_PROTOCOLO.md`, e `scripts/migrar-anexos.js` é a etapa do meio.

### 6. O lightbox substitui o `window.open`

`visualizarImagem()` fazia `window.open(url, '_blank')`. Nos laboratórios do
SENAI o bloqueador de pop-up vem ligado por política de imagem do Windows: o
aluno clicava no olho e **nada acontecia** — sem aviso, sem janela, sem erro. O
professor pedia o print de novo e a aula parava ali.

Um diálogo dentro da própria página não depende de permissão nenhuma. O preço é
que ele precisa ser um diálogo de verdade — Esc fecha, foco preso enquanto
aberto, foco devolvido a quem o abriu.

## Alternativas consideradas

### Trocar o Firestore por um banco que guarde binário (o pedido literal)

**Descartada.** O custo não é migrar os dados: é reescrever o que já funciona.
Sairia junto a autenticação (Google, GitHub, e-mail/senha — task 01), as
Security Rules por sala (ADR 0005, ADR 0006) e o tempo real do `onSnapshot`,
que é o que faz o card aparecer na tela do professor enquanto o aluno digita.
Semanas de trabalho, e um servidor para manter, para resolver um problema que
não é do banco.

E o banco novo teria o mesmo problema pela frente: guardar imagem **dentro** de
linha de banco é ruim em qualquer banco. A resposta certa em qualquer stack é
um armazenamento de objetos ao lado — que é o que o Storage é.

### Guardar a imagem em base64 dentro do documento

**Descartada.** Cabe, se a imagem for pequena: o limite é 1 MB por documento e
base64 infla o binário em ~33%. Sobra menos de 750 KB de imagem real, o que
exclui o print de tela cheia — o caso de uso inteiro.

Pior que o limite: `onSnapshot` na fila de chamados baixaria **todas** as
imagens de **todos** os 200 chamados a cada abertura do app, porque elas
estariam nos documentos. Hoje o card baixa a miniatura que ele vai mostrar, e
só. A conta de leitura do Firestore é por documento, mas a de rede é por byte,
e a rede é a do laboratório.

### Um serviço externo de imagem (Imgur, Cloudinary)

**Descartada.** Um print de erro de aluno é dado da escola, e a pergunta "quem
mais pode ver isso?" precisa ter resposta. Num serviço externo a resposta é
"quem tiver o link", e o link não expira. Some a isso mais um segredo para
versionar, mais um domínio para o proxy da escola liberar e mais um serviço
para culpar quando a aula parar.

### Aceitar `image/*` na rule em vez da lista de quatro

**Descartada.** `image/svg+xml` passa por `image/*` e é um documento XML com
`<script>` dentro. Servido do nosso bucket e aberto em aba, ele executa.

## Consequências

**Boas**

- O aluno anexa o print do computador dele, por seletor, arrastando ou com
  Ctrl+V — que é o pedido real por trás de "mudar o banco".
- O anexo é privado por sala. Antes, o caminho global `imagens/{arquivo}` era
  legível por qualquer pessoa autenticada que soubesse o nome do arquivo.
- O clique no anexo passou a fazer alguma coisa em toda máquina, inclusive nas
  que bloqueiam pop-up.
- Excluir o chamado leva o anexo junto (AC-CHAMADO-08). Sem isso, cada chamado
  apagado deixava um arquivo pago e inalcançável no bucket, para sempre.

**Custos aceitos**

- **Mais uma cota para observar.** O Storage tem 5 GB no plano gratuito. A
  estimativa está na seção 8 do `docs/ARQUITETURA.md`: ~120 MB por sala por
  ano, ~1,2 GB para as 10 salas do alvo. Cabe, com margem, e a compressão no
  cliente é o que mantém essa conta de pé.
- **O caminho legado `imagens/{arquivo}` continua legível.** A escrita fechou;
  a leitura não, porque fechá-la apagaria da tela o print de chamados antigos
  (AC-IMG-13). O que está lá continua onde está, e nada novo entra.
- **Órfão ainda é possível.** Se o aluno anexa, o upload conclui e o navegador
  fecha antes de o chamado ser criado, o arquivo fica. É o caso raro que sobrou
  — a varredura periódica do bucket é trabalho de pós-1.0.0, e o custo de um
  arquivo de ~300 KB não justifica uma Cloud Function agora.
- **A validação por magic bytes não é antivírus.** Ela garante que o arquivo
  **começa** como imagem. Um PNG válido com dado escondido depois dos primeiros
  bytes passa. Varredura de conteúdo é serviço pago e está fora do escopo.

## Referências

- `src/services/anexos.js` — a regra inteira, sem interface
- `storage.rules` — o que vale para quem não usa o nosso app
- `docs/ARQUITETURA.md` § 8 — estimativa de consumo do Storage
- `docs/MIGRACOES.md` — `scripts/migrar-anexos.js`
- ADR 0005 — por que tudo é escopado por sala
