#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

try:
    import yaml
except ImportError:
    print("Instale PyYAML: python -m pip install pyyaml", file=sys.stderr)
    raise


# Quando o processo pai não tem console — é o caso quando a fila sobe pelo atalho
# oculto da Inicialização —, o Windows ALOCA UM CONSOLE NOVO para cada programa
# de console que ele chama, e esse console aparece na tela. Como a fila chama
# git, gh, claude e npm o tempo todo, o resultado são janelas abrindo sozinhas.
# CREATE_NO_WINDOW suprime isso sem afetar a captura da saída pelos pipes.
SEM_JANELA = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0

_EXECUTAVEIS: dict[str, list[str]] = {}


def resolver_executavel(nome: str) -> list[str]:
    """
    Devolve o prefixo de comando para um executável.

    No Windows, CreateProcess (que é o que o subprocess usa) só encontra .exe:
    ele não aplica PATHEXT. Ferramentas instaladas pelo npm viram shims .cmd,
    e chamá-las pelo nome puro devolve WinError 2. shutil.which() aplica PATHEXT,
    e um .cmd/.bat precisa ser executado através do cmd.exe.
    """
    if nome in _EXECUTAVEIS:
        return _EXECUTAVEIS[nome]

    caminho = shutil.which(nome)
    if not caminho:
        raise RuntimeError(
            f"'{nome}' não foi encontrado no PATH deste processo.\n"
            f"Se funciona no seu terminal mas não aqui, o PATH do processo que "
            f"iniciou a fila é diferente do PATH do terminal.\n"
            f"PATH visto pela fila: {os.environ.get('PATH', '(vazio)')}"
        )

    if sys.platform == "win32" and caminho.lower().endswith((".cmd", ".bat")):
        prefixo = ["cmd.exe", "/c", caminho]
    else:
        prefixo = [caminho]

    _EXECUTAVEIS[nome] = prefixo
    return prefixo


def conferir_espaco(repo: Path, minimo_gb: float = 5.0) -> None:
    """
    Cada worktree recebe seu próprio `npm install` — centenas de MB. Ficar sem
    espaço no meio de uma task desperdiça o trabalho já pago da sessão, então
    vale conferir antes de começar.
    """
    uso = shutil.disk_usage(repo)
    livre_gb = uso.free / (1024 ** 3)
    print(f"[preflight] disco    -> {livre_gb:.1f} GB livres")
    if livre_gb < minimo_gb:
        raise RuntimeError(
            f"Apenas {livre_gb:.1f} GB livres; o recomendado é pelo menos {minimo_gb:.0f} GB.\n"
            f"Cada worktree instala seu próprio node_modules. Libere espaço antes de rodar.\n"
            f"Candidatos a limpeza: 'npm cache clean --force', worktrees antigos em "
            f".automation/worktrees, e a pasta build/."
        )


def conferir_ferramentas(nomes: list[str]) -> None:
    """Falha cedo e com mensagem clara, em vez de WinError 2 no meio da fila."""
    faltando = []
    for nome in nomes:
        try:
            prefixo = resolver_executavel(nome)
            print(f"[preflight] {nome:8} -> {prefixo[-1]}")
        except RuntimeError:
            faltando.append(nome)
    if faltando:
        raise RuntimeError(
            f"Ferramentas ausentes no PATH: {', '.join(faltando)}.\n"
            f"PATH visto pela fila: {os.environ.get('PATH', '(vazio)')}"
        )


@dataclass
class CommandResult:
    code: int
    stdout: str
    stderr: str

    @property
    def combined(self) -> str:
        return f"{self.stdout}\n{self.stderr}"


def run(cmd: list[str], cwd: Path, timeout: int | None = None) -> CommandResult:
    if cmd and not os.path.isabs(cmd[0]):
        cmd = resolver_executavel(cmd[0]) + list(cmd[1:])
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        # No Windows, text=True sem encoding usa a codificação local (cp1252 em
        # PT-BR), que não decodifica a saída UTF-8 do git, do gh e do Claude.
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
        creationflags=SEM_JANELA,
    )
    return CommandResult(p.returncode, p.stdout, p.stderr)


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"tasks": {}, "history": []}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, state: dict[str, Any]) -> None:
    """
    Grava o estado de forma atômica (tmp + replace), para que uma falha no meio
    da escrita não deixe um state.json truncado.

    Uma falha aqui NÃO derruba a fila: o estado é conveniência, enquanto a
    verdade sobre o trabalho feito está nos commits das branches. Disco cheio
    ao gravar o estado não pode custar uma task inteira.
    """
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)
    except OSError as exc:
        print(
            f"[estado] Não foi possível gravar {path.name}: {exc}\n"
            f"[estado] A fila continua; o trabalho está nos commits das branches.",
            file=sys.stderr,
        )


