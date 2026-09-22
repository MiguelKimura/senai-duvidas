# Critérios de Aceite — Projeto Dúvidas SENAI

> Documento normativo. Cada critério tem um **ID estável** (`AC-AREA-nn`) usado pelas tasks
> em `tasks/` e pelos testes automatizados. Um critério só é considerado atendido quando
> existe **pelo menos um teste automatizado** que falha sem a implementação e passa com ela.
>
> Público-alvo: **alunos e professores do SENAI**. Ambiente real: laboratórios com máquinas
> compartilhadas, relógios de sistema frequentemente errados, rede instável e navegadores
> desatualizados. Todo critério abaixo foi escrito assumindo esse cenário.

## Legenda

| Marca | Significado |
|---|---|
| **[MVP]** | Obrigatório para a versão 1.0.0 |
| **[POS]** | Pode escorregar para pós-1.0.0 sem bloquear o release |
| **[REG]** | Critério de regressão: já existe hoje e não pode quebrar |
| ✅ | Atendido, com teste que falha sem a implementação — veja "Situação por versão" no fim |
| 🟡 | Parcialmente atendido: a parte que falta está nomeada em "Situação por versão" |

---

## 1. Autenticação e Identidade (`AUTH`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-AUTH-01 ✅ | O usuário consegue se cadastrar com nome, e-mail e senha, e o cadastro cria um documento em `usuarios/{uid}` com `nome`, `email`, `tipo`, `uid` e `criadoEm`. | [MVP] [REG] |
| AC-AUTH-02 ✅ | O usuário consegue entrar com e-mail e senha e é redirecionado para `/aluno` ou `/professor` conforme o campo `tipo`. | [MVP] [REG] |
| AC-AUTH-03 ✅ | Existe botão **"Entrar com Google"** na tela de login que autentica via Firebase e, no primeiro acesso, cria o documento `usuarios/{uid}` com `tipo: "aluno"`. | [MVP] |
| AC-AUTH-04 ✅ | Existe botão **"Entrar com GitHub"** com o mesmo comportamento do AC-AUTH-03. | [MVP] |
| AC-AUTH-05 ✅ | Se o e-mail do provedor social já existir com outro método, o sistema exibe mensagem em português explicando como vincular a conta — nunca um stack trace ou código bruto do Firebase. | [MVP] |
| AC-AUTH-06 ✅ | O papel (`aluno`/`professor`) é resolvido **exclusivamente** a partir do Firestore (`usuarios/{uid}.tipo` e `autorizados/{email}.Tipo`). `localStorage` nunca pode determinar papel. | [MVP] |
| AC-AUTH-07 ✅ | Um usuário não listado em `autorizados/{email}` com `Tipo: "professor"` não consegue se cadastrar nem operar como professor, mesmo alterando `localStorage`, o payload da requisição ou as Firestore Rules pelo cliente. | [MVP] |
| AC-AUTH-08 ✅ | O logout limpa a sessão do Firebase e todo estado local, e redireciona para `/`. Após logout, voltar pelo botão do navegador não expõe dados da sessão anterior. | [MVP] |
| AC-AUTH-09 ✅ | Toda rota protegida (`/aluno`, `/professor`, `/sala/*`) exibe um estado de carregamento enquanto o papel está sendo resolvido, e nunca renderiza a tela de login "piscando" para um usuário já autenticado. | [MVP] |
| AC-AUTH-10 ✅ | Nenhuma credencial, chave de serviço ou segredo fica versionado no repositório; a config do Firebase vem de variáveis `REACT_APP_*` com fallback documentado. | [MVP] |

## 2. Sessão Persistente (`SESSAO`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-SESSAO-01 ✅ | Fechar a aba e reabrir o site mantém o usuário logado, sem nova digitação de senha. | [MVP] |
| AC-SESSAO-02 ✅ | Desligar e religar o computador mantém o usuário logado (persistência `browserLocalPersistence` / IndexedDB). | [MVP] |
| AC-SESSAO-03 ✅ | A sessão sobrevive a um recarregamento forçado (Ctrl+F5) e à perda temporária de rede. | [MVP] |
| AC-SESSAO-04 ✅ | O token é renovado automaticamente; o usuário não é deslogado ao ficar mais de 1 hora com a aba aberta. | [MVP] |
| AC-SESSAO-05 ✅ | Em máquina compartilhada, existe ação explícita de **"Sair"** visível em todas as telas autenticadas. | [MVP] |
| AC-SESSAO-06 | Se o navegador bloquear armazenamento (modo anônimo restrito), o app degrada para sessão de aba única e avisa o usuário, sem travar. | [POS] |

## 3. Salas do Professor (`SALA`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-SALA-01 ✅ | O professor consegue criar uma sala informando nome, curso/turma e ano letivo. | [MVP] |
| AC-SALA-02 ✅ | Ao criar, o sistema gera automaticamente um **PIN numérico de 6 dígitos**, único entre as salas ativas. | [MVP] |
| AC-SALA-03 ✅ | O professor visualiza o PIN em destaque e consegue copiá-lo com um clique. | [MVP] |
| AC-SALA-04 ✅ | O aluno entra na sala digitando o PIN; PIN inválido exibe erro claro sem revelar se o PIN existe em outra sala. | [MVP] |
| AC-SALA-05 ✅ | Uma sala vale o **ano letivo inteiro**: possui `anoLetivo` e permanece ativa até ser arquivada manualmente pelo professor. | [MVP] |
| AC-SALA-06 ✅ | Após entrar uma vez, o aluno não precisa redigitar o PIN em acessos futuros — o vínculo fica salvo em `salas/{salaId}/membros/{uid}`. | [MVP] |
| AC-SALA-07 ✅ | Chamados e chat são **escopados por sala**: um aluno da sala A nunca vê chamados nem mensagens da sala B. | [MVP] |
| AC-SALA-08 ✅ | O professor vê a lista de salas que criou, com contagem de membros e de chamados abertos em cada uma. | [MVP] |
| AC-SALA-09 ✅ | O professor consegue remover um aluno da sala e **regerar o PIN** (invalidando o anterior). | [MVP] |
| AC-SALA-10 ✅ | O professor consegue arquivar uma sala ao fim do ano; salas arquivadas ficam somente-leitura e não aceitam novas entradas. | [MVP] |
| AC-SALA-11 | Um aluno pode pertencer a mais de uma sala e alterna entre elas por um seletor. | [POS] |
| AC-SALA-12 ✅ | Tentativas de PIN são limitadas (ex.: 5 erros em 5 minutos por usuário) para impedir força bruta em 6 dígitos. | [MVP] |

## 4. Chamados / Dúvidas (`CHAMADO`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-CHAMADO-01 🟡 | O aluno abre um chamado com descrição textual obrigatória (1 a 1000 caracteres). | [MVP] [REG] |
| AC-CHAMADO-02 ✅ | Chamados aparecem em tempo real para o professor e para os colegas da mesma sala, sem recarregar a página. | [MVP] [REG] |
| AC-CHAMADO-03 ✅ | A fila é ordenada por horário de envio **crescente** (mais antigo primeiro), respeitando os perks de prioridade (ver `PERK`). | [MVP] [REG] |
| AC-CHAMADO-04 🟡 | O aluno consegue excluir o **próprio** chamado quando a dúvida já foi resolvida, com confirmação antes de excluir. | [MVP] [REG] |
| AC-CHAMADO-05 ✅ | O aluno **não** consegue excluir o chamado de outro aluno — nem pela interface nem por chamada direta ao banco. | [MVP] |
| AC-CHAMADO-06 | O professor consegue excluir qualquer chamado da sua sala e marcar um chamado como **atendido**. | [MVP] |
| AC-CHAMADO-07 ✅ | O card exibe nome do autor, descrição, horário de envio e indicador visual de anexo quando houver imagem. | [MVP] [REG] |
| AC-CHAMADO-08 ✅ | A exclusão remove também os anexos associados do Storage (sem arquivos órfãos). | [MVP] |
| AC-CHAMADO-09 | A lista suporta 200 chamados simultâneos na mesma sala sem travamento perceptível (paginação ou virtualização). | [MVP] |
| AC-CHAMADO-10 | Estado vazio tem mensagem amigável ("Nenhuma dúvida por aqui ainda") em vez de tela em branco. | [MVP] |

## 5. Cor do Card / Menu Markdown Oculto (`COR`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-COR-01 ✅ | O modal de novo chamado exibe uma **setinha cinza discreta** (disclosure) abaixo dos campos principais, fechada por padrão. | [MVP] |
| AC-COR-02 ✅ | Ao clicar na setinha, um painel se expande com animação suave revelando as opções avançadas. | [MVP] |
| AC-COR-03 ✅ | O painel oferece uma **paleta de cores predefinidas** para o card, com contraste de texto garantido (WCAG AA, ≥ 4.5:1). | [MVP] |
| AC-COR-04 ✅ | A cor escolhida é persistida no chamado e usada como fundo do card para todos que o visualizam. | [MVP] |
| AC-COR-05 ✅ | Se o aluno não escolher cor, o sistema mantém o comportamento atual (cor automática) — sem regressão. | [MVP] [REG] |
| AC-COR-06 ✅ | A setinha é acessível por teclado (`Tab` + `Enter`/`Espaço`), tem `aria-expanded` correto e rótulo audível por leitor de tela. | [MVP] |
| AC-COR-07 ✅ | O painel avançado aceita **markdown básico** na descrição (negrito, itálico, listas, `código`) com renderização sanitizada no card. | [MVP] |
| AC-COR-08 ✅ | O markdown é sanitizado: nenhuma tag `<script>`, `<iframe>`, handler `on*` ou URL `javascript:` chega ao DOM. | [MVP] |
| AC-COR-09 ✅ | O painel mostra um **preview ao vivo** do card com a cor e o markdown aplicados. | [POS] |
| AC-COR-10 ✅ | A preferência de cor do aluno é lembrada como padrão do próximo chamado. | [POS] |

