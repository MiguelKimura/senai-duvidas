<#
    Registra a fila de automação como Tarefa Agendada do Windows, para que ela
    suba sozinha ao fazer logon — sem ninguém digitar nada no terminal.

    Rode UMA vez, como o seu próprio usuário (não como administrador: a fila
    precisa das credenciais do `claude` e do `gh`, que são por usuário).

        .\scripts\instalar-tarefa-agendada.ps1

    Para remover:

        Unregister-ScheduledTask -TaskName "SenaiDuvidas-Fila" -Confirm:$false
#>

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path "$PSScriptRoot\..").Path
$nome = "SenaiDuvidas-Fila"

Write-Host "Repositório: $repo"

# Confere os pré-requisitos antes de agendar, para a tarefa não falhar em silêncio.
foreach ($cmd in @("python", "git", "gh", "claude", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "'$cmd' não está no PATH. A tarefa agendada falharia. Instale/configure antes."
    }
}
& gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh não está autenticado. Rode 'gh auth login' antes." }

$acao = New-ScheduledTaskAction `
    -Execute "python" `
    -Argument "$repo\scripts\claude_queue.py" `
    -WorkingDirectory $repo

# Ao fazer logon, com 2 minutos de folga para a rede subir.
$gatilho = New-ScheduledTaskTrigger -AtLogOn
$gatilho.Delay = "PT2M"

$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 10) `
    -ExecutionTimeLimit (New-TimeSpan -Days 3)

# -RunLevel Limited e sem -User SYSTEM: precisa ser VOCÊ, para ter as credenciais.
Register-ScheduledTask `
    -TaskName $nome `
    -Action $acao `
    -Trigger $gatilho `
    -Settings $config `
    -RunLevel Limited `
    -Force | Out-Null

Write-Host ""
Write-Host "Tarefa '$nome' registrada." -ForegroundColor Green
Write-Host ""
Write-Host "  Rodar agora:        Start-ScheduledTask -TaskName '$nome'"
Write-Host "  Ver situação:       Get-ScheduledTask -TaskName '$nome' | Get-ScheduledTaskInfo"
Write-Host "  Acompanhar o log:   Get-Content '$repo\.automation\queue.log' -Wait -Tail 40"
Write-Host "  Parar:              Stop-ScheduledTask -TaskName '$nome'"
Write-Host "  Remover:            Unregister-ScheduledTask -TaskName '$nome' -Confirm:`$false"
Write-Host ""
Write-Host "A fila tem trava: se já houver uma rodando, a nova sai sozinha." -ForegroundColor DarkGray
