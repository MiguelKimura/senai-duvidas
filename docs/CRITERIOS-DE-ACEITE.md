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

---

## 1. Autenticação e Identidade (`AUTH`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-AUTH-01 | O usuário consegue se cadastrar com nome, e-mail e senha, e o cadastro cria um documento em `usuarios/{uid}` com `nome`, `email`, `tipo`, `uid` e `criadoEm`. | [MVP] [REG] |
| AC-AUTH-02 | O usuário consegue entrar com e-mail e senha e é redirecionado para `/aluno` ou `/professor` conforme o campo `tipo`. | [MVP] [REG] |
| AC-AUTH-03 | Existe botão **"Entrar com Google"** na tela de login que autentica via Firebase e, no primeiro acesso, cria o documento `usuarios/{uid}` com `tipo: "aluno"`. | [MVP] |
| AC-AUTH-04 | Existe botão **"Entrar com GitHub"** com o mesmo comportamento do AC-AUTH-03. | [MVP] |
| AC-AUTH-05 | Se o e-mail do provedor social já existir com outro método, o sistema exibe mensagem em português explicando como vincular a conta — nunca um stack trace ou código bruto do Firebase. | [MVP] |
| AC-AUTH-06 | O papel (`aluno`/`professor`) é resolvido **exclusivamente** a partir do Firestore (`usuarios/{uid}.tipo` e `autorizados/{email}.Tipo`). `localStorage` nunca pode determinar papel. | [MVP] |
| AC-AUTH-07 | Um usuário não listado em `autorizados/{email}` com `Tipo: "professor"` não consegue se cadastrar nem operar como professor, mesmo alterando `localStorage`, o payload da requisição ou as Firestore Rules pelo cliente. | [MVP] |
| AC-AUTH-08 | O logout limpa a sessão do Firebase e todo estado local, e redireciona para `/`. Após logout, voltar pelo botão do navegador não expõe dados da sessão anterior. | [MVP] |
| AC-AUTH-09 | Toda rota protegida (`/aluno`, `/professor`, `/sala/*`) exibe um estado de carregamento enquanto o papel está sendo resolvido, e nunca renderiza a tela de login "piscando" para um usuário já autenticado. | [MVP] |
| AC-AUTH-10 | Nenhuma credencial, chave de serviço ou segredo fica versionado no repositório; a config do Firebase vem de variáveis `REACT_APP_*` com fallback documentado. | [MVP] |

## 2. Sessão Persistente (`SESSAO`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-SESSAO-01 | Fechar a aba e reabrir o site mantém o usuário logado, sem nova digitação de senha. | [MVP] |
| AC-SESSAO-02 | Desligar e religar o computador mantém o usuário logado (persistência `browserLocalPersistence` / IndexedDB). | [MVP] |
| AC-SESSAO-03 | A sessão sobrevive a um recarregamento forçado (Ctrl+F5) e à perda temporária de rede. | [MVP] |
| AC-SESSAO-04 | O token é renovado automaticamente; o usuário não é deslogado ao ficar mais de 1 hora com a aba aberta. | [MVP] |
| AC-SESSAO-05 | Em máquina compartilhada, existe ação explícita de **"Sair"** visível em todas as telas autenticadas. | [MVP] |
| AC-SESSAO-06 | Se o navegador bloquear armazenamento (modo anônimo restrito), o app degrada para sessão de aba única e avisa o usuário, sem travar. | [POS] |