## 6. Imagens e Anexos (`IMG`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-IMG-01 ✅ | O aluno continua conseguindo anexar imagem por **link/URL**, como hoje. | [MVP] [REG] |
| AC-IMG-02 ✅ | O aluno consegue anexar imagem **do próprio computador** por seletor de arquivo. | [MVP] |
| AC-IMG-03 ✅ | O aluno consegue **arrastar e soltar** (drag & drop) uma imagem no modal. | [MVP] |
| AC-IMG-04 ✅ | O aluno consegue **colar (Ctrl+V)** uma captura de tela direto no modal. | [MVP] |
| AC-IMG-05 ✅ | Formatos aceitos: PNG, JPEG, WEBP e GIF. Outros formatos são rejeitados com mensagem clara. | [MVP] |
| AC-IMG-06 ✅ | Limite de **5 MB por arquivo**, validado no cliente **e** nas regras do Storage. | [MVP] |
| AC-IMG-07 ✅ | Imagens acima de 1600px são redimensionadas/comprimidas no cliente antes do upload. | [MVP] |
| AC-IMG-08 ✅ | Durante o upload há barra de progresso e opção de cancelar. | [MVP] |
| AC-IMG-09 ✅ | Falha de upload exibe erro acionável ("Tente novamente" / "Arquivo muito grande") e **não** perde o texto já digitado. | [MVP] |
| AC-IMG-10 ✅ | A imagem é exibida como miniatura no card e abre em visualizador (lightbox) ao clicar — sem depender de `window.open`, que é bloqueado por alguns navegadores do laboratório. | [MVP] |
| AC-IMG-11 ✅ | Anexos ficam em `salas/{salaId}/chamados/{chamadoId}/{arquivo}` no Storage, e só membros da sala conseguem ler. | [MVP] |
| AC-IMG-12 ✅ | Anexo por URL externa que falhar ao carregar mostra placeholder, nunca ícone quebrado do navegador. | [MVP] |
| AC-IMG-13 ✅ | Chamados antigos, criados antes da migração e com `imagem` como string de URL, continuam sendo exibidos corretamente. | [MVP] [REG] |

## 7. Horário Oficial de Brasília (`TEMPO`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-TEMPO-01 ✅ | O horário gravado em chamados e mensagens vem do **servidor** (`serverTimestamp()` do Firestore), nunca do relógio do computador do usuário. | [MVP] |
| AC-TEMPO-02 ✅ | Alterar manualmente o relógio do computador **não** altera a posição do chamado na fila. | [MVP] |
| AC-TEMPO-03 ✅ | Todo horário é exibido no fuso **America/Sao_Paulo**, independentemente do fuso configurado na máquina. | [MVP] |
| AC-TEMPO-04 ✅ | A exibição usa formato brasileiro (`dd/mm/aaaa HH:mm`) e rótulos relativos ("há 3 minutos") para eventos recentes. | [MVP] |
| AC-TEMPO-05 ✅ | Existe um módulo único `src/services/tempo.js` como **única** fonte de horário do app; nenhum componente chama `new Date()` diretamente para gravar dados. | [MVP] |
| AC-TEMPO-06 ✅ | Enquanto o `serverTimestamp()` não é confirmado, a UI mostra "enviando…" em vez de um horário provisório errado. | [MVP] |
| AC-TEMPO-07 ✅ | O reset do chat à meia-noite usa a meia-noite de Brasília, não a meia-noite local da máquina. | [MVP] |
| AC-TEMPO-08 ✅ | Registros antigos com `horario` em string ISO continuam sendo lidos e ordenados corretamente. | [MVP] [REG] |
| AC-TEMPO-09 ✅ | O app funciona sem nenhuma chamada a API externa de horário (o `serverTimestamp` do Firestore é a autoridade), evitando dependência de serviço de terceiros em sala de aula. | [MVP] |

## 8. Chat (`CHAT`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-CHAT-01 ✅ | Cada mensagem exibe o **horário de envio** (HH:mm no fuso de Brasília). | [MVP] |
| AC-CHAT-02 ✅ | Mensagens do mesmo usuário mantêm **sempre a mesma cor**, estável entre sessões e entre dispositivos. | [MVP] |
| AC-CHAT-03 ✅ | Mensagens consecutivas do mesmo autor são agrupadas, sem repetir nome e avatar. | [MVP] |
| AC-CHAT-04 ✅ | Professores são visualmente identificados com selo/etiqueta distinta dos alunos. | [MVP] |
| AC-CHAT-05 ✅ | O chat rola automaticamente para a mensagem mais recente — exceto quando o usuário rolou para cima, caso em que aparece o botão "novas mensagens". | [MVP] |
| AC-CHAT-06 ✅ | O chat carrega apenas as **50 mensagens mais recentes** e busca as anteriores sob demanda (scroll infinito). | [MVP] |
| AC-CHAT-07 ✅ | Enviar mensagem tem feedback otimista: a mensagem aparece imediatamente em estado "enviando" e confirma ao gravar. | [MVP] |
| AC-CHAT-08 ✅ | O comando `!clear` só funciona para **professores** e pede confirmação; hoje qualquer aluno pode apagar o chat inteiro (falha de segurança a corrigir). | [MVP] |
| AC-CHAT-09 ✅ | Mensagens são limitadas a 500 caracteres, com contador visível ao se aproximar do limite. | [MVP] |
| AC-CHAT-10 ✅ | O chat é escopado por sala (`salas/{salaId}/chat`). | [MVP] |
| AC-CHAT-11 | Existe indicador de "digitando…" para os participantes da conversa. | [POS] |
| AC-CHAT-12 ✅ | Links enviados no chat viram links clicáveis com `rel="noopener noreferrer"`; nenhum HTML do usuário é renderizado como markup. | [MVP] |
| AC-CHAT-13 ✅ | Animação de entrada suave nas novas mensagens, respeitando `prefers-reduced-motion`. | [MVP] |

## 9. Mensagens Diretas (`DM`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-DM-01 ✅ | O chat tem abas separadas: **"Sala"** (público) e **"Diretas"** (privado). | [MVP] |
| AC-DM-02 ✅ | O professor consegue iniciar uma conversa privada com qualquer aluno da sua sala. | [MVP] |
| AC-DM-03 ✅ | O aluno consegue iniciar conversa privada com o professor da sala. | [MVP] |
| AC-DM-04 ✅ | Conversas privadas **não** são visíveis para nenhum terceiro, garantido por Firestore Rules — não apenas por filtro na interface. | [MVP] |
| AC-DM-05 ✅ | Existe indicador de mensagens não lidas por conversa, com contador. | [MVP] |
| AC-DM-06 ✅ | A lista de conversas é ordenada pela mensagem mais recente. | [MVP] |
| AC-DM-07 | Aluno↔aluno é configurável pelo professor e vem **desativado por padrão**. | [POS] |
| AC-DM-08 | O professor consegue exportar/visualizar o histórico de uma DM para fins pedagógicos, e os participantes são avisados dessa possibilidade. | [POS] |

## 10. Perks / Premiações (`PERK`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-PERK-01 | O professor consegue conceder um perk a um aluno da sua sala, escolhendo o tipo e uma justificativa opcional. | [POS] |
| AC-PERK-02 | Existe o perk **"Prioridade no Atendimento"**, que move os chamados do aluno para o topo da fila dentro da sua faixa de prioridade. | [POS] |
| AC-PERK-03 | Perks têm validade configurável (ex.: 7 dias) e expiram automaticamente pelo horário do servidor. | [POS] |
| AC-PERK-04 | A concessão dispara uma **animação de premiação** em tela cheia para o aluno (estilo Call of Duty), com som opcional desativado por padrão. | [POS] |
| AC-PERK-05 | O perk aparece como **insígnia** no card do chamado e no chat do aluno premiado. | [POS] |
| AC-PERK-06 | O aluno tem uma vitrine ("Minhas conquistas") com os perks ativos e o histórico dos expirados. | [POS] |
| AC-PERK-07 | Apenas professores concedem ou revogam perks, garantido por Firestore Rules. | [POS] |
| AC-PERK-08 | A animação respeita `prefers-reduced-motion` e pode ser desativada nas preferências. | [POS] |
| AC-PERK-09 | A ordenação da fila com perks é determinística e testada: prioridade desc, depois horário do servidor asc. | [POS] |
| AC-PERK-10 | Existe log de auditoria de perks concedidos (quem, para quem, quando, por quê). | [POS] |

