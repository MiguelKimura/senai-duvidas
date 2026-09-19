#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
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


@dataclass
class CommandResult:
    code: int
    stdout: str
    stderr: str

    @property
    def combined(self) -> str:
        return f"{self.stdout}\n{self.stderr}"


def run(cmd: list[str], cwd: Path, timeout: int | None = None) -> CommandResult:
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
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
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


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


def wait_for_quota_retry(cfg: dict[str, Any], text: str, safety_margin: int = 5) -> bool:
    """
    Handle quota exhaustion without consuming transient-failure attempts.

    If Claude tells us a reset time, sleep until that time. If it only says the
    weekly/session quota is exhausted, keep the queue alive and probe again at
    a conservative interval rather than burning through retries.
    """
    target = parse_reset_at(text)
    if target is not None:
        now = datetime.now(target.tzinfo)
        seconds = max(0, int((target - now).total_seconds()) + safety_margin)
        kind = "semanal" if is_weekly_limit(text) else "de sessão"
        print(f"[quota] Limite {kind} atingido. Reset informado pelo Claude: {target:%d/%m %H:%M}.")
        print(f"[quota] Aguardando {seconds // 3600}h {(seconds % 3600) // 60}m e tentando novamente automaticamente.")
        time.sleep(seconds)
        return True

    if is_weekly_limit(text):
        interval = int(cfg.get("quota_watch", {}).get("weekly_poll_seconds", 900))
        print("[quota] Limite semanal atingido, mas o Claude não informou o horário de reset.")
        print(f"[quota] Estado preservado; nova tentativa em {interval // 60}m.")
        time.sleep(interval)
        return True

    if is_session_limit(text):
        interval = int(cfg.get("quota_watch", {}).get("session_poll_seconds", 300))
        print("[quota] Limite de sessão atingido, mas o Claude não informou o horário de reset.")
        print(f"[quota] Estado preservado; nova tentativa em {interval // 60}m.")
        time.sleep(interval)
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
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
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


def process_task(cfg: dict[str, Any], repo: Path, task: Path, state: dict[str, Any], dry_run: bool) -> bool:
    key = task.as_posix()
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
            ensure_clean(repo, base)
            wt = create_worktree(repo, wt_root, branch, base)
            # Uma execução anterior pode ter sido interrompida (rede, quota, max_turns)
            # deixando commits na branch. Nesse caso a sessão precisa ser avisada para
            # continuar, e não recomeçar do zero.
            retomando = continuation_count > 0 or commits_ahead(wt, base) > 0
            if retomando and continuation_count == 0:
                print(f"[resume] A branch {branch} já tem {commits_ahead(wt, base)} commit(s). Continuando o trabalho anterior.")
            ok, claude_log = run_claude(cfg, wt, task, continuation=retomando, run_number=run_number)
            if not ok:
                # Session/quota reset is special: keep the worktree alive and wait.
                if is_transient(claude_log, patterns) and wait_for_quota_retry(cfg, claude_log, safety_margin):
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
            if is_transient(msg, patterns) and wait_for_quota_retry(cfg, msg, safety_margin):
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
            state["tasks"][key] = {
                "status": "failed", "branch": branch, "error": msg[-12000:],
                "attempt": run_number, "failed_at": int(time.time())
            }
            save_state(repo / cfg["project"]["state_file"], state)
            # Preserva o worktree: uma task pode representar horas de trabalho e
            # custo real de API. Apagá-la numa falha joga fora tudo que não foi
            # commitado. A próxima execução reaproveita o worktree e continua.
            preserve_worktree = True
            print(f"[failed] {task.name}: {msg}", file=sys.stderr)
            print(f"[failed] Worktree preservado em {wt}", file=sys.stderr)
            print("[failed] Rode com --reset-failed para continuar de onde parou.", file=sys.stderr)
            return False
        finally:
            if not preserve_worktree:
                remove_worktree(repo, wt)
            preserve_worktree = False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--reset-failed", action="store_true")
    parser.add_argument("--from-task", type=int, default=None)
    parser.add_argument("--to-task", type=int, default=None)
    args = parser.parse_args()

    repo = Path.cwd()
    cfg = load_yaml(repo / "automation.yaml")
    state_path = repo / cfg["project"]["state_file"]
    state = load_state(state_path)

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

    for task in sorted(tasks, key=lambda p: task_id_from_file(p)):
        if not process_task(cfg, repo, task, state, args.dry_run):
            return 1
        if args.once:
            break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