## 3. Salas do Professor (`SALA`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-SALA-01 | O professor consegue criar uma sala informando nome, curso/turma e ano letivo. | [MVP] |
| AC-SALA-02 | Ao criar, o sistema gera automaticamente um **PIN numérico de 6 dígitos**, único entre as salas ativas. | [MVP] |
| AC-SALA-03 | O professor visualiza o PIN em destaque e consegue copiá-lo com um clique. | [MVP] |
| AC-SALA-04 | O aluno entra na sala digitando o PIN; PIN inválido exibe erro claro sem revelar se o PIN existe em outra sala. | [MVP] |
| AC-SALA-05 | Uma sala vale o **ano letivo inteiro**: possui `anoLetivo` e permanece ativa até ser arquivada manualmente pelo professor. | [MVP] |
| AC-SALA-06 | Após entrar uma vez, o aluno não precisa redigitar o PIN em acessos futuros — o vínculo fica salvo em `salas/{salaId}/membros/{uid}`. | [MVP] |
| AC-SALA-07 | Chamados e chat são **escopados por sala**: um aluno da sala A nunca vê chamados nem mensagens da sala B. | [MVP] |
| AC-SALA-08 | O professor vê a lista de salas que criou, com contagem de membros e de chamados abertos em cada uma. | [MVP] |
| AC-SALA-09 | O professor consegue remover um aluno da sala e **regerar o PIN** (invalidando o anterior). | [MVP] |
| AC-SALA-10 | O professor consegue arquivar uma sala ao fim do ano; salas arquivadas ficam somente-leitura e não aceitam novas entradas. | [MVP] |
| AC-SALA-11 | Um aluno pode pertencer a mais de uma sala e alterna entre elas por um seletor. | [POS] |
| AC-SALA-12 | Tentativas de PIN são limitadas (ex.: 5 erros em 5 minutos por usuário) para impedir força bruta em 6 dígitos. | [MVP] |

## 4. Chamados / Dúvidas (`CHAMADO`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-CHAMADO-01 | O aluno abre um chamado com descrição textual obrigatória (1 a 1000 caracteres). | [MVP] [REG] |
| AC-CHAMADO-02 | Chamados aparecem em tempo real para o professor e para os colegas da mesma sala, sem recarregar a página. | [MVP] [REG] |
| AC-CHAMADO-03 | A fila é ordenada por horário de envio **crescente** (mais antigo primeiro), respeitando os perks de prioridade (ver `PERK`). | [MVP] [REG] |
| AC-CHAMADO-04 | O aluno consegue excluir o **próprio** chamado quando a dúvida já foi resolvida, com confirmação antes de excluir. | [MVP] [REG] |
| AC-CHAMADO-05 | O aluno **não** consegue excluir o chamado de outro aluno — nem pela interface nem por chamada direta ao banco. | [MVP] |
| AC-CHAMADO-06 | O professor consegue excluir qualquer chamado da sua sala e marcar um chamado como **atendido**. | [MVP] |
| AC-CHAMADO-07 | O card exibe nome do autor, descrição, horário de envio e indicador visual de anexo quando houver imagem. | [MVP] [REG] |
| AC-CHAMADO-08 | A exclusão remove também os anexos associados do Storage (sem arquivos órfãos). | [MVP] |
| AC-CHAMADO-09 | A lista suporta 200 chamados simultâneos na mesma sala sem travamento perceptível (paginação ou virtualização). | [MVP] |
| AC-CHAMADO-10 | Estado vazio tem mensagem amigável ("Nenhuma dúvida por aqui ainda") em vez de tela em branco. | [MVP] |

## 5. Cor do Card / Menu Markdown Oculto (`COR`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-COR-01 | O modal de novo chamado exibe uma **setinha cinza discreta** (disclosure) abaixo dos campos principais, fechada por padrão. | [MVP] |
| AC-COR-02 | Ao clicar na setinha, um painel se expande com animação suave revelando as opções avançadas. | [MVP] |
| AC-COR-03 | O painel oferece uma **paleta de cores predefinidas** para o card, com contraste de texto garantido (WCAG AA, ≥ 4.5:1). | [MVP] |
| AC-COR-04 | A cor escolhida é persistida no chamado e usada como fundo do card para todos que o visualizam. | [MVP] |
| AC-COR-05 | Se o aluno não escolher cor, o sistema mantém o comportamento atual (cor automática) — sem regressão. | [MVP] [REG] |
| AC-COR-06 | A setinha é acessível por teclado (`Tab` + `Enter`/`Espaço`), tem `aria-expanded` correto e rótulo audível por leitor de tela. | [MVP] |
| AC-COR-07 | O painel avançado aceita **markdown básico** na descrição (negrito, itálico, listas, `código`) com renderização sanitizada no card. | [MVP] |
| AC-COR-08 | O markdown é sanitizado: nenhuma tag `<script>`, `<iframe>`, handler `on*` ou URL `javascript:` chega ao DOM. | [MVP] |
| AC-COR-09 | O painel mostra um **preview ao vivo** do card com a cor e o markdown aplicados. | [POS] |
| AC-COR-10 | A preferência de cor do aluno é lembrada como padrão do próximo chamado. | [POS] |