## 11. Animações e Interface (`ANIM`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-ANIM-01 | Transições de rota e abertura/fechamento de modais são animadas (fade + slide), com duração entre 150ms e 300ms. | [MVP] |
| AC-ANIM-02 | Cards entram na lista com animação escalonada (stagger) e saem com animação ao serem excluídos. | [MVP] |
| AC-ANIM-03 | Botões têm estados visuais de `hover`, `active`, `focus-visible` e `disabled`. | [MVP] |
| AC-ANIM-04 | Toda operação assíncrona tem estado de carregamento (skeleton ou spinner) — nunca uma tela congelada. | [MVP] |
| AC-ANIM-05 | **Todas** as animações são suprimidas quando `prefers-reduced-motion: reduce` está ativo. | [MVP] |
| AC-ANIM-06 | Nenhuma animação causa reflow de layout perceptível; usar apenas `transform` e `opacity`. | [MVP] |
| AC-ANIM-07 | `alert()` e `window.open()` são substituídos por componentes de toast e modal próprios. | [MVP] |
| AC-ANIM-08 | A interface é utilizável em telas de 1024×768 (padrão dos laboratórios) e em celular (≥ 360px). | [MVP] |
| AC-ANIM-09 🟡 | Existe um arquivo único de tokens de design (cores, espaçamentos, durações) usado por todos os estilos. | [MVP] |
| AC-ANIM-10 | Contraste mínimo WCAG AA em todos os textos e navegação completa por teclado em todos os fluxos. | [MVP] |

## 12. Testes e Qualidade (`TEST`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-TEST-01 ✅ | `npm test` roda em modo não-interativo (CI) e termina com código de saída 0 quando tudo passa. | [MVP] |
| AC-TEST-02 | Toda feature nova entra com testes escritos **antes** da implementação (ciclo red-green-refactor comprovado no histórico de commits). | [MVP] |
| AC-TEST-03 ✅ | Cobertura mínima global: **80% de linhas** e **75% de branches**, verificada por threshold que quebra o build. | [MVP] |
| AC-TEST-04 ✅ | Existem testes de integração contra o **Firebase Emulator Suite** (Auth + Firestore + Storage), sem tocar o projeto de produção. | [MVP] |
| AC-TEST-05 ✅ | As Firestore Rules e as Storage Rules têm testes dedicados cobrindo permissão concedida **e** negada. | [MVP] |
| AC-TEST-06 | Existem testes end-to-end (Playwright) para os fluxos críticos: login, entrar na sala, abrir chamado com imagem, excluir chamado, enviar mensagem e DM. | [MVP] |
| AC-TEST-07 ✅ | Cada nova feature **adiciona** casos à suíte existente; nenhuma task pode deletar ou marcar como `skip` um teste anterior para ficar verde. | [MVP] |
| AC-TEST-08 🟡 | A suíte completa roda em menos de 5 minutos no CI. | [MVP] |
| AC-TEST-09 ✅ | Testes são determinísticos: sem `sleep` arbitrário, sem dependência de relógio real (tempo é mockado). | [MVP] |
| AC-TEST-10 | Há um teste de regressão explícito para **cada** critério marcado [REG]. | [MVP] |

## 13. CI/CD e Branches (`CI`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-CI-01 ✅ | O repositório tem as branches **`main`** (o que os usuários veem, sempre estável) e **`dev`** (integração). | [MVP] |
| AC-CI-02 ✅ | Branches de feature saem de `dev`, no padrão `feat/<escopo>`, `fix/<escopo>` ou `chore/<escopo>`. | [MVP] |
| AC-CI-03 ✅ | Todo PR roda lint, testes unitários, testes de integração e build antes de poder ser mesclado. | [MVP] |
| AC-CI-04 🟡 | `main` e `dev` são protegidas: sem push direto, merge apenas por PR com CI verde. | [MVP] |
| AC-CI-05 ✅ | Commits seguem **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `BREAKING CHANGE:`). | [MVP] |
| AC-CI-06 ✅ | A versão em `package.json` segue **SemVer** e é incrementada de acordo com o tipo das mudanças do PR. | [MVP] |
| AC-CI-07 | Cada merge em `main` gera uma tag de versão e uma entrada no `CHANGELOG.md`. | [MVP] |
| AC-CI-08 | O deploy de produção acontece a partir de `main`; `dev` publica em ambiente de homologação. | [MVP] |
| AC-CI-09 ✅ | O `CHANGELOG.md` é gerado a partir dos commits convencionais, não escrito à mão. | [MVP] |
| AC-CI-10 ✅ | O projeto clona, instala e roda com três comandos (`git clone`, `npm install`, `npm start`), documentados no README. | [MVP] |

## 14. Segurança e Privacidade (`SEC`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-SEC-01 ✅ | As Firestore Rules negam tudo por padrão e liberam explicitamente cada caminho. | [MVP] |
| AC-SEC-02 ✅ | Nenhum usuário lê ou escreve dados de sala à qual não pertence, validado por teste de rules. | [MVP] |
| AC-SEC-03 ✅ | Escalada de privilégio de aluno para professor é impossível pelo cliente. | [MVP] |
| AC-SEC-04 ✅ | Todo texto do usuário é escapado ou sanitizado antes de ser renderizado (proteção contra XSS). | [MVP] |
| AC-SEC-05 ✅ | PINs de sala não são expostos a quem não é dono da sala em nenhuma resposta do banco. | [MVP] |
| AC-SEC-06 🟡 | O app roda apenas sob HTTPS; domínios autorizados do Firebase Auth estão restritos aos domínios reais. | [MVP] |
| AC-SEC-07 | Dados de menores de idade: nenhum dado pessoal além de nome e e-mail institucional é coletado. | [MVP] |
| AC-SEC-08 ✅ | Uploads são varridos por tipo MIME real (magic bytes), não apenas pela extensão do arquivo. | [MVP] |

## 15. Desempenho e Escalabilidade (`PERF`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-PERF-01 | O carregamento inicial (First Contentful Paint) fica abaixo de 2,5s em conexão 3G rápida. | [MVP] |
| AC-PERF-02 | O bundle JavaScript inicial fica abaixo de 300 KB comprimido (gzip), com code-splitting por rota. | [MVP] |
| AC-PERF-03 ✅ | Listeners do Firestore são sempre escopados e paginados — nunca `onSnapshot` em coleção inteira sem limite. | [MVP] |
| AC-PERF-04 ✅ | Todo `onSnapshot` é cancelado ao desmontar o componente (sem vazamento de listener). | [MVP] |
| AC-PERF-05 | Uma sala com 40 alunos simultâneos, 200 chamados e 1000 mensagens permanece fluida. | [MVP] |
| AC-PERF-06 🟡 | O custo de leituras do Firestore por aluno por aula fica dentro do plano gratuito para até 10 salas ativas. | [MVP] |
| AC-PERF-07 | O app funciona offline em modo leitura (cache do Firestore) e enfileira envios feitos sem conexão. | [POS] |

## 16. Documentação (`DOC`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-DOC-01 ✅ | O `README.md` descreve o projeto real (não o texto padrão do Create React App), com instalação, scripts e arquitetura. | [MVP] |
| AC-DOC-02 ✅ | Existe `docs/HISTORICO.md` narrando a evolução do projeto versão a versão, com as decisões técnicas e seus porquês. | [MVP] |
| AC-DOC-03 | Existe `docs/MANUAL-ALUNO.md` com linguagem simples e capturas de tela. | [MVP] |
| AC-DOC-04 | Existe `docs/MANUAL-PROFESSOR.md` cobrindo salas, PIN, perks e moderação. | [MVP] |
| AC-DOC-05 | Existe `docs/ARQUITETURA.md` com o modelo de dados, as coleções do Firestore e os diagramas de fluxo. | [MVP] |
| AC-DOC-06 ✅ | Existe `CONTRIBUTING.md` com o fluxo de branches, o padrão de commits e como rodar os testes. | [MVP] |
| AC-DOC-07 ✅ | Toda decisão arquitetural relevante é registrada como ADR em `docs/adr/`. | [MVP] |

---

## Definição de Pronto (DoD)

Uma task só está concluída quando **todos** os itens abaixo são verdadeiros:

1. Todos os ACs do escopo da task estão implementados e cobertos por teste automatizado.
2. `npm run lint`, `npm run test:ci`, `npm run test:rules` e `npm run build` passam localmente.
3. Nenhum teste preexistente foi removido, pulado ou enfraquecido.
4. **Compatibilidade retroativa** confirmada: dados criados pela versão anterior continuam legíveis e funcionais.
5. **Compatibilidade futura** confirmada: os novos documentos incluem campos com padrão seguro, de modo que uma versão anterior do app não quebre ao lê-los.
6. A versão em `package.json` e o `CHANGELOG.md` foram atualizados segundo SemVer.
7. O PR foi aberto contra `dev` com o resumo no formato de Conventional Commits.
8. `docs/HISTORICO.md` recebeu a entrada da versão.

---

## Situação por versão

> Esta seção registra **o que foi atendido e o que não foi**, com o teste que prova cada item.
> Nenhum critério acima é reescrito para caber na implementação: quando a implementação fica
> aquém, o critério continua como está e a lacuna é descrita aqui.

