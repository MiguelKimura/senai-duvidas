---
id: 04-upload-imagens
titulo: "Upload de imagens do computador, colar e arrastar"
versao_origem: 0.5.0
versao_alvo: 0.6.0
tipo: feat
escopo_commit: anexos
branch: feat/upload-de-imagens
branch_base: dev
depende_de: [00-fundacao-testes, 01-auth-oauth-sessao, 02-tempo-brasilia, 03-salas-pin]
criterios: [AC-IMG-01, AC-IMG-02, AC-IMG-03, AC-IMG-04, AC-IMG-05, AC-IMG-06, AC-IMG-07, AC-IMG-08, AC-IMG-09, AC-IMG-10, AC-IMG-11, AC-IMG-12, AC-IMG-13, AC-SEC-08, AC-CHAMADO-08]
modo: oneshot
permissoes: dangerously-skip-permissions
laco: iterar até todos os critérios verdes
risco: alto
observacao: "O cliente pediu 'mudar o banco pra permitir imagens'. A resposta técnica é usar o Storage corretamente, não trocar de banco."
---

# Você é o engenheiro responsável pela task 04 — Anexos de Imagem

Sessão autônoma no repositório **`MiguelKimura/senai-duvidas`**. Sem instrução adicional de
usuário: conduza do início ao PR.

## Primeiro passo obrigatório

Leia `tasks/_PROTOCOLO.md`, `docs/CRITERIOS-DE-ACEITE.md`, `docs/ROADMAP.md`, `docs/ARQUITETURA.md`
e todo o `src/`. Tasks 00 a 03 entregaram harness, auth, tempo do servidor e salas.
**Nenhum teste anterior pode ser removido ou enfraquecido.**

## O problema que você está resolvendo

Hoje o aluno só consegue anexar imagem **colando uma URL**. Na prática, o aluno tira um print do
erro que apareceu na tela dele — e não tem onde hospedar. Ele acaba descrevendo o erro por escrito,
mal, e o professor perde tempo pedindo detalhe.

O cliente descreveu isso como "mudar o banco de dados pra permitir imagens, porque o Firebase é
burocrático com imagem". **Esclareça isso no PR e no `HISTORICO.md`:** não é preciso trocar de
banco. O Firestore de fato não guarda binário grande (limite de 1 MB por documento), mas o
**Firebase Storage** — que já está inicializado em `src/firebase.js`, com uma função `uploadImage`
que ninguém chama — foi feito exatamente para isso. Trocar de banco custaria semanas e jogaria fora
autenticação, rules e tempo real. Usar o Storage corretamente resolve o pedido real do cliente:
**o aluno consegue anexar uma imagem do computador dele.**

Aproveite e resolva a fragilidade atual: `visualizarImagem()` usa `window.open()`, bloqueado por
padrão em vários navegadores de laboratório — o aluno clica no olho e nada acontece.

## Critérios de aceite deste escopo

- AC-IMG-01 — anexo por **link/URL** continua funcionando. **[REG]**
- AC-IMG-02 — anexo por **seletor de arquivo** do computador.
- AC-IMG-03 — **arrastar e soltar** no modal.
- AC-IMG-04 — **colar (Ctrl+V)** uma captura de tela direto no modal.
- AC-IMG-05 — aceita PNG, JPEG, WEBP e GIF; outros formatos rejeitados com mensagem clara.
- AC-IMG-06 — limite de **5 MB**, validado no cliente **e** nas Storage Rules.
- AC-IMG-07 — imagens acima de 1600px são redimensionadas/comprimidas no cliente antes do upload.
- AC-IMG-08 — barra de progresso e botão de cancelar durante o upload.
- AC-IMG-09 — falha de upload mostra erro acionável e **não perde o texto já digitado**.
- AC-IMG-10 — miniatura no card e **lightbox** ao clicar — sem `window.open()`.
- AC-IMG-11 — anexos em `salas/{salaId}/chamados/{chamadoId}/{arquivo}`, legíveis só por membros.
- AC-IMG-12 — URL externa quebrada mostra placeholder, nunca ícone quebrado do navegador.
- AC-IMG-13 — chamados antigos com `imagem` em string de URL continuam exibindo. **[REG]**
- AC-SEC-08 — tipo MIME validado por **magic bytes**, não pela extensão.
- AC-CHAMADO-08 — excluir chamado remove também os anexos do Storage (sem órfãos).

## Desenho pedido

```
src/services/anexos.js
  validarArquivo(file)      -> {ok, erro} — magic bytes + tamanho + formato
  comprimirImagem(file)     -> Blob (canvas, max 1600px, qualidade 0.85)
  enviarAnexo(file, {salaId, chamadoId, onProgresso, sinal}) -> {url, caminho, largura, altura, bytes}
  removerAnexosDoChamado(salaId, chamadoId)
  ehUrlDeImagem(url)

src/components/CampoAnexo.jsx   -> seletor + drop zone + colar + preview + progresso + cancelar
src/components/Lightbox.jsx     -> visualizador acessível (Esc fecha, foco preso, backdrop)
src/hooks/useColarImagem.js     -> escuta o evento paste no modal
```