## 6. Imagens e Anexos (`IMG`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-IMG-01 | O aluno continua conseguindo anexar imagem por **link/URL**, como hoje. | [MVP] [REG] |
| AC-IMG-02 | O aluno consegue anexar imagem **do próprio computador** por seletor de arquivo. | [MVP] |
| AC-IMG-03 | O aluno consegue **arrastar e soltar** (drag & drop) uma imagem no modal. | [MVP] |
| AC-IMG-04 | O aluno consegue **colar (Ctrl+V)** uma captura de tela direto no modal. | [MVP] |
| AC-IMG-05 | Formatos aceitos: PNG, JPEG, WEBP e GIF. Outros formatos são rejeitados com mensagem clara. | [MVP] |
| AC-IMG-06 | Limite de **5 MB por arquivo**, validado no cliente **e** nas regras do Storage. | [MVP] |
| AC-IMG-07 | Imagens acima de 1600px são redimensionadas/comprimidas no cliente antes do upload. | [MVP] |
| AC-IMG-08 | Durante o upload há barra de progresso e opção de cancelar. | [MVP] |
| AC-IMG-09 | Falha de upload exibe erro acionável ("Tente novamente" / "Arquivo muito grande") e **não** perde o texto já digitado. | [MVP] |
| AC-IMG-10 | A imagem é exibida como miniatura no card e abre em visualizador (lightbox) ao clicar — sem depender de `window.open`, que é bloqueado por alguns navegadores do laboratório. | [MVP] |
| AC-IMG-11 | Anexos ficam em `salas/{salaId}/chamados/{chamadoId}/{arquivo}` no Storage, e só membros da sala conseguem ler. | [MVP] |
| AC-IMG-12 | Anexo por URL externa que falhar ao carregar mostra placeholder, nunca ícone quebrado do navegador. | [MVP] |
| AC-IMG-13 | Chamados antigos, criados antes da migração e com `imagem` como string de URL, continuam sendo exibidos corretamente. | [MVP] [REG] |

## 7. Horário Oficial de Brasília (`TEMPO`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-TEMPO-01 | O horário gravado em chamados e mensagens vem do **servidor** (`serverTimestamp()` do Firestore), nunca do relógio do computador do usuário. | [MVP] |
| AC-TEMPO-02 | Alterar manualmente o relógio do computador **não** altera a posição do chamado na fila. | [MVP] |
| AC-TEMPO-03 | Todo horário é exibido no fuso **America/Sao_Paulo**, independentemente do fuso configurado na máquina. | [MVP] |
| AC-TEMPO-04 | A exibição usa formato brasileiro (`dd/mm/aaaa HH:mm`) e rótulos relativos ("há 3 minutos") para eventos recentes. | [MVP] |
| AC-TEMPO-05 | Existe um módulo único `src/services/tempo.js` como **única** fonte de horário do app; nenhum componente chama `new Date()` diretamente para gravar dados. | [MVP] |
| AC-TEMPO-06 | Enquanto o `serverTimestamp()` não é confirmado, a UI mostra "enviando…" em vez de um horário provisório errado. | [MVP] |
| AC-TEMPO-07 | O reset do chat à meia-noite usa a meia-noite de Brasília, não a meia-noite local da máquina. | [MVP] |
| AC-TEMPO-08 | Registros antigos com `horario` em string ISO continuam sendo lidos e ordenados corretamente. | [MVP] [REG] |
| AC-TEMPO-09 | O app funciona sem nenhuma chamada a API externa de horário (o `serverTimestamp` do Firestore é a autoridade), evitando dependência de serviço de terceiros em sala de aula. | [MVP] |