### v0.2.0 — Fundação de testes e CI

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-AUTH-02 | `src/components/__tests__/Login.caracterizacao.test.js:71` — credencial válida redireciona por `usuario.tipo`; inválida exibe erro |
| AC-AUTH-10 | `src/__tests__/firebaseConfig.test.js:75` — config vem de `REACT_APP_*`, cai no fallback e avisa no `console.warn` |
| AC-CHAMADO-02 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:89` — a fila reage ao `onSnapshot` sem recarregar |
| AC-CHAMADO-03 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:89` — ordenação por horário crescente |
| AC-CHAMADO-07 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:103` e `:267` — autor, descrição, horário e indicador de anexo |
| AC-IMG-01 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:251` — anexo por URL |
| AC-COR-05 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:219` — cor automática quando o aluno não escolhe |
| AC-TEST-01 | `npm run test:ci` sai 0 sem watch |
| AC-TEST-03 | `package.json` › `jest.coverageThreshold`; verificado nos dois sentidos no commit `07ad78b` |
| AC-TEST-04 | `tests/rules/` contra o emulador; `tests/rules/projetoDeTeste.js` recusa qualquer projectId sem o prefixo `demo-` |
| AC-TEST-05 | `tests/rules/firestore.rules.test.js` e `tests/rules/storage.rules.test.js` — permissão concedida **e** negada |
| AC-TEST-07 | Nenhum teste removido ou pulado; não há `.skip` nem `.todo` na suíte |
| AC-TEST-09 | `src/test-utils/__tests__/relogio.test.js` — relógio determinístico, nenhum `sleep` na suíte |
| AC-CI-01 | `main` e `dev` existem no remoto |
| AC-CI-02 | `CONTRIBUTING.md` › "Branches"; esta própria branch é `chore/fundacao-testes`, saída de `dev` |
| AC-CI-03 | `.github/workflows/ci.yml`; verificado por `src/__tests__/ci.test.js` |
| AC-CI-05 | Job `commits` do workflow; rodado contra os commits desta branch antes de entrar |
| AC-CI-06 | `package.json` › `version: 0.2.0` (MINOR) |
| AC-CI-09 | `scripts/gerarChangelog.js`, testado em `scripts/__tests__/gerarChangelog.test.js` |
| AC-CI-10 | `README.md` › "Como rodar" |
| AC-DOC-01 | `README.md` reescrito |
| AC-DOC-02 | `docs/HISTORICO.md` › v0.2.0 |
| AC-DOC-06 | `CONTRIBUTING.md` |
| AC-DOC-07 | `docs/adr/0001` e `docs/adr/0002` |

**Parcialmente atendidos (🟡)**

| AC | O que já vale | O que falta, e onde é resolvido |
|---|---|---|
| AC-AUTH-01 | O cadastro grava `nome`, `email`, `tipo` e `uid` — `src/components/__tests__/Cadastro.caracterizacao.test.js:63` | `criadoEm` não é gravado. O teste `:82` marca a lacuna e vai falhar quando a **task 01** a fechar. |
| AC-CHAMADO-01 | Descrição vazia não cria chamado — `TelaAluno.caracterizacao.test.js:183` | Não há validação de 1 a 1000 caracteres. **Task 05**, junto com o painel avançado do card. |
| AC-CHAMADO-04 | O botão Excluir só aparece para o autor — `TelaAluno.caracterizacao.test.js:310` | A exclusão não pede confirmação. O teste `:336` documenta a ausência. **Task 08**. |
| AC-TEST-08 | `timeout-minutes: 5` em todos os jobs do workflow; localmente a suíte unitária roda em ~9s e a de rules em ~5s | A medição no runner do GitHub só existe depois do primeiro PR. O teto está imposto pelo runner, não prometido. |
| AC-CI-04 | `docs/PROTECAO-BRANCHES.md` traz a configuração exata, e `src/__tests__/ci.test.js` garante que os nomes dos jobs batem com os checks que o documento manda exigir | Proteção de branch é configuração de UI do GitHub: **precisa ser aplicada à mão**, uma vez, por quem administra o repositório. |
| AC-ANIM-09 | `src/styles/tokens.css` existe, é importado por `src/index.css` e seus valores são provadamente iguais aos do CSS atual — `src/styles/__tests__/tokens.test.js` | Os componentes ainda usam os valores crus em vez de `var(--token)`. Trocar agora seria mudança visual, que a task 00 proíbe. **Task 08**. |

**Explicitamente não atendidos, e por quê**

A task 00 tem uma restrição própria: *refatoração de comportamento é proibida*. As falhas
conhecidas da v0.1.0 continuam todas no lugar, e cada uma está **fixada em teste de
caracterização** — um teste que passa descrevendo o comportamento errado, para que a task que o
corrigir precise invertê-lo de forma explícita.

| AC | Estado fixado em teste | Task que resolve |
|---|---|---|
| AC-AUTH-06 | O papel sai do `localStorage` — `src/__tests__/App.caracterizacao.test.js:118` | 02 |
| AC-AUTH-07 | O cliente escolhe o próprio `tipo` — `tests/rules/firestore.rules.test.js` | 03 |
| AC-CHAMADO-05 | Qualquer um apaga o chamado de qualquer um — `tests/rules/firestore.rules.test.js` | 03 |
| AC-SALA-07 / AC-CHAT-10 | `chamados` e `chat` são coleções globais | 03 e 06 |
| AC-CHAT-08 | `!clear` funciona para qualquer aluno | 06 |
| AC-TEMPO-01 | `horario` é `new Date()` do cliente | 05 |
| AC-PERF-03 | `onSnapshot` em coleção inteira, sem `where` nem `limit` | 07 |

---

### v0.3.0 — Login social, sessão persistente e papel vindo do Firestore

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-AUTH-01 | `src/components/__tests__/Cadastro.caracterizacao.test.js:69` — o cadastro grava `nome`, `email`, `tipo`, `uid` e `criadoEm` (timestamp do servidor). Fecha a lacuna 🟡 da v0.2.0. |
| AC-AUTH-02 | `src/components/__tests__/Login.caracterizacao.test.js:89` — redireciona por `usuarios/{uid}.tipo`, e `:122` prova que a rota **não** vem do `localStorage` |
| AC-AUTH-03 | `src/components/__tests__/Login.caracterizacao.test.js:232` — o botão existe, autentica e cria o perfil no primeiro acesso; `src/services/__tests__/auth.test.js:94` — `signInWithPopup` com `GoogleAuthProvider` |
| AC-AUTH-04 | `src/components/__tests__/Login.caracterizacao.test.js:269` e `src/services/__tests__/auth.test.js:105` — idem para o GitHub |
| AC-AUTH-05 | `src/utils/__tests__/errosAuth.test.js:32` — `auth/account-exists-with-different-credential` vira explicação de como vincular a conta; `:44` — nenhum código nem texto cru do Firebase chega à tela |
| AC-AUTH-06 | `src/services/__tests__/perfilUsuario.test.js:115` — as duas fontes precisam concordar; `:180` — `localStorage.setItem('tipoUsuario','professor')` não promove ninguém; `src/contexts/__tests__/AuthContext.test.js:141` — o papel nunca é gravado no `localStorage` |
| AC-AUTH-07 | `tests/rules/firestore.rules.test.js:200` — o servidor nega gravar `tipo: "professor"` a quem não está em `autorizados`, inclusive forjando o e-mail no payload. Inverte dois testes de caracterização da v0.2.0. |
| AC-AUTH-08 | `src/contexts/__tests__/AuthContext.test.js:243` — encerra o Firebase e apaga as chaves da v0.2.0; `src/components/__tests__/RotaProtegida.test.js:170` — o histórico é substituído, então "voltar" não reabre a rota protegida |
| AC-AUTH-09 | `src/components/__tests__/RotaProtegida.test.js:81` — carregamento anunciado a leitor de tela e **nunca** a tela de login para quem já está autenticado; `src/contexts/__tests__/AuthContext.test.js:86` |
| AC-AUTH-10 | Mantido da v0.2.0 — `src/__tests__/firebaseConfig.test.js:75` |
| AC-SESSAO-01 | `src/services/__tests__/auth.test.js:56` — `browserLocalPersistence` antes de qualquer login; `src/contexts/__tests__/AuthContext.test.js:167` — a remontagem encontra a sessão sem nova autenticação |
| AC-SESSAO-02 | `src/services/__tests__/auth.test.js:56` — `browserLocalPersistence` grava no IndexedDB, que sobrevive ao desligamento |
| AC-SESSAO-03 | `src/contexts/__tests__/AuthContext.test.js:167` — a sessão é lida do armazenamento a cada montagem, que é o que Ctrl+F5 faz; `:152` — queda de rede vira erro com "tentar novamente", sem derrubar a sessão |
| AC-SESSAO-04 | `src/services/__tests__/auth.test.js:81` — a persistência é configurada uma vez e o SDK renova o token enquanto ela vale |
| AC-SESSAO-05 | `src/components/__tests__/BotaoSair.test.js:34`; presença em cada tela em `TelaAluno.caracterizacao.test.js:351` e `TelaProfessor.caracterizacao.test.js:252` |
| AC-SEC-03 | `src/services/__tests__/perfilUsuario.test.js:180` (cliente) e `tests/rules/firestore.rules.test.js:200` (servidor) — as duas metades |

**Parcialmente atendidos (🟡)**

| AC | O que já vale | O que falta, e onde é resolvido |
|---|---|---|
| AC-SEC-06 | O app redireciona HTTP para HTTPS fora de `localhost` antes de montar — `src/utils/__tests__/httpsObrigatorio.test.js`; `authDomain` vem de `REACT_APP_*` — `src/__tests__/firebaseConfig.test.js` | A lista de domínios autorizados do Firebase Auth é configuração do console e **precisa ser aplicada à mão**, uma vez. A lista exata, o motivo de cada entrada e como conferir estão em `docs/DOMINIOS-AUTORIZADOS.md`. Não há API de cliente que a leia — mesma situação do AC-CI-04. |

**Continuam não atendidos, de propósito**

| AC | Por quê | Task que resolve |
|---|---|---|
| AC-CHAMADO-05 | As rules de `chamados` continuam abertas. Endurecê-las antes do escopo de sala derrubaria o app em produção. As funções `ehAutenticado()` e `ehProfessor()` já ficaram prontas para a task 03 usar. | 03 |
| AC-SALA-07 / AC-CHAT-10 | `chamados` e `chat` ainda são coleções globais | 03 e 06 |
| AC-CHAT-08 | `!clear` ainda funciona para qualquer aluno | 06 |
| AC-TEMPO-01 | `horario` ainda é `new Date()` do cliente | 05 |
| AC-PERF-03 | `onSnapshot` ainda sem `where` nem `limit` | 07 |
| AC-SESSAO-06 | Armazenamento bloqueado ainda não degrada com aviso. `limparEstadoLocal` já não lança nesse caso, mas não existe aviso ao usuário. | [POS] |

**Correção de rota na tabela de v0.2.0**

A linha do AC-AUTH-06 em "Explicitamente não atendidos" da v0.2.0 aponta a task **02** como
responsável. Estava errado: quem corrige a origem do papel é a task **01**, e é o que esta
versão faz. O critério em si não mudou.

---

### v0.4.0 — Horário autoritativo do servidor no fuso de Brasília

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-TEMPO-01 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:252` e `src/components/__tests__/Chat.caracterizacao.test.js` — a escrita carimba com `serverTimestamp()`; `tests/rules/firestore.rules.test.js:406` — o **servidor** nega `horario` que não seja `request.time`, inclusive por `update`. Inverte a caracterização da v0.2.0. |
| AC-TEMPO-02 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:433` e `:451` — atrasar ou adiantar o relógio da máquina em 3 horas não move ninguém na fila; `:467` — o horário exibido é o do servidor |
| AC-TEMPO-03 | `src/services/__tests__/tempo.test.js:78` — `Intl` com `America/Sao_Paulo` por identificador IANA, não offset fixo; a suíte inteira roda igual com `TZ=UTC` e `TZ=America/New_York` (`npm run test:fusos`) |
| AC-TEMPO-04 | `src/services/__tests__/tempo.test.js:85` — `dd/mm/aaaa HH:mm`, com zero à esquerda e meia-noite como `00`; `:140` — "há 3 minutos" abaixo de uma hora e absoluto acima dela |
| AC-TEMPO-05 | `src/services/tempo.js` é a porta única; `grep -rn "new Date()" src/` não encontra nenhuma ocorrência em caminho de escrita (as remanescentes são parâmetros padrão de leitura, dentro do próprio módulo) |
| AC-TEMPO-06 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:487` — o card mostra "enviando…" enquanto o carimbo não volta; `src/services/__tests__/tempo.test.js:193` — `estaPendente` separa escrita em voo de campo ausente |
| AC-TEMPO-07 | `src/components/__tests__/Chat.caracterizacao.test.js:350` — não limpa um milissegundo antes, limpa exatamente na meia-noite **de Brasília**; `src/services/__tests__/tempo.test.js:333` e `:368` — inclusive nas duas noites de virada de horário de verão, se ele voltar |
| AC-TEMPO-08 | `src/services/__tests__/tempo.test.js:27` — `paraData` lê `Timestamp`, string ISO, `Date` e `{seconds, nanoseconds}`; `:264` — fila mista dos dois formatos ordena certo; `src/__tests__/compatibilidadeFutura.test.js` — os dois sentidos da leitura |
| AC-TEMPO-09 | Não há chamada de rede a serviço de horário em lugar nenhum: a autoridade é o `serverTimestamp()` do próprio Firestore. O motivo de a API pública ter sido descartada está no ADR 0004. |
| AC-CHAMADO-03 | `src/services/__tests__/tempo.test.js:248` — `criarComparadorPorHorario` ordena crescente, joga pendentes para o fim de forma estável e aceita um critério anterior (a task 09 compõe `prioridade desc, horario asc`); aplicado em `TelaAluno` e `TelaProfessor` |

