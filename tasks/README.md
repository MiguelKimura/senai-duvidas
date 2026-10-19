# Tasks

Cada arquivo aqui é um **system prompt completo** para uma sessão one-shot. Não há prompt de
usuário: todo o contexto, os critérios de aceite, as notas de integração, as exigências de
red-green-refactor e as restrições de produção estão dentro do arquivo.

Leia `docs/COMO-RODAR-AS-TASKS.md` para o procedimento de execução.

| # | Arquivo | Versão | Escopo | Risco |
|---|---|---|---|---|
| — | `_PROTOCOLO.md` | — | Regras comuns a todas as tasks (leitura obrigatória) | — |
| 00 | `00-fundacao-testes.md` | 0.1.0 → 0.2.0 | Harness de testes, emuladores, lint, CI, branches | médio |
| 01 | `01-auth-oauth-sessao.md` | 0.2.0 → 0.3.0 | Google, GitHub, sessão persistente, papel seguro | alto |
| 02 | `02-tempo-brasilia.md` | 0.3.0 → 0.4.0 | Horário do servidor no fuso de Brasília | alto |
| 03 | `03-salas-pin.md` | 0.4.0 → 0.5.0 | Salas do professor com PIN e escopo de dados | **crítico** |
| 04 | `04-upload-imagens.md` | 0.5.0 → 0.6.0 | Upload, arrastar, colar, lightbox | alto |
| 05 | `05-cor-card-markdown.md` | 0.6.0 → 0.7.0 | Setinha de opções avançadas, cor, markdown | médio |
| 06 | `06-chat-overhaul-dm.md` | 0.7.0 → 0.8.0 | Chat reescrito e mensagens diretas | alto |
| 07 | `07-perks.md` | 0.8.0 → 0.9.0 | Perks, prioridade na fila, animação | médio |
| 08 | `08-animacoes-a11y.md` | 0.9.0 → 0.10.0 | Animações, acessibilidade, auto-delete | médio |
| 09 | `09-hardening-release.md` | 0.10.0 → 1.0.0 | E2E, segurança, performance, documentação, release | alto |

**A ordem é obrigatória.** Cada task assume o estado deixado pela anterior, e várias tocam os
mesmos arquivos. Rodar em paralelo gera conflito.