## 8. Chat (`CHAT`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-CHAT-01 | Cada mensagem exibe o **horário de envio** (HH:mm no fuso de Brasília). | [MVP] |
| AC-CHAT-02 | Mensagens do mesmo usuário mantêm **sempre a mesma cor**, estável entre sessões e entre dispositivos. | [MVP] |
| AC-CHAT-03 | Mensagens consecutivas do mesmo autor são agrupadas, sem repetir nome e avatar. | [MVP] |
| AC-CHAT-04 | Professores são visualmente identificados com selo/etiqueta distinta dos alunos. | [MVP] |
| AC-CHAT-05 | O chat rola automaticamente para a mensagem mais recente — exceto quando o usuário rolou para cima, caso em que aparece o botão "novas mensagens". | [MVP] |
| AC-CHAT-06 | O chat carrega apenas as **50 mensagens mais recentes** e busca as anteriores sob demanda (scroll infinito). | [MVP] |
| AC-CHAT-07 | Enviar mensagem tem feedback otimista: a mensagem aparece imediatamente em estado "enviando" e confirma ao gravar. | [MVP] |
| AC-CHAT-08 | O comando `!clear` só funciona para **professores** e pede confirmação; hoje qualquer aluno pode apagar o chat inteiro (falha de segurança a corrigir). | [MVP] |
| AC-CHAT-09 | Mensagens são limitadas a 500 caracteres, com contador visível ao se aproximar do limite. | [MVP] |
| AC-CHAT-10 | O chat é escopado por sala (`salas/{salaId}/chat`). | [MVP] |
| AC-CHAT-11 | Existe indicador de "digitando…" para os participantes da conversa. | [POS] |
| AC-CHAT-12 | Links enviados no chat viram links clicáveis com `rel="noopener noreferrer"`; nenhum HTML do usuário é renderizado como markup. | [MVP] |
| AC-CHAT-13 | Animação de entrada suave nas novas mensagens, respeitando `prefers-reduced-motion`. | [MVP] |

## 9. Mensagens Diretas (`DM`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-DM-01 | O chat tem abas separadas: **"Sala"** (público) e **"Diretas"** (privado). | [MVP] |
| AC-DM-02 | O professor consegue iniciar uma conversa privada com qualquer aluno da sua sala. | [MVP] |
| AC-DM-03 | O aluno consegue iniciar conversa privada com o professor da sala. | [MVP] |
| AC-DM-04 | Conversas privadas **não** são visíveis para nenhum terceiro, garantido por Firestore Rules — não apenas por filtro na interface. | [MVP] |
| AC-DM-05 | Existe indicador de mensagens não lidas por conversa, com contador. | [MVP] |
| AC-DM-06 | A lista de conversas é ordenada pela mensagem mais recente. | [MVP] |
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
| AC-ANIM-09 | Existe um arquivo único de tokens de design (cores, espaçamentos, durações) usado por todos os estilos. | [MVP] |
| AC-ANIM-10 | Contraste mínimo WCAG AA em todos os textos e navegação completa por teclado em todos os fluxos. | [MVP] |

## 12. Testes e Qualidade (`TEST`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-TEST-01 | `npm test` roda em modo não-interativo (CI) e termina com código de saída 0 quando tudo passa. | [MVP] |
| AC-TEST-02 | Toda feature nova entra com testes escritos **antes** da implementação (ciclo red-green-refactor comprovado no histórico de commits). | [MVP] |
| AC-TEST-03 | Cobertura mínima global: **80% de linhas** e **75% de branches**, verificada por threshold que quebra o build. | [MVP] |
| AC-TEST-04 | Existem testes de integração contra o **Firebase Emulator Suite** (Auth + Firestore + Storage), sem tocar o projeto de produção. | [MVP] |
| AC-TEST-05 | As Firestore Rules e as Storage Rules têm testes dedicados cobrindo permissão concedida **e** negada. | [MVP] |
| AC-TEST-06 | Existem testes end-to-end (Playwright) para os fluxos críticos: login, entrar na sala, abrir chamado com imagem, excluir chamado, enviar mensagem e DM. | [MVP] |
| AC-TEST-07 | Cada nova feature **adiciona** casos à suíte existente; nenhuma task pode deletar ou marcar como `skip` um teste anterior para ficar verde. | [MVP] |
| AC-TEST-08 | A suíte completa roda em menos de 5 minutos no CI. | [MVP] |
| AC-TEST-09 | Testes são determinísticos: sem `sleep` arbitrário, sem dependência de relógio real (tempo é mockado). | [MVP] |
| AC-TEST-10 | Há um teste de regressão explícito para **cada** critério marcado [REG]. | [MVP] |