def chave_da_task(repo: Path, task: Path) -> str:
    """
    Chave do estado, relativa à raiz do repositório.

    Caminho absoluto como chave amarra o estado à pasta: mover o projeto (para
    um SSD, para fora do OneDrive, para outra máquina) faria toda task concluída
    parecer pendente e ser refeita.
    """
    try:
        return task.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return task.as_posix()


def migrar_chaves_do_estado(repo: Path, state: dict[str, Any]) -> bool:
    """Converte chaves absolutas gravadas por versões anteriores em relativas."""
    tasks = state.get("tasks") or {}
    convertidas: dict[str, Any] = {}
    mudou = False

    for chave, valor in tasks.items():
        nova = chave
        if "/" in chave and (":" in chave.split("/", 1)[0] or chave.startswith("/")):
            # Caminho absoluto: aproveita o sufixo a partir de "tasks/".
            marcador = "/tasks/"
            if marcador in chave:
                nova = "tasks/" + chave.split(marcador, 1)[1]
                mudou = True
        convertidas[nova] = valor

    if mudou:
        state["tasks"] = convertidas
        for item in state.get("history", []):
            caminho = item.get("task", "")
            if "/tasks/" in caminho:
                item["task"] = "tasks/" + caminho.split("/tasks/", 1)[1]
        print("[estado] Chaves absolutas convertidas em relativas (estado agora é portátil).")
    return mudou


def task_id_from_file(task: Path) -> int | None:
    m = re.match(r"^(\d\d)-", task.name)
    return int(m.group(1)) if m else None


def branch_from_task(task: Path) -> str:
    text = task.read_text(encoding="utf-8")
    m = re.search(r'^branch:\s*["\']([^"\']+)["\']\s*$', text, re.M)
    if not m:
        raise RuntimeError(f"A task {task.name} não define 'branch:' no frontmatter.")
    return m.group(1)


def is_transient(text: str, patterns: list[str]) -> bool:
    lower = text.lower()
    return any(p.lower() in lower for p in patterns)


def is_weekly_limit(text: str) -> bool:
    lower = text.lower()
    markers = [
        "weekly limit",
        "weekly usage limit",
        "weekly quota",
        "week limit",
        "weekly usage",
        "weekly limit reached",
        "weekly quota reached",
        "resets next week",
    ]
    return any(m in lower for m in markers)


def is_session_limit(text: str) -> bool:
    lower = text.lower()
    markers = [
        "session limit",
        "session usage limit",
        "hit your session limit",
        "session quota",
    ]
    return any(m in lower for m in markers)


def is_max_turns(text: str) -> bool:
    lower = text.lower()
    markers = [
        "reached maximum number of turns",
        "maximum number of turns",
        "max_turns",
        "error_max_turns",
    ]
    return any(m in lower for m in markers)


def wait_for_quota_retry(cfg: dict[str, Any], text: str, safety_margin: int = 5,
                         repo: Path | None = None) -> bool:
    """
    Handle quota exhaustion without consuming transient-failure attempts.

    If Claude tells us a reset time, sleep until that time. If it only says the
    weekly/session quota is exhausted, keep the queue alive and probe again at
    a conservative interval rather than burning through retries.
    """
    def dormir(caminho: Path | None, segundos: int) -> None:
        if caminho is not None:
            dormir_vigiando_volume(caminho, segundos)
        else:
            time.sleep(segundos)

    target = parse_reset_at(text)
    if target is not None:
        now = datetime.now(target.tzinfo)
        seconds = max(0, int((target - now).total_seconds()) + safety_margin)
        kind = "semanal" if is_weekly_limit(text) else "de sessão"
        print(f"[quota] Limite {kind} atingido. Reset informado pelo Claude: {target:%d/%m %H:%M}.")
        print(f"[quota] Aguardando {seconds // 3600}h {(seconds % 3600) // 60}m e tentando novamente automaticamente.")
        dormir(repo, seconds)
        return True

    if is_weekly_limit(text):
        interval = int(cfg.get("quota_watch", {}).get("weekly_poll_seconds", 900))
        print("[quota] Limite semanal atingido, mas o Claude não informou o horário de reset.")
        print(f"[quota] Estado preservado; nova tentativa em {interval // 60}m.")
        dormir(repo, interval)
        return True

    if is_session_limit(text):
        interval = int(cfg.get("quota_watch", {}).get("session_poll_seconds", 300))
        print("[quota] Limite de sessão atingido, mas o Claude não informou o horário de reset.")
        print(f"[quota] Estado preservado; nova tentativa em {interval // 60}m.")
        dormir(repo, interval)
        return True

    return False