**Sobre a ordenação: por que ela saiu do Firestore**

O `orderBy` do Firestore ordena por **tipo** antes de ordenar por valor — toda string ISO da
v0.1.0 cairia depois de todo `Timestamp` novo, qualquer que fosse o instante. Enquanto os dois
formatos convivem, quem decide a ordem final é `criarComparadorPorHorario()`, no cliente.

**Compatibilidade desta versão**

| Sentido | Prova |
|---|---|
| Retroativa | `src/__tests__/compatibilidadeFutura.test.js` — o leitor da v0.4.0 lê e formata o chamado da v0.1.0, que nunca teve `Timestamp`, e ordena uma fila que mistura os dois formatos |
| Futura | `src/__tests__/compatibilidadeFutura.test.js` — o leitor da v0.3.0 diante de um `Timestamp` não lança, mas devolve `Invalid Date`; `horarioIso` guarda o mesmo instante em string e devolve a ele um caminho. O app grava o campo na confirmação do carimbo, e `scripts/migrar-horarios.js` cobre os documentos de quem não volta a entrar. |

**Continuam não atendidos, de propósito**

| AC | Por quê | Task que resolve |
|---|---|---|
| AC-CHAMADO-05 | As rules de `chamados` continuam abertas para exclusão. O escopo desta task é tempo; endurecer dono de chamado antes do escopo de sala derrubaria o app em produção. | 03 |
| AC-SALA-07 / AC-CHAT-10 | `chamados` e `chat` ainda são coleções globais. O campo `horario` foi mantido com o mesmo nome justamente para que a migração de sala não precise mexer em tempo ao mesmo tempo. | 03 e 06 |
| AC-CHAT-08 | `!clear` ainda funciona para qualquer aluno | 06 |
| AC-PERF-03 | `onSnapshot` ainda sem `where` nem `limit` | 07 |

**Correção de rota na tabela de v0.3.0**

As duas tabelas de "não atendidos" das versões 0.2.0 e 0.3.0 apontam a task **05** como
responsável pelo AC-TEMPO-01. Estava errado: quem troca o relógio do cliente pelo do servidor
é a task **02**, e é o que esta versão faz. O critério em si não mudou.

---

### v0.5.0 — Salas do professor com entrada por PIN e escopo de dados por sala

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-SALA-01 | `src/components/__tests__/CriarSala.test.js:117` — nome, curso e ano letivo chegam ao banco com o dono da sala; `src/services/__tests__/salas.test.js` — a validação recusa nome vazio, curso vazio e ano fora da faixa antes de qualquer escrita; `tests/rules/salas.rules.test.js` — só professor cria, e só como dono de si mesmo |
| AC-SALA-02 | `src/services/__tests__/pin.test.js` — 6 dígitos sorteados por Web Crypto, sem `Math.random()`; `src/services/__tests__/salas.test.js` — colisão no índice força novo sorteio; `tests/rules/salas.rules.test.js` — `indicePins` só aceita `create`, e é a recusa que garante a unicidade |
| AC-SALA-03 | `src/components/__tests__/CriarSala.test.js:136` — o PIN aparece em destaque; `:145` — um clique copia; `:167` — a tela avisa que ele aparece uma vez só |
| AC-SALA-04 | `src/components/__tests__/EntrarComPin.test.js:134` — PIN inexistente e PIN de sala arquivada dão **a mesma** frase; `:165` — o nome da sala recusada não aparece em lugar nenhum da tela |
| AC-SALA-05 | `src/components/__tests__/CriarSala.test.js:117` — `anoLetivo` e `ativa: true`; `src/components/__tests__/MinhasSalas.test.js` — a sala fica ativa até ser arquivada à mão |
| AC-SALA-06 | `src/components/__tests__/MinhasSalas.test.js:112` — a sala abre pelo cartão, sem PIN; `src/components/__tests__/EntrarComPin.test.js:117` — reentrar não reinicia a data de entrada de ninguém |
| AC-SALA-07 | `src/__tests__/escopoPorSala.test.js` — a sala A não vê chamado, mensagem nem fila global da sala B, na tela do aluno e na do professor; `:202` — o `!clear` para na porta da sala; `tests/rules/salas.rules.test.js` — o servidor nega, que é o que vale |
| AC-SALA-08 | `src/components/__tests__/MinhasSalas.test.js:156` — contagem de membros e de chamados abertos, só para o dono |
| AC-SALA-09 | `src/components/__tests__/Sala.test.js:188` — remover o aluno e gerar PIN novo são um gesto só; `src/services/__tests__/salas.test.js` — o PIN anterior deixa de conferir; `tests/rules/salas.rules.test.js` — só o dono remove |
| AC-SALA-10 | `src/components/__tests__/MinhasSalas.test.js:187` — arquivar; `src/components/__tests__/Sala.test.js:224` — arquivada é somente leitura e continua mostrando o que já existe; `tests/rules/salas.rules.test.js` — o servidor nega escrita e entrada nova em sala arquivada |
| AC-SALA-12 | `src/components/__tests__/EntrarComPin.test.js:177` — a tela obedece ao bloqueio; `tests/rules/salas.rules.test.js` — a janela de 5 em 5 minutos é validada pelo **servidor**, com `request.time` |
| AC-SEC-01 | `firestore.rules` — `match /{documento=**} { allow read, write: if false; }` no fim, com cada caminho liberado explicitamente acima; `tests/rules/` — 141 testes, com o par concedido/negado por caminho |
| AC-SEC-02 | `tests/rules/salas.rules.test.js` — aluno da sala A recebe `permission-denied` em tudo da sala B; `src/components/__tests__/Sala.test.js:137` — nem o professor de outra sala entra com a URL na mão |
| AC-SEC-05 | `src/components/__tests__/CriarSala.test.js:156` — o número que a tela mostrou não está no documento da sala; `src/services/__tests__/salas.test.js` — o PIN em claro não é persistido em lugar nenhum; `tests/rules/salas.rules.test.js` — o segredo só é legível pelo dono |
| AC-PERF-03 | `src/__tests__/escopoPorSala.test.js:289` — a fila é cortada no teto; `:313` — a conversa também; `src/components/__tests__/MinhasSalas.test.js` — a lista de salas idem. Nenhum `onSnapshot` sem `limit` no `src/` |
| AC-PERF-04 | `src/__tests__/escopoPorSala.test.js:334` — trocar de sala não acumula listener, e desmontar zera; mesmo teste em `CriarSala`, `EntrarComPin`, `MinhasSalas` e `Sala` |
| AC-CHAMADO-05 | `tests/rules/salas.rules.test.js` — dentro da sala, o `delete` é do autor ou do dono; `tests/rules/firestore.rules.test.js` — na coleção global legada, do autor ou de professor. Inverte a caracterização da v0.2.0 |
| AC-CHAT-10 | `src/__tests__/escopoPorSala.test.js:180` — a conversa vive em `salas/{salaId}/chat` |