## 13. CI/CD e Branches (`CI`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-CI-01 | O repositório tem as branches **`main`** (o que os usuários veem, sempre estável) e **`dev`** (integração). | [MVP] |
| AC-CI-02 | Branches de feature saem de `dev`, no padrão `feat/<escopo>`, `fix/<escopo>` ou `chore/<escopo>`. | [MVP] |
| AC-CI-03 | Todo PR roda lint, testes unitários, testes de integração e build antes de poder ser mesclado. | [MVP] |
| AC-CI-04 | `main` e `dev` são protegidas: sem push direto, merge apenas por PR com CI verde. | [MVP] |
| AC-CI-05 | Commits seguem **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `BREAKING CHANGE:`). | [MVP] |
| AC-CI-06 | A versão em `package.json` segue **SemVer** e é incrementada de acordo com o tipo das mudanças do PR. | [MVP] |
| AC-CI-07 | Cada merge em `main` gera uma tag de versão e uma entrada no `CHANGELOG.md`. | [MVP] |
| AC-CI-08 | O deploy de produção acontece a partir de `main`; `dev` publica em ambiente de homologação. | [MVP] |
| AC-CI-09 | O `CHANGELOG.md` é gerado a partir dos commits convencionais, não escrito à mão. | [MVP] |
| AC-CI-10 | O projeto clona, instala e roda com três comandos (`git clone`, `npm install`, `npm start`), documentados no README. | [MVP] |

## 14. Segurança e Privacidade (`SEC`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-SEC-01 | As Firestore Rules negam tudo por padrão e liberam explicitamente cada caminho. | [MVP] |
| AC-SEC-02 | Nenhum usuário lê ou escreve dados de sala à qual não pertence, validado por teste de rules. | [MVP] |
| AC-SEC-03 | Escalada de privilégio de aluno para professor é impossível pelo cliente. | [MVP] |
| AC-SEC-04 | Todo texto do usuário é escapado ou sanitizado antes de ser renderizado (proteção contra XSS). | [MVP] |
| AC-SEC-05 | PINs de sala não são expostos a quem não é dono da sala em nenhuma resposta do banco. | [MVP] |
| AC-SEC-06 | O app roda apenas sob HTTPS; domínios autorizados do Firebase Auth estão restritos aos domínios reais. | [MVP] |
| AC-SEC-07 | Dados de menores de idade: nenhum dado pessoal além de nome e e-mail institucional é coletado. | [MVP] |
| AC-SEC-08 | Uploads são varridos por tipo MIME real (magic bytes), não apenas pela extensão do arquivo. | [MVP] |

## 15. Desempenho e Escalabilidade (`PERF`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-PERF-01 | O carregamento inicial (First Contentful Paint) fica abaixo de 2,5s em conexão 3G rápida. | [MVP] |
| AC-PERF-02 | O bundle JavaScript inicial fica abaixo de 300 KB comprimido (gzip), com code-splitting por rota. | [MVP] |
| AC-PERF-03 | Listeners do Firestore são sempre escopados e paginados — nunca `onSnapshot` em coleção inteira sem limite. | [MVP] |
| AC-PERF-04 | Todo `onSnapshot` é cancelado ao desmontar o componente (sem vazamento de listener). | [MVP] |
| AC-PERF-05 | Uma sala com 40 alunos simultâneos, 200 chamados e 1000 mensagens permanece fluida. | [MVP] |
| AC-PERF-06 | O custo de leituras do Firestore por aluno por aula fica dentro do plano gratuito para até 10 salas ativas. | [MVP] |
| AC-PERF-07 | O app funciona offline em modo leitura (cache do Firestore) e enfileira envios feitos sem conexão. | [POS] |

## 16. Documentação (`DOC`)

| ID | Critério | Prioridade |
|---|---|---|
| AC-DOC-01 | O `README.md` descreve o projeto real (não o texto padrão do Create React App), com instalação, scripts e arquitetura. | [MVP] |
| AC-DOC-02 | Existe `docs/HISTORICO.md` narrando a evolução do projeto versão a versão, com as decisões técnicas e seus porquês. | [MVP] |
| AC-DOC-03 | Existe `docs/MANUAL-ALUNO.md` com linguagem simples e capturas de tela. | [MVP] |
| AC-DOC-04 | Existe `docs/MANUAL-PROFESSOR.md` cobrindo salas, PIN, perks e moderação. | [MVP] |
| AC-DOC-05 | Existe `docs/ARQUITETURA.md` com o modelo de dados, as coleções do Firestore e os diagramas de fluxo. | [MVP] |
| AC-DOC-06 | Existe `CONTRIBUTING.md` com o fluxo de branches, o padrão de commits e como rodar os testes. | [MVP] |
| AC-DOC-07 | Toda decisão arquitetural relevante é registrada como ADR em `docs/adr/`. | [MVP] |

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