def parse_reset_at(text: str) -> datetime | None:
    """
    Parse Claude messages like:
      'resets 5:50pm (America/Sao_Paulo)'
      'reset at 17:50'
    Returns the next reset datetime in America/Sao_Paulo.
    """
    patterns = [
        # Examples: "resets 5:50pm", "resets 17:50", "resets 12am", "resets 12:00am"
        r"resets?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?",
        r"resets?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?",
    ]
    match = None
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            break
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    ampm = (match.group(3) or "").lower()
    if ampm:
        if hour == 12:
            hour = 0
        if ampm == "pm":
            hour += 12

    tz = ZoneInfo("America/Sao_Paulo")
    now = datetime.now(tz)
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target


def repositorio_acessivel(repo: Path) -> bool:
    """Testa leitura E escrita: um volume removido falha nas duas."""
    try:
        if not (repo / ".git").exists():
            return False
        sonda = repo / ".automation" / ".sonda"
        sonda.parent.mkdir(parents=True, exist_ok=True)
        sonda.write_text("ok", encoding="utf-8")
        sonda.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def esperar_repositorio(repo: Path, tentativas: int = 120, intervalo: int = 30) -> bool:
    """
    Aguarda o volume do repositório voltar.

    Num SSD externo isso acontece o tempo todo: desconectar o drive, levar o
    notebook para outro lugar, o volume ressurgir com a mesma letra. Vale mais
    esperar do que abortar uma task que já custou tempo e API.
    """
    if repositorio_acessivel(repo):
        return True

    print(f"[volume] {repo} ficou inacessível. O drive foi desconectado?", file=sys.stderr)
    print(f"[volume] Reconecte-o: a fila tenta de novo a cada {intervalo}s.", file=sys.stderr)

    for tentativa in range(1, tentativas + 1):
        time.sleep(intervalo)
        if repositorio_acessivel(repo):
            print(f"[volume] Voltou após {tentativa * intervalo // 60} min. Retomando.")
            return True

    print(f"[volume] Desisti após {tentativas * intervalo // 60} min.", file=sys.stderr)
    return False


def dormir_vigiando_volume(repo: Path, segundos: int, fatia: int = 300) -> None:
    """
    Dorme em fatias, conferindo o volume entre elas.

    Uma espera de quota pode durar horas — é justamente quando o notebook sai
    da mesa e o SSD é desconectado.
    """
    restante = segundos
    while restante > 0:
        atual = min(fatia, restante)
        time.sleep(atual)
        restante -= atual
        if not repositorio_acessivel(repo):
            esperar_repositorio(repo)


def backoff_seconds(cfg: dict[str, Any], failure_count: int) -> int:
    retry = cfg["retry"]
    initial = int(retry["initial_delay_seconds"])
    maximum = int(retry["max_delay_seconds"])
    multiplier = float(retry.get("multiplier", 2))
    return min(maximum, int(initial * (multiplier ** max(0, failure_count - 1))))


def ensure_clean(repo: Path, base: str) -> None:
    # Ignore only orchestrator-local state; it must never be committed.
    result = run(["git", "status", "--porcelain", "--untracked-files=all"], repo)
    dirty = [line for line in result.stdout.splitlines() if not line.startswith("?? .automation/") and not line.startswith("?? .automation\\")]
    if dirty:
        raise RuntimeError(
            "Working tree não está limpo. Existem alterações fora de .automation/. "
            "Faça commit/stash antes de iniciar.\n" + "\n".join(dirty)
        )
    fetch = run(["git", "fetch", "origin", base], repo)
    if fetch.code != 0:
        raise RuntimeError("git fetch falhou:\n" + fetch.combined)


def branch_exists(repo: Path, branch: str) -> bool:
    return run(["git", "show-ref", "--verify", f"refs/heads/{branch}"], repo).code == 0