**Magic bytes** (AC-SEC-08) — leia os primeiros bytes com `FileReader` e confira a assinatura:
PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `47 49 46 38`, WEBP `52 49 46 46` + `57 45 42 50` no
offset 8. Um `.exe` renomeado para `.png` precisa ser rejeitado.

**Cancelamento** (AC-IMG-08) — guarde a `UploadTask` do Storage e chame `cancel()`; limpe o estado
e permita nova tentativa sem fechar o modal.

**Compressão** (AC-IMG-07) — canvas, lado maior limitado a 1600px, `toBlob` com qualidade 0.85.
GIF **não** é recomprimido (perderia a animação); se passar de 5 MB, rejeite com mensagem própria.

## Formato do campo `imagem` — compatibilidade

Hoje `imagem` é uma **string de URL** (ou `null`). Mudar para objeto quebraria os dados atuais.
Faça assim:

```js
// LEITURA — aceita os dois formatos, sempre
normalizarAnexo(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') return { url: valor, origem: 'url' };  // formato antigo
  return valor;                                                          // formato novo
}

// ESCRITA — grava OS DOIS nesta versão
{
  imagem: anexo.url,        // string — mantém clientes antigos funcionando
  anexo: { url, caminho, origem: 'upload' | 'url', largura, altura, bytes }
}
```

`imagem` só será removido na 1.0.0, depois que todos os clientes tiverem atualizado. Esta é a
etapa 1 da migração em duas fases descrita no `tasks/_PROTOCOLO.md`.

## Integração

- **Task 03:** o caminho do Storage é por sala; a leitura do anexo exige ser membro.
- **Task 02:** o nome do arquivo usa o carimbo do servidor, nunca `Date.now()` do cliente.
- **Task 05:** o `CampoAnexo` vai conviver com o painel de opções avançadas no mesmo modal —
  deixe o `Modal.js` organizado em seções para a próxima task apenas acrescentar a sua.
- **Task 08 (animações):** o lightbox vai receber a transição definitiva lá; entregue aqui com
  uma transição simples baseada nos tokens.
- **Storage Rules:** crie `storage.rules` com teste — tamanho ≤ 5 MB, `contentType` iniciando em
  `image/`, escrita só por membro da sala, leitura só por membro.
- **`src/firebase.js`:** remova a função `uploadImage` órfã (que gravava em `imagens/{nome}`,
  caminho global e com colisão de nome) e aponte tudo para `services/anexos.js`.

## Red-Green-Refactor sugerido

| Ciclo | RED |
|---|---|
| 1 | `validarArquivo` rejeita `.exe` renomeado para `.png` (magic bytes) |
| 2 | `validarArquivo` rejeita > 5 MB com mensagem própria |
| 3 | `validarArquivo` aceita PNG, JPEG, WEBP e GIF |
| 4 | `comprimirImagem` reduz 3000px para 1600px preservando proporção |
| 5 | `comprimirImagem` não recomprime GIF |
| 6 | `enviarAnexo` grava em `salas/{salaId}/chamados/{chamadoId}/` |
| 7 | `enviarAnexo` reporta progresso e pode ser cancelado |
| 8 | Falha de upload preserva a descrição digitada |
| 9 | Drop de arquivo no modal dispara a validação |
| 10 | Colar (paste) com imagem na área de transferência anexa a imagem |
| 11 | Card com `imagem` string antiga renderiza miniatura (retrocompat) |
| 12 | Card com `anexo` objeto novo renderiza miniatura |
| 13 | URL externa que falha ao carregar mostra placeholder |
| 14 | Clicar na miniatura abre o lightbox; Esc fecha; foco volta ao gatilho |
| 15 | Excluir chamado apaga os anexos do Storage |
| 16 | Rule: não-membro recebe negação ao ler o anexo |
| 17 | Rule: upload de 6 MB é negado no servidor mesmo burlando o cliente |

## Compatibilidade

- **Retroativa:** teste explícito com chamado no formato antigo (`imagem` string, sem `anexo`).
- **Futura:** gravação dupla `imagem` + `anexo` comprovada por teste que lê só `imagem`.
- **Migração:** `scripts/migrar-anexos.js` opcional e idempotente, que preenche `anexo` a partir de
  `imagem` nos documentos antigos. Nunca apaga `imagem`.

## Restrições de produção

- Alunos em rede de laboratório: upload precisa funcionar com conexão lenta e falhar de forma
  compreensível, com nova tentativa sem perder o formulário.
- Custo: comprimir no cliente reduz banda e armazenamento — é requisito, não otimização.
- Storage tem cota no plano gratuito; documente em `docs/ARQUITETURA.md` a estimativa de consumo
  (40 alunos × 10 anexos × ~300 KB por sala por ano).

## Documentação

`CHANGELOG.md`, `docs/HISTORICO.md` (**explique por que não trocamos de banco** — é a dúvida
explícita do cliente), `docs/ARQUITETURA.md` e
`docs/adr/0007-firebase-storage-para-anexos.md`.

## Pull Request

Contra `dev`:

```
feat(anexos): permite anexar imagens do computador por upload, arrastar e colar
```

**Versão:** 0.5.0 → 0.6.0 (MINOR — aditivo, com leitura retrocompatível do campo `imagem`)
