<#
    Faz a fila de automação subir sozinha, sem ninguém digitar no terminal.

    Dois modos:

      .\scripts\instalar-inicio-automatico.ps1
          Coloca um atalho na pasta Inicializar do Windows. Roda ao fazer logon,
          em janela oculta, e NÃO precisa de administrador. É o modo recomendado.

      .\scripts\instalar-inicio-automatico.ps1 -TarefaAgendada
          Usa o Agendador de Tarefas. Dá mais controle (reinício automático,
          limite de execução), mas exige PowerShell aberto COMO ADMINISTRADOR.

    Para desinstalar:

      .\scripts\instalar-inicio-automatico.ps1 -Remover
#>

[CmdletBinding()]
param(
    [switch]$TarefaAgendada,
    [switch]$Remover
)

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..").Path
$nome    = "SenaiDuvidas-Fila"
$startup = [Environment]::GetFolderPath("Startup")
$vbs     = Join-Path $startup "$nome.vbs"

# ---------------------------------------------------------------- remover
if ($Remover) {
    if (Test-Path $vbs) {
        Remove-Item $vbs -Force
        Write-Host "Atalho de inicializacao removido." -ForegroundColor Green
    }
    $t = Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
    if ($t) {
        try {
            Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction Stop
            Write-Host "Tarefa agendada removida." -ForegroundColor Green
        } catch {
            Write-Warning "Nao foi possivel remover a tarefa agendada: $($_.Exception.Message)"
            Write-Warning "Abra o PowerShell como administrador e rode de novo."
        }
    }
    return
}

Write-Host "Repositorio: $repo"
Write-Host ""

# ------------------------------------------------- conferencia previa
foreach ($cmd in @("python", "git", "gh", "claude", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "'$cmd' nao esta no PATH. A fila falharia ao iniciar. Resolva antes."
    }
}
& gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh nao esta autenticado. Rode 'gh auth login' antes." }
Write-Host "Pre-requisitos conferidos." -ForegroundColor DarkGray

# ================================================= modo tarefa agendada
if ($TarefaAgendada) {
    $ehAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $ehAdmin) {
        throw ("Registrar tarefa agendada exige PowerShell COMO ADMINISTRADOR. " +
               "Abra elevado e rode de novo, ou use o modo padrao (sem -TarefaAgendada), " +
               "que nao precisa de elevacao.")
    }

    $acao = New-ScheduledTaskAction -Execute "python" `
        -Argument "$repo\scripts\claude_queue.py" -WorkingDirectory $repo

    $gatilho = New-ScheduledTaskTrigger -AtLogOn
    $gatilho.Delay = "PT2M"

    $config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) `
        -ExecutionTimeLimit (New-TimeSpan -Days 3)

    Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho `
        -Settings $config -RunLevel Limited -Force -ErrorAction Stop | Out-Null

    # Nao confie no cmdlet: confirme que a tarefa existe de verdade.
    if (-not (Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue)) {
        throw "O registro nao falhou explicitamente, mas a tarefa nao existe. Nada foi instalado."
    }

    Write-Host ""
    Write-Host "Tarefa agendada '$nome' registrada e verificada." -ForegroundColor Green
    Write-Host "  Rodar agora:   Start-ScheduledTask -TaskName '$nome'"
    Write-Host "  Ver situacao:  Get-ScheduledTask -TaskName '$nome' | Get-ScheduledTaskInfo"
    Write-Host "  Parar:         Stop-ScheduledTask -TaskName '$nome'"
}
# ============================================ modo pasta Inicializar
else {
    # O .vbs existe para rodar em janela OCULTA. Um .bat piscaria uma janela
    # preta a cada logon e ficaria com o console aberto o tempo todo.
    # O PATH do processo criado no logon pode ser menor que o do seu terminal.
    # Como as cinco ferramentas acabaram de ser VALIDADAS neste PATH, gravamos
    # ele dentro do .vbs para a fila herdar exatamente o mesmo ambiente.
    $pathAtual = $env:PATH -replace '"', '""'

    $conteudo = @"
' Sobe a fila de automacao do Projeto Duvidas SENAI em janela oculta.
' Gerado por scripts\instalar-inicio-automatico.ps1 — nao edite a mao.
' O PATH abaixo foi capturado na instalacao, ja validado.
Set sh = CreateObject("WScript.Shell")
sh.Environment("Process")("PATH") = "$pathAtual"
sh.CurrentDirectory = "$repo"
sh.Run "python ""$repo\scripts\claude_queue.py""", 0, False
"@
    Set-Content -Path $vbs -Value $conteudo -Encoding Unicode

    if (-not (Test-Path $vbs)) { throw "Nao foi possivel criar $vbs" }

    Write-Host ""
    Write-Host "Inicio automatico instalado (sem precisar de administrador)." -ForegroundColor Green
    Write-Host "  Atalho:        $vbs"
    Write-Host "  Rodar agora:   wscript.exe `"$vbs`""
    Write-Host "  Remover:       .\scripts\instalar-inicio-automatico.ps1 -Remover"
}

Write-Host ""
Write-Host "Acompanhar:      Get-Content `"$repo\.automation\queue.log`" -Wait -Tail 40 -Encoding UTF8"
Write-Host "Parar a fila:    encerre o processo python (Get-Process python | Stop-Process)"
Write-Host ""
Write-Host "A fila tem trava: se ja houver uma rodando, a nova sai sozinha." -ForegroundColor DarkGray