def create_worktree(repo: Path, root: Path, branch: str, base: str) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    wt = root / branch.replace("/", "__")
    if wt.exists():
        return wt

    if branch_exists(repo, branch):
        # Important: an existing branch is intentionally reused. Its base is verified separately.
        r = run(["git", "worktree", "add", str(wt), branch], repo)
    else:
        r = run(["git", "worktree", "add", "-b", branch, str(wt), f"origin/{base}"], repo)
    if r.code != 0:
        raise RuntimeError(r.combined)
    return wt


def remove_worktree(repo: Path, wt: Path) -> None:
    if wt.exists():
        run(["git", "worktree", "remove", "--force", str(wt)], repo)


def claude_command(cfg: dict[str, Any], prompt: str) -> list[str]:
    c = cfg["claude"]
    cmd = [c.get("command", "claude"), "-p", prompt, "--output-format", "json"]
    if c.get("model"):
        cmd += ["--model", str(c["model"])]
    if c.get("max_turns"):
        cmd += ["--max-turns", str(c["max_turns"])]
    if c.get("dangerously_skip_permissions"):
        cmd += ["--dangerously-skip-permissions"]
    else:
        allowed = c.get("allowed_tools", [])
        if allowed:
            cmd += ["--allowedTools", *allowed]
    cmd += c.get("extra_args", [])
    return cmd


def run_claude(cfg: dict[str, Any], wt: Path, task: Path, continuation: bool = False, run_number: int = 1) -> tuple[bool, str]:
    roadmap = cfg["project"]["roadmap_file"]
    base = cfg["project"]["base_branch"]
    task_rel = os.path.relpath(task, wt)
    continuation_note = ""
    if continuation:
        continuation_note = f"""
This is continuation execution {run_number} of the same task. A previous Claude session on this
same worktree was interrupted before finishing — it may have hit its turn limit, a usage limit,
or a network failure. Work from that session may already be committed on this branch.

DO NOT reset, revert, clean, or discard existing work. Before anything else:
  1. Run `git log --oneline origin/{base}..HEAD` to see what has already been committed.
  2. Run `git status` and `git diff` to see uncommitted work in progress.
  3. Read the files that were already changed.
Then continue from that state toward the task's acceptance criteria. Preserve correct existing
changes and do not redo work that is already done and passing.
"""
    prompt = f"""
Read the global project rules in @{roadmap}, then read the task requirements in @{task_rel}.
{continuation_note}
Implement ONLY this task.
Inspect the existing code before editing it.
Run the project's relevant tests/build commands when implementation is complete.
Do not create or modify files outside the task scope unless required for correctness.
Do not modify secrets or .env files.

Git protocol for this project (the orchestrator handles the rest):
- You ARE expected to commit as you go, one commit per red-green-refactor cycle,
  using Conventional Commits. The visible cycle history is a deliverable.
- Do NOT run `git push`. Do NOT create a Pull Request. Do NOT merge anything.
  You are already on the correct branch in a dedicated worktree.
- Before finishing, write the Pull Request description to `.automation/pr-body.md`
  and its one-line title to `.automation/pr-title.txt`, following the PR format
  defined in the protocol file. The orchestrator pushes the branch and opens the
  PR with exactly that content.

At the end, summarize changes and validation performed.
""".strip()
    result = run(claude_command(cfg, prompt), wt)
    output = result.combined
    if result.code != 0:
        return False, output
    try:
        payload = json.loads(result.stdout)
        if payload.get("is_error"):
            return False, str(payload.get("result", output))
        return True, str(payload.get("result", output))
    except json.JSONDecodeError:
        return True, output


def validate(cfg: dict[str, Any], wt: Path) -> tuple[bool, str]:
    logs: list[str] = []
    for command in cfg["validation"]["commands"]:
        print(f"[validate] {command}")
        result = subprocess.run(
            command,
            cwd=str(wt),
            shell=True,
            text=True,
            # Mesma razão do run(): jest e npm emitem UTF-8 (símbolos de status,
            # acentos), e cp1252 quebra ao ler bytes como 0x8f.
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=SEM_JANELA,
        )
        logs.append(f"$ {command}\n{result.stdout}")
        if result.returncode != 0:
            return False, "\n".join(logs)
    return True, "\n".join(logs)