**Parcialmente atendidos (🟡)**

| AC | O que já vale | O que falta |
|---|---|---|
| AC-PERF-06 | Todo listener tem teto, e a conta para o alvo declarado (10 salas, 40 alunos, 200 chamados, 1000 mensagens) está em `docs/ARQUITETURA.md` § 5: cabe no plano gratuito, e quem chega perto do teto é o chat, não a fila | A conta é uma estimativa a partir dos cortes, não uma medição no console do Firebase com uso real. Ela só existe depois de um semestre rodando. |

**Compatibilidade desta versão**

| Sentido | Prova |
|---|---|
| Retroativa | `src/__tests__/escopoPorSala.test.js:218` — sem `salaId`, as telas leem as coleções globais da v0.4.0; `:235` — um chamado no formato antigo (`nome`, sem `autorNome`, sem `atendido`) continua legível dentro da sala; `src/__tests__/rotasDeSala.test.js:158` — `/aluno` e `/professor` continuam abrindo |
| Futura | `src/__tests__/escopoPorSala.test.js:256` — o documento novo grava `autorNome` **e** `nome`, `autorUid` **e** `email`; `src/components/__tests__/TelaAluno.caracterizacao.test.js` — a igualdade exata do documento foi estendida, não afrouxada. `nome` sai só na 1.0.0 |

**Continuam não atendidos, de propósito**

| AC | Por quê | Task que resolve |
|---|---|---|
| AC-CHAT-08 | O `!clear` deixou de ser global — ele para na porta da sala —, mas continua disponível para qualquer membro e continua sem confirmação. Restringi-lo a professor é escopo do chat. | 06 |
| AC-CHAMADO-06 | O professor já apaga qualquer chamado da sala dele, mas marcar como **atendido** não tem interface: o campo `atendido` nasce nesta versão e é escrito apenas na criação. | 05 |
| AC-SALA-11 | Um aluno já pode pertencer a várias salas e alterna por `/salas`, mas não há seletor dentro da sala. | pós-1.0.0 |
| AC-SEC-08 | Não há upload de arquivo ainda; o caminho do Storage já nasce escopado por sala. | 04 |

**Limite conhecido, registrado em `docs/BLOQUEIOS.md`**

O limite de tentativas de PIN é por usuário autenticado (`tentativasPin/{uid}`). Quem criar
contas novas contorna o teto. Fechar isso exige contador por IP ou por sala, que as rules não
mantêm sozinhas — a proposta é uma Cloud Function, e está descrita lá.

---

### v0.6.0 — Anexo de imagem por upload, arrastar e colar

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-IMG-01 | `src/components/__tests__/CampoAnexo.test.js:101` — o campo de link continua com o mesmo texto e avisa o modal; `src/components/__tests__/Modal.test.js:97` — o anexo por URL chega como objeto de origem `url` |
| AC-IMG-02 | `src/components/__tests__/CampoAnexo.test.js:144` — o seletor sobe a imagem escolhida e devolve o anexo ao modal |
| AC-IMG-03 | `src/components/__tests__/CampoAnexo.test.js:183` — o arquivo solto sobre o campo sobe e passa pela mesma validação do seletor |
| AC-IMG-04 | `src/components/__tests__/CampoAnexo.test.js:225` — Ctrl+V com captura de tela anexa; `src/hooks/__tests__/useColarImagem.test.js:37` — o hook só entrega imagem, ignora texto colado, e para de escutar no unmount |
| AC-IMG-05 | `src/services/__tests__/anexos.test.js:104` — os quatro formatos aceitos, e BMP recusado por não estar na lista; `:134` |
| AC-IMG-06 | `src/services/__tests__/anexos.test.js:142` — o limite no cliente, com a mensagem dizendo tamanho e teto; `tests/rules/storage.rules.test.js:152` — 6 MB negados **no servidor**, com o cliente trocado por um `curl` |
| AC-IMG-07 | `src/services/__tests__/anexos.test.js:201` — 3000×2000 vira 1600×1067, proporção preservada; `:265` — o GIF sai intacto; `:377` — quem sobe é a versão comprimida, não o original |
| AC-IMG-08 | `src/services/__tests__/anexos.test.js:409` — progresso como fração; `:427` — `UploadTask.cancel()` no sinal abortado; `src/components/__tests__/CampoAnexo.test.js:245` — a barra e o botão de cancelar na tela, e `:287` — nova tentativa sem fechar o modal |
| AC-IMG-09 | `src/components/__tests__/Modal.test.js:137` — a descrição digitada continua no campo depois do erro, e `:149` — dá para concluir o chamado sem o anexo; `src/services/__tests__/anexos.test.js:489` — a mensagem é acionável, por código do Storage |
| AC-IMG-10 | `src/components/__tests__/anexoNosCards.test.js:111` — clicar na miniatura abre o visualizador **sem** `window.open`; `src/components/__tests__/Lightbox.test.js:35` — `window.open` não é chamado; `:83` — foco entra, o Tab não escapa e o foco volta ao gatilho |
| AC-IMG-11 | `src/services/__tests__/anexos.test.js:321` — o arquivo vai para `salas/{salaId}/chamados/{chamadoId}/`; `tests/rules/storage.rules.test.js:125` e `:131` — membro lê, não-membro é negado |
| AC-IMG-12 | `src/components/__tests__/anexoNosCards.test.js:157` — aviso no lugar do ícone quebrado, e `:167` — o chamado continua legível; `src/components/__tests__/Lightbox.test.js:131` |
| AC-IMG-13 | `src/components/__tests__/anexoNosCards.test.js:71` — chamado com `imagem` em string mostra a miniatura; `src/services/__tests__/anexos.test.js:544` — `normalizarAnexo` lê os dois formatos; `tests/rules/storage.rules.test.js:217` — o caminho legado continua **legível** |
| AC-SEC-08 | `src/services/__tests__/anexos.test.js:68` — `.exe` renomeado para `.png`, com o MIME mentindo junto, é recusado; `:94` — o tipo devolvido é o lido do conteúdo; `src/components/__tests__/CampoAnexo.test.js:166` — recusado **sem subir byte nenhum**; `tests/rules/storage.rules.test.js:159` |
| AC-CHAMADO-08 | `src/components/__tests__/anexoNosCards.test.js:178` e `:193` — excluir o chamado (pelo aluno ou pelo professor) leva o anexo junto; `src/services/__tests__/anexos.test.js:637` — sem órfãos, e sem varrer o caminho legado; `tests/rules/storage.rules.test.js:189` |
| Retroativa | `src/components/__tests__/anexoNosCards.test.js:71` — chamado no formato antigo (`imagem` string, sem `anexo`) exibe a miniatura e abre o lightbox; `:275` — os dois formatos convivem na mesma fila; `src/components/__tests__/CampoAnexo.test.js:398` — fora de uma sala, o campo de link continua sendo o que a v0.1.0 sempre ofereceu |
| Futura | `src/components/__tests__/anexoNosCards.test.js:226` — a gravação dupla `imagem` **e** `anexo` com a mesma URL, e `:263` — um leitor que só conhece `imagem` continua achando a URL; `scripts/__tests__/migrar-anexos.test.js:97` — a migração **nunca** escreve em `imagem` |

**Continuam não atendidos, de propósito**

| AC | Por quê | Task que resolve |
|---|---|---|
| AC-ANIM-09 | O lightbox já é um diálogo de teclado completo (Esc, foco preso, foco devolvido), mas o ícone 👁️ dos cards e a transição de abertura são escopo do acabamento. A regra de lint continua desligada com `TODO(task-08)`. | 08 |
| AC-CHAMADO-06 | Sem mudança nesta versão: marcar como atendido continua sem interface. | 05 |

**Limite conhecido**

Se o upload conclui e o navegador fecha **antes** de o chamado ser criado, o
arquivo fica no bucket sem documento apontando para ele. O caminho normal está
coberto — fechar o modal apaga o anexo já enviado
(`src/components/__tests__/Modal.test.js:164`) e excluir o chamado leva o anexo
junto (AC-CHAMADO-08). O que sobra é a aba fechada no meio, e varrer o bucket
periodicamente é trabalho de pós-1.0.0: um arquivo de ~300 KB não justifica uma
Cloud Function agora. Está registrado no ADR 0007, em "Consequências".

A validação por magic bytes **não é antivírus**: ela garante que o arquivo
começa como imagem. Um PNG válido com dado escondido depois dos primeiros bytes
passa. Varredura de conteúdo é serviço pago e está fora do escopo declarado.