def commits_ahead(wt: Path, base: str) -> int:
    """Quantos commits a branch do worktree tem à frente de origin/<base>."""
    r = run(["git", "rev-list", "--count", f"origin/{base}..HEAD"], wt)
    if r.code != 0:
        return 0
    try:
        return int(r.stdout.strip())
    except ValueError:
        return 0


def read_side_file(wt: Path, nome: str) -> str | None:
    """Lê um arquivo que a sessão deixou em .automation/ dentro do worktree."""
    f = wt / ".automation" / nome
    if f.exists():
        conteudo = f.read_text(encoding="utf-8").strip()
        if conteudo:
            return conteudo
    return None


def create_pr(cfg: dict[str, Any], wt: Path, task: Path, branch: str, validation_log: str) -> str:
    base = cfg["project"]["base_branch"]

    # A sessão pode ter commitado sozinha (ciclos red-green-refactor, que é o esperado
    # neste projeto) ou ter deixado tudo no working tree. Os dois casos são válidos.
    # Exclui .automation/ explicitamente: é o canal lateral com a sessão (pr-body.md,
    # pr-title.txt) e nunca pode entrar no commit, mesmo que o .gitignore da branch
    # base ainda não o cubra.
    run(["git", "add", "-A", "--", ".", ":(exclude).automation"], wt)
    status = run(["git", "status", "--porcelain", "--untracked-files=no"], wt)
    pendente = bool(status.stdout.strip())
    ja_commitado = commits_ahead(wt, base)

    if not pendente and not ja_commitado:
        raise RuntimeError("A tarefa terminou sem alterações no Git.")

    if pendente:
        # Sobra do trabalho da sessão: entra como commit de fechamento.
        mensagem = (
            f"chore({task.stem}): finaliza alterações pendentes da task"
            if ja_commitado
            else f"feat(automation): implement {task.stem}"
        )
        committed = run(["git", "commit", "-m", mensagem], wt)
        if committed.code != 0:
            raise RuntimeError(committed.combined)

    total = commits_ahead(wt, base)
    print(f"[pr] {total} commit(s) à frente de origin/{base}.")

    push = run(["git", "push", "-u", "origin", branch], wt)
    if push.code != 0:
        raise RuntimeError(push.combined)

    pr_cfg = cfg["pr"]

    # A sessão escreve .automation/pr-body.md e .automation/pr-title.txt com o resumo
    # em Conventional Commits, a tabela de critérios de aceite e as provas de
    # compatibilidade. Se existirem, têm precedência sobre o template genérico.
    corpo_da_sessao = read_side_file(wt, "pr-body.md")
    titulo_da_sessao = read_side_file(wt, "pr-title.txt")

    if corpo_da_sessao:
        body = corpo_da_sessao + "\n\n---\n\n<details><summary>Log de validação do orquestrador</summary>\n\n```\n" + validation_log[-8000:] + "\n```\n\n</details>"
    else:
        body = pr_cfg["body_template"].format(
            task=task.name,
            validation=validation_log[-8000:],
            branch=branch,
            commit=run(["git", "rev-parse", "--short", "HEAD"], wt).stdout.strip(),
        )

    titulo = titulo_da_sessao or f'{pr_cfg.get("title_prefix", "[auto]")} {task.stem}'
    if titulo_da_sessao:
        titulo = titulo.splitlines()[0][:250]

    cmd = [
        "gh", "pr", "create", "--base", cfg["git"]["pr_base"], "--head", branch,
        "--title", titulo,
        "--body", body,
    ]
    if pr_cfg.get("draft", True):
        cmd.append("--draft")
    for label in pr_cfg.get("labels", []):
        cmd += ["--label", label]
    for reviewer in pr_cfg.get("reviewers", []):
        cmd += ["--reviewer", reviewer]

    pr = run(cmd, wt)
    if pr.code != 0:
        raise RuntimeError(pr.combined)
    return pr.stdout.strip()


def wait_for_merge(cfg: dict[str, Any], wt: Path, pr_url: str) -> None:
    gate = cfg.get("merge_gate", {})
    if not gate.get("require_merge_before_next_task", True):
        return
    m = re.search(r"/pull/(\d+)", pr_url)
    if not m:
        raise RuntimeError(f"Não foi possível identificar o número do PR: {pr_url}")
    pr_number = m.group(1)
    poll = int(gate.get("poll_seconds", 30))
    timeout = int(gate.get("timeout_seconds", 86400))
    started = time.time()
    print(f"[gate] PR #{pr_number} criado. Aguardando seu merge no GitHub.")
    while time.time() - started < timeout:
        r = run(["gh", "pr", "view", pr_number, "--json", "state,mergedAt,url"], wt)
        if r.code == 0:
            try:
                data = json.loads(r.stdout)
            except json.JSONDecodeError:
                data = {}
            if data.get("mergedAt") or str(data.get("state", "")).upper() == "MERGED":
                print(f"[gate] PR #{pr_number} merged. Próxima task liberada.")
                return
            if str(data.get("state", "")).upper() == "CLOSED":
                raise RuntimeError(f"PR #{pr_number} foi fechado sem merge. Fila interrompida.")
        time.sleep(poll)
    raise TimeoutError(f"Timeout aguardando merge do PR #{pr_number}.")


def process_task(cfg: dict[str, Any], repo: Path, task: Path, state: dict[str, Any], dry_run: bool, skip_claude: bool = False) -> bool:
    key = chave_da_task(repo, task)
    current = state["tasks"].get(key, {})
    if current.get("status") == "done":
        print(f"[skip] {task.name}")
        return True
    if current.get("status") == "pr_open" and current.get("pr"):
        wt_root = repo / cfg["project"]["worktree_root"]
        wt = wt_root / str(current.get("branch", "")).replace("/", "__")
        # O worktree pode já ter sido removido numa execução anterior; `gh` funciona
        # a partir da raiz do repositório do mesmo jeito.
        wait_for_merge(cfg, wt if wt.exists() else repo, str(current["pr"]))
        current["status"] = "done"
        current["completed_at"] = int(time.time())
        save_state(repo / cfg["project"]["state_file"], state)
        return True

    base = cfg["project"]["base_branch"]
    branch = branch_from_task(task)
    wt_root = repo / cfg["project"]["worktree_root"]
    wt = wt_root / branch.replace("/", "__")
    if dry_run:
        print(f"[dry-run] task={task} branch={branch} worktree={wt}")
        return True

    max_failures = int(cfg["retry"].get("max_attempts", 4))
    patterns = cfg["retry"].get("transient_patterns", [])
    safety_margin = int(cfg.get("reset_detection", {}).get("safety_margin_seconds", 5))
    failure_count = 0
    run_number = 0
    continuation_count = 0
    max_continuations = int(cfg.get("claude", {}).get("max_continuations", 10))
    preserve_worktree = False

    while True:
        run_number += 1
        print(f"\n=== {task.name} | execution {run_number} ===")
        state["tasks"][key] = {
            "status": "continuing" if continuation_count > 0 else "running",
            "attempt": run_number,
            "branch": branch,
            "continuations": continuation_count,
        }
        save_state(repo / cfg["project"]["state_file"], state)

        try:
            if not esperar_repositorio(repo):
                raise RuntimeError(f"O volume de {repo} continua inacessível.")
            ensure_clean(repo, base)
            wt = create_worktree(repo, wt_root, branch, base)
            # Uma execução anterior pode ter sido interrompida (rede, quota, max_turns)
            # deixando commits na branch. Nesse caso a sessão precisa ser avisada para
            # continuar, e não recomeçar do zero.
            retomando = continuation_count > 0 or commits_ahead(wt, base) > 0
            if retomando and continuation_count == 0:
                print(f"[resume] A branch {branch} já tem {commits_ahead(wt, base)} commit(s). Continuando o trabalho anterior.")

            if skip_claude:
                print("[skip-claude] Sessão pulada. Indo direto para validação e PR.")
                ok, claude_log = True, ""
            else:
                ok, claude_log = run_claude(cfg, wt, task, continuation=retomando, run_number=run_number)
            if not ok:
                # Session/quota reset is special: keep the worktree alive and wait.
                if is_transient(claude_log, patterns) and wait_for_quota_retry(cfg, claude_log, safety_margin, repo):
                    preserve_worktree = True
                    print("[quota] Janela de quota aguardada. Reexecutando a mesma task e preservando o worktree.")
                    continue

                # Hitting max_turns is resumable work, not a terminal failure.
                if is_max_turns(claude_log):
                    continuation_count += 1
                    if continuation_count <= max_continuations:
                        preserve_worktree = True
                        print(f"[resume] Claude atingiu max_turns. Preservando o worktree e iniciando continuação {continuation_count}/{max_continuations}.")
                        continue
                    raise RuntimeError(f"Claude atingiu max_turns {max_continuations} vezes sem concluir a task.")

                failure_count += 1
                if is_transient(claude_log, patterns) and failure_count < max_failures:
                    delay = backoff_seconds(cfg, failure_count)
                    print(f"[retry] falha transitória detectada; aguardando {delay}s")
                    time.sleep(delay)
                    continue
                raise RuntimeError("Claude Code falhou:\n" + claude_log[-12000:])

            ok, validation_log = validate(cfg, wt)
            if not ok:
                raise RuntimeError("Validação falhou:\n" + validation_log[-12000:])

            pr_url = create_pr(cfg, wt, task, branch, validation_log)
            state["tasks"][key] = {"status": "pr_open", "branch": branch, "pr": pr_url, "created_at": int(time.time())}
            save_state(repo / cfg["project"]["state_file"], state)
            wait_for_merge(cfg, wt, pr_url)
            state["tasks"][key]["status"] = "done"
            state["tasks"][key]["completed_at"] = int(time.time())
            state["history"].append({"task": key, "pr": pr_url, "branch": branch})
            save_state(repo / cfg["project"]["state_file"], state)
            print(f"[done] {task.name} -> merged {pr_url}")
            return True

        except Exception as exc:
            msg = str(exc)
            if is_transient(msg, patterns) and wait_for_quota_retry(cfg, msg, safety_margin, repo):
                preserve_worktree = True
                print("[quota] Janela de quota finalizada/aguardada. Reexecutando a mesma task.")
                continue
            if is_max_turns(msg):
                continuation_count += 1
                if continuation_count <= max_continuations:
                    preserve_worktree = True
                    print(f"[resume] Claude atingiu max_turns. Preservando o worktree e iniciando continuação {continuation_count}/{max_continuations}.")
                    continue
                raise RuntimeError(f"Claude atingiu max_turns {max_continuations} vezes sem concluir a task.")
            failure_count += 1
            if is_transient(msg, patterns) and failure_count < max_failures:
                delay = backoff_seconds(cfg, failure_count)
                print(f"[retry] {msg[:500]}")
                print(f"[retry] aguardando {delay}s")
                time.sleep(delay)
                continue
            # PRIMEIRA coisa do tratamento de erro: proteger o trabalho.
            # Uma task representa horas e custo real de API. Se qualquer passo
            # daqui para baixo falhar (disco cheio ao gravar o estado, por
            # exemplo), o finally apagaria o worktree e o trabalho não commitado
            # junto. Marcar antes garante que isso não aconteça.
            preserve_worktree = True

            state["tasks"][key] = {
                "status": "failed", "branch": branch, "error": msg[-12000:],
                "attempt": run_number, "failed_at": int(time.time())
            }
            save_state(repo / cfg["project"]["state_file"], state)
            print(f"[failed] {task.name}: {msg}", file=sys.stderr)
            print(f"[failed] Worktree preservado em {wt}", file=sys.stderr)
            print("[failed] Rode com --reset-failed para continuar de onde parou.", file=sys.stderr)
            return False
        finally:
            if not preserve_worktree:
                remove_worktree(repo, wt)
            preserve_worktree = False