---

### v0.7.0 — Opções avançadas do card: cor escolhida e markdown sanitizado

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-COR-01 | `src/components/__tests__/PainelAvancado.test.js:50` — o painel não nasce aberto e o `aria-expanded` nasce `false`; `src/components/__tests__/Modal.test.js:217` — ele fica **abaixo** da seção de anexo, e `:227` — nasce fechado dentro do modal |
| AC-COR-02 | `src/components/__tests__/PainelAvancado.test.js:74` — clicar abre e o `aria-expanded` acompanha; `:111` — a animação usa `var(--duracao-transicao)`, e não uma duração inventada; `:117` — em `prefers-reduced-motion: reduce` a transição é `none` |
| AC-COR-03 | `src/utils/__tests__/paleta.test.js:79` — `it.each` sobre a paleta **inteira** exigindo ≥ 4,5:1; `:20` a `:46` — a fórmula verificada nos extremos (21 para preto/branco) e na fronteira do AA (#767676 passa, #777777 não); `src/components/__tests__/TelaAluno.caracterizacao.test.js:623` — o card usa a cor de texto que a paleta garante |
| AC-COR-04 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:604` — a cor escolhida é gravada no chamado, e `:614` — pinta o card; `src/components/__tests__/TelaProfessor.caracterizacao.test.js:354` — o card do professor mostra a mesma cor; `src/components/__tests__/Modal.test.js:243` |
| AC-COR-05 | `src/components/__tests__/TelaAluno.caracterizacao.test.js:219` — cor automática quando o aluno não escolhe (caso da v0.2.0, intacto); `:632` — o card de cor sorteada **não** recebe cor de texto nova; `src/utils/__tests__/paleta.test.js:111` — `corAutomatica` devolve exatamente o `hsl(x, 70%, 80%)` da v0.1.0; `src/components/__tests__/Modal.test.js:260` |
| AC-COR-06 | `src/components/__tests__/PainelAvancado.test.js:93` — `Enter` aciona a setinha, e `:101` — `Tab` a alcança; `:57` — rótulo audível "Opções avançadas"; `src/components/__tests__/SeletorDeCor.test.js:29` — radiogroup nomeado, `:100` — tabindex rotativo, `:108` a `:170` — setas, `Home`, `End` e volta nas pontas |
| AC-COR-07 | `src/utils/__tests__/markdown.test.js:40` a `:77` — negrito, itálico, lista, lista ordenada, `código`, bloco cercado e quebra de linha; `src/components/__tests__/TelaAluno.caracterizacao.test.js:655` e `src/components/__tests__/TelaProfessor.caracterizacao.test.js:364` — renderizado nos dois cards |
| AC-COR-08 | `src/utils/__tests__/markdown.test.js:134`, `:147` e `:151` — os doze vetores da task verificados **no DOM** (nenhum elemento executável, nenhum handler `on*`, nenhuma URL executável); `:163` — nada executa ao montar o vetor no documento; `src/components/__tests__/TelaAluno.caracterizacao.test.js:665` e `src/components/__tests__/TelaProfessor.caracterizacao.test.js:374` — na fila de verdade |
| AC-COR-09 | `src/components/__tests__/PainelAvancado.test.js:152` — a prévia mostra o markdown aplicado, `:159` — a cor escolhida, `:165` — a automática enquanto não há escolha; `src/components/__tests__/Modal.test.js:274` — a cor entregue ao gravar é **a mesma** que a prévia mostrou |
| AC-COR-10 | `src/components/__tests__/Modal.test.js:311` — a escolha é guardada ao concluir, `:322` — o próximo modal abre com ela marcada, `:344` — voltar para a automática esquece; `src/utils/__tests__/preferenciaDeCor.test.js:43` e `:55` — valor fora da paleta é recusado na leitura **e** na escrita, `:88` — storage que lança vira "sem preferência" |
| AC-SEC-04 | `src/utils/__tests__/markdown.test.js:118` — a lista de vetores inteira; `src/components/__tests__/TextoMarkdown.test.js:42` — o HTML digitado no formato antigo continua sendo escapado por React; `src/components/__tests__/TelaAluno.caracterizacao.test.js:706` — a descrição antiga com `<script>` aparece como texto |
| Retroativa | `src/components/__tests__/TelaAluno.caracterizacao.test.js:682` — chamado sem `formato`, com caminho do Windows e `_log_` na descrição, continua aparecendo como foi escrito; `src/components/__tests__/TelaProfessor.caracterizacao.test.js:389` — o mesmo no card do professor, com `style.color` vazio; `src/components/__tests__/TextoMarkdown.test.js:21` — texto puro é o padrão quando ninguém diz o formato; `src/utils/__tests__/paleta.test.js:98` — a cor `hsl()` sorteada não é confundida com a paleta |
| Futura | `src/__tests__/compatibilidadeFutura.test.js:409` — o leitor da v0.6.0 lê o chamado da v0.7.0 sem lançar, `:418` — `cor` continua sendo string CSS que qualquer versão pinta, `:428` — quem ignora `formato` vê o markdown como texto cru; `src/utils/__tests__/markdown.test.js:182` — formato desconhecido cai em texto |

**Continuam não atendidos, de propósito**

| AC | Por quê | Task que resolve |
|---|---|---|
| AC-ANIM-05 | O painel avançado respeita `prefers-reduced-motion`, mas o restante da interface ainda não. A regra vale por ora só em `PainelAvancado.css`. | 08 |
| AC-ANIM-09 | Inalterado por esta versão: o ícone 👁️ dos cards continua sendo uma `<div>` com `onClick`, e as duas regras de lint continuam desligadas com `TODO(task-08)`. O que esta versão acrescentou — setinha, radiogroup e prévia — já nasceu acessível. | 08 |
| AC-CHAMADO-06 | Sem mudança nesta versão: marcar como atendido continua sem interface. | 07 |

**Limites conhecidos**

**A rule não valida `formato` nem `cor`.** A regra de criação de chamado confere
autor, tamanho da descrição e o carimbo do servidor, e aceita os dois campos
novos sem olhar. Uma escrita feita fora do app pode gravar
`formato: "markdown"` com qualquer descrição — e é exatamente esse caso que a
sanitização **na leitura** cobre, para todo leitor, inclusive para os documentos
que a migração da task 03 copiou da coleção global. Validar os dois campos na
rule é endurecimento barato e fica para a task 09.

**Markdown é surpresa para quem não o conhece.** Um aluno que escreva `2 * 3 * 4`
numa descrição nova verá itálico onde não pediu. O painel avançado explica a
sintaxe aceita e a prévia mostra o resultado antes do envio; um editor com
botões de formatação está fora do escopo desta versão.

**Links e imagens não são interpretados.** `[texto](url)` vira só o texto e
`![x](url)` desaparece. É decisão desta versão, registrada no ADR 0008: a imagem
do chamado é o anexo validado do ADR 0007, e uma `<img>` na descrição entregaria
o IP de toda a turma ao servidor do outro lado.

---

### v0.8.0 — Chat reescrito e mensagens diretas

**Atendidos (✅)**

| AC | Prova |
|---|---|
| AC-CHAT-01 | `src/components/chat/__tests__/Mensagem.test.js:43` — HH:mm; `:49` — o fuso é o de **Brasília**, e não o da máquina; `:59` — o horário é um `<time>` com instante legível por máquina; `:66` — mensagem antiga com `horario` em string ISO também mostra a hora; `:72` — sem horário nenhum sai travessão, nunca "Invalid Date" |
| AC-CHAT-02 | `src/utils/__tests__/corUsuario.test.js:18` — determinismo; `:59` — **o e-mail de quem está lendo nunca entra na conta**, que era o defeito da v0.7.0; `:102` — contraste WCAG AA verificado em 1000 uids sintéticos; `:125` — o mesmo para as sementes legadas, que são e-mails; `:168` — a busca para no primeiro tom aprovado, em vez de clarear até o branco; `src/components/chat/__tests__/Mensagem.test.js:136` — a cor do balão não muda conforme quem abre |
| AC-CHAT-03 | `src/components/chat/__tests__/ListaMensagens.test.js:51` — o nome aparece uma vez por bloco; `:66` — volta quando outra pessoa fala; `:80` — falas distantes no tempo **não** agrupam; `:97` — mensagem legada agrupa pelo e-mail, na falta de `autorUid`; `src/components/chat/__tests__/Mensagem.test.js:177` — a continuação é marcada por classe, para o CSS aproximar os balões |
| AC-CHAT-04 | `src/components/chat/__tests__/Mensagem.test.js:191` — selo em quem fala como professor **da sala**; `:197` — aluno não tem; `:203` — mensagem antiga, sem `autorPapel`, também não; `:209` — o selo some junto com o nome na continuação |
| AC-CHAT-05 | `src/hooks/__tests__/useRolagemAutomatica.test.js:86` — no fim da conversa, a mensagem nova rola sozinha; `:106` — rolado para cima, **nada arranca quem está relendo**; `:115` — e aparece o aviso de mensagem nova; `:124` — que leva ao fim quando a pessoa aceita; `:135` — e some sozinho quando ela desce por conta própria; `src/components/chat/__tests__/ListaMensagens.test.js` — o botão leva de volta ao fim |
| AC-CHAT-06 | `src/hooks/__tests__/useMensagens.test.js:49` — `limit(50)`, e não o teto de 300 da v0.7.0; `:56` — ordem **decrescente**, isto é, as 50 mais recentes; `:67` — com 120 no banco, entrega 50; `:75` — as 50 chegam em ordem crescente para a tela; `:95` — as anteriores sob demanda; `src/components/chat/__tests__/ListaMensagens.test.js:151` |
| AC-CHAT-07 | `src/components/chat/__tests__/Mensagem.test.js:80` — "enviando…" enquanto o servidor não carimbou; `:88` — o balão é marcado como pendente para o CSS esmaecê-lo; `:94` — o estado some quando o horário chega; `src/components/chat/__tests__/Chat.test.js:177` — o ciclo inteiro na tela |
| AC-CHAT-08 | `tests/rules/salas.rules.test.js:716` — **o servidor nega**: o `!clear` de um aluno não apaga nenhuma mensagem da turma; `:737` — nem a do colega; `src/components/chat/__tests__/Chat.test.js:211` — o aluno recebe a recusa e a conversa continua inteira; `:232` — o professor **precisa confirmar**; `:243` — confirmar apaga; `:255` — cancelar não apaga nada; `:268` — o comando não vira mensagem visível |
| AC-CHAT-09 | `src/components/chat/__tests__/CampoMensagem.test.js:92` — sem contador enquanto o limite é teórico; `:100` — contador ao se aproximar; `:114` — o campo não aceita além de 500; `:122` — texto colado acima do limite é **cortado**, não descartado em silêncio; `:131` — avisa em vez de só parar de aceitar letra |
| AC-CHAT-10 | `src/__tests__/escopoPorSala.test.js:180` — a conversa vive em `salas/{salaId}/chat` (desde a v0.5.0, mantido) |
| AC-CHAT-12 | `src/components/chat/__tests__/Mensagem.test.js:239` — `<script>` **não** vira markup; `:246` — `<img onerror>` idem; `:252` — URL vira link com `rel="noopener noreferrer"`; `src/utils/__tests__/markdown.test.js` — os links passam pela **mesma** tranca do card do chamado (task 05), com o `rel` escrito pelo sanitizador e não pelo texto de quem digitou |
| AC-CHAT-13 | `src/styles/__tests__/Chat.css.test.js` — os quadros de `mensagem-entra` existem, a animação é aplicada no balão com `var(--duracao-transicao)` e `var(--aceleracao-padrao)`, e dentro de `@media (prefers-reduced-motion: reduce)` ela é `none` junto com a rolagem suave e as transições |
| AC-DM-01 | `src/components/chat/__tests__/Chat.test.js:120` — abre na aba da sala; `:127` — troca para diretas; `:136` — a aba de diretas esconde a conversa da turma; `:147` — voltar não perde a conversa da turma |
| AC-DM-02 | `src/components/chat/__tests__/AbaDiretas.test.js:56` — o professor vê os alunos da sala; `tests/rules/conversas.rules.test.js:226` — e o servidor deixa ele abrir a conversa |
| AC-DM-03 | `src/components/chat/__tests__/AbaDiretas.test.js:65` — o aluno vê o professor da sala; `:73` — **não** vê os colegas (aluno↔aluno é o AC-DM-07, de outra versão); `tests/rules/conversas.rules.test.js:235` |
| AC-DM-04 | `tests/rules/conversas.rules.test.js:149` — um terceiro da mesma sala recebe `permission-denied` no `get`; `:200` — e na **consulta** da coleção; `:193` — a consulta sem o filtro `array-contains` é negada mesmo para quem tem conversa; `:159` — nem o professor dono da sala lê a conversa de dois alunos; `:351` — o terceiro também não lê as mensagens; `:312` — nem atualiza o resumo; `:320` — participante não se acrescenta à lista |
| AC-DM-05 | `src/components/chat/__tests__/ListaConversas.test.js:77` — o contador de quem está lendo; `:88` — **não** o do outro lado; `:100` — sem bolinha com zero dentro; `:111` — conversa sem o mapa `naoLidas` não quebra a lista; `src/components/chat/__tests__/AbaDiretas.test.js:168` — abrir zera o contador de quem abriu; `tests/rules/conversas.rules.test.js:295` e `:304` |
| AC-DM-06 | `src/components/chat/__tests__/ListaConversas.test.js:119` — a lista preserva a ordem que o servidor entregou, e o servidor ordena por `ultimaMensagem.horario`; `src/services/__tests__/chatDiretas.test.js` — a consulta pede essa ordenação |
| AC-PERF-04 | `src/components/chat/__tests__/Chat.test.js:357` — desmontar não deixa listener para trás; `:367` — fechar o painel solta o listener; `:377` — **o painel fechado não escuta nada**; `src/components/chat/__tests__/AbaDiretas.test.js:208` e `:217` — abrir e fechar conversas não acumula listener |
| AC-TEMPO-07 | `src/components/chat/__tests__/Chat.test.js:286` — a tela mostra só a conversa de hoje; `:298` — **a de ontem continua no banco**; `:308` — o histórico está a um clique; `:324` — a mensagem em voo, ainda sem carimbo, não some da tela; `:335` — a virada da meia-noite esvazia a tela e não o banco |
| Retroativa | `src/components/chat/__tests__/Mensagem.test.js:66` — `horario` em string ISO; `:183` — usa o `nome` gravado, e não o do autor logado; `:203` — sem `autorPapel`, sem selo; `src/utils/__tests__/corUsuario.test.js:53` — sem `autorUid`, a cor sai do `email` da **própria** mensagem; `:77` — mensagem sem nada não lança; `src/components/chat/__tests__/ListaMensagens.test.js:97` e `:111` — agrupamento por e-mail na coleção mista |
| Futura | `src/components/chat/__tests__/Chat.test.js:160` — a mensagem nova grava `autorUid`, `autorNome` e `autorPapel` **e também** `nome` e `email`, para que um cliente da v0.7.0 continue renderizando o balão; `src/__tests__/compatibilidadeFutura.test.js:165` — uma mensagem com campos que a v0.1.0 não conhece é renderizada sem lançar, e `:174` — os campos desconhecidos não vazam para a tela |

**Parcialmente atendidos (🟡)**

| AC | O que já vale | O que falta |
|---|---|---|
| AC-PERF-06 | A conta de leitura antes/depois está em `docs/ARQUITETURA.md`: com `limit(50)` mais o painel que só escuta aberto, o chat deixa de ser o gargalo da cota | Continua sendo estimativa a partir dos cortes, não medição no console do Firebase com uso real |

**Continuam não atendidos, de propósito**

| AC | Por quê | Task que resolve |
|---|---|---|
| AC-CHAT-11 | [POS]. O ponto de extensão existe e está testado — `CampoMensagem` aceita `aoDigitar` e avisa ao começar, ao enviar e ao sair do campo (`src/components/chat/__tests__/CampoMensagem.test.js:179`) —, mas nada publica esse sinal no banco nem desenha o indicador para o outro lado. Publicá-lo custa uma escrita por tecla se for feito ingenuamente; fazer direito pede um documento de presença com expiração, que é desenho próprio. | pós-1.0.0 |
| AC-DM-07 | [POS]. Aluno↔aluno continua fechado, e é o padrão correto: hoje o aluno só vê o professor na lista de contatos. Abrir isso exige a chave por sala e a moderação que vem com ela. | pós-1.0.0 |
| AC-DM-08 | [POS]. Não há exportação de histórico de DM, e os participantes não são avisados de que ela poderia existir. Enquanto não existir, o aviso seria falso. | pós-1.0.0 |
| AC-ANIM-09 | Inalterado por esta versão. O chat novo já nasceu com botão de verdade em tudo que é clicável — abas, paginação, conversas —, mas o ícone 👁️ dos cards continua sendo uma `<div>` com `onClick`, e as regras de lint continuam desligadas com `TODO(task-08)`. | 08 |
| AC-CHAMADO-06 | Sem mudança nesta versão: marcar como atendido continua sem interface. | 07 |

**Limites conhecidos**

**A janela relê a janela inteira ao paginar.** Pedir as 50 anteriores refaz a
consulta com `limit(100)`, em vez de buscar só a página nova com `startAfter`.
É mais caro por clique e foi escolhido de propósito: um cursor cria um segundo
conjunto de resultados fora do `onSnapshot`, que não recebe edição nem deleção
em tempo real, e expira quando a mensagem-âncora some no `!clear`. Com o teto de
300 por sala, o pior caso é seis releituras por aula. Está no ADR 0009.

**Mensagem sem `horario` nenhum não aparece na visão do dia.** Ela não pode ser
provada como de hoje, então fica no histórico, atrás do botão "Ver dias
anteriores". O caso oposto — mensagem recém-enviada, ainda sem o carimbo do
servidor — conta como de hoje de propósito, senão a própria fala que a pessoa
acabou de escrever piscaria e sumiria enquanto o servidor responde.

**A ordenação do servidor não intercala os dois formatos de `horario`.** O
`orderBy` do Firestore ordena por tipo antes de ordenar por valor, e
`Timestamp` vem antes de `string`. Uma mensagem da v0.1.0 com `horario` em
string ISO é alcançada pela paginação, e a ordem que a tela mostra é decidida no
cliente por `criarComparadorPorHorario`, como em toda tela do app.

**A rule não valida o conteúdo da mensagem direta.** Ela confere participação,
id determinístico e assinatura do autor, mas não o tamanho do texto — o limite
de 500 é do cliente. Endurecer isso é o mesmo trabalho pendente do `formato` e
da `cor` do chamado, e fica para a task 09.