def processo_vivo(pid: int) -> bool:
    if sys.platform == "win32":
        r = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            creationflags=SEM_JANELA,
        )
        return str(pid) in (r.stdout or "")
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def adquirir_trava(caminho: Path) -> bool:
    """Impede duas filas simultâneas — elas brigariam por worktrees e pelo estado."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    if caminho.exists():
        try:
            pid_antigo = int(caminho.read_text(encoding="utf-8").strip())
        except (ValueError, OSError):
            pid_antigo = -1
        if pid_antigo > 0 and processo_vivo(pid_antigo):
            print(f"[trava] Já existe uma fila rodando (PID {pid_antigo}). Saindo.")
            return False
        print(f"[trava] Trava órfã do PID {pid_antigo} removida.")
    try:
        caminho.write_text(str(os.getpid()), encoding="utf-8")
    except OSError as exc:
        print(f"[trava] Não foi possível gravar a trava: {exc}", file=sys.stderr)
        return False
    return True


def main() -> int:
    # Impede UnicodeEncodeError ao imprimir log de ferramenta com acento ou
    # símbolo quando a saída está redirecionada para arquivo no Windows.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--reset-failed", action="store_true")
    parser.add_argument("--from-task", type=int, default=None)
    parser.add_argument("--to-task", type=int, default=None)
    parser.add_argument(
        "--skip-claude",
        action="store_true",
        help="Pula a sessão do Claude na PRÓXIMA task e vai direto para validação e PR. "
             "Use quando a sessão já concluiu o trabalho e a falha foi do orquestrador.",
    )
    args = parser.parse_args()

    repo = Path.cwd()
    cfg = load_yaml(repo / "automation.yaml")
    state_path = repo / cfg["project"]["state_file"]

    # Tudo que vai para o terminal vai também para .automation/queue.log, para que
    # a fila possa rodar sem ninguém olhando e ainda ser auditável depois.
    log_path = repo / ".automation" / "queue.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    arquivo_log = log_path.open("a", encoding="utf-8", errors="replace")

    class _Tee:
        """
        Espelha a saída no console e no arquivo.

        Se o arquivo ficar inacessível — o caso típico é o SSD externo sendo
        desconectado — o destino é descartado e a fila segue escrevendo no
        console. Perder o log jamais pode derrubar o processo nem levar o
        sys.stderr junto.
        """
        def __init__(self, *destinos):
            self.destinos = list(destinos)

        def write(self, texto):
            for d in list(self.destinos):
                try:
                    d.write(texto)
                    d.flush()
                except (OSError, ValueError):
                    self.destinos.remove(d)
            return len(texto)

        def flush(self):
            for d in list(self.destinos):
                try:
                    d.flush()
                except (OSError, ValueError):
                    self.destinos.remove(d)

    sys.stdout = _Tee(sys.stdout, arquivo_log)
    sys.stderr = _Tee(sys.stderr, arquivo_log)
    print(f"\n===== fila iniciada em {datetime.now():%d/%m/%Y %H:%M:%S} (PID {os.getpid()}) =====")

    # Subindo pelo atalho da Inicialização, o SSD externo pode ainda não estar
    # montado. Esperar é melhor do que morrer tentando criar a trava nele.
    if not esperar_repositorio(repo):
        print(f"[volume] {repo} não ficou acessível. Encerrando.", file=sys.stderr)
        return 1

    trava = repo / ".automation" / "queue.lock"
    if not adquirir_trava(trava):
        return 0

    try:
        conferir_ferramentas(["git", "gh", "claude", "npm"])
        conferir_espaco(repo, float(cfg.get("project", {}).get("espaco_minimo_gb", 5)))
    except RuntimeError as exc:
        print(f"[preflight] {exc}", file=sys.stderr)
        trava.unlink(missing_ok=True)
        return 1

    state = load_state(state_path)
    if migrar_chaves_do_estado(repo, state):
        save_state(state_path, state)

    if args.reset_failed:
        for item in state["tasks"].values():
            if item.get("status") == "failed":
                item.clear()
        save_state(state_path, state)

    all_files = sorted(repo.glob(cfg["project"]["task_glob"]))
    tasks = [p for p in all_files if task_id_from_file(p) is not None]
    if not tasks:
        print("Nenhuma task encontrada.")
        return 0

    start_id = args.from_task if args.from_task is not None else int(cfg["project"].get("start_task", 1))
    end_id = args.to_task if args.to_task is not None else int(cfg["project"].get("end_task", 99))
    tasks = [p for p in tasks if start_id <= task_id_from_file(p) <= end_id]
    if not tasks:
        print(f"Nenhuma task no intervalo {start_id:02d}-{end_id:02d}.")
        return 0

    try:
        pular_claude = args.skip_claude
        for task in sorted(tasks, key=lambda p: task_id_from_file(p)):
            # Uma task já concluída é pulada sem trabalho nenhum. Ela não pode
            # consumir o --once nem o --skip-claude, que valem para a próxima
            # task que de fato for executada.
            ja_concluida = state["tasks"].get(chave_da_task(repo, task), {}).get("status") == "done"

            if not process_task(cfg, repo, task, state, args.dry_run, skip_claude=pular_claude):
                return 1

            if ja_concluida:
                continue

            pular_claude = False
            if args.once:
                break
        return 0
    finally:
        trava.unlink(missing_ok=True)
        print(f"===== fila encerrada em {datetime.now():%d/%m/%Y %H:%M:%S} =====\n")


if __name__ == "__main__":
    raise SystemExit(main())
