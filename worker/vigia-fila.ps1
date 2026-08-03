# -------------------------------------------------------------------
# Planner - Vigia da Fila IA: fica residente (invisível) e processa os
# pedidos de IA do Planner NA HORA em que chegam na pasta do OneDrive,
# usando o Claude Code deste PC (assinatura Claude Max, sem custo de API).
# Inicia junto com o Windows (atalho na pasta Inicializar).
# -------------------------------------------------------------------
$ErrorActionPreference = "Continue"

# garante uma única instância
$criou = $false
$mtx = New-Object System.Threading.Mutex($true, "PlannerFilaIAVigia", [ref]$criou)
if (-not $criou) { exit 0 }

$fila = Join-Path $env:USERPROFILE "OneDrive - Finamob\planner-ia-fila"
$processa = Join-Path $PSScriptRoot "processa-fila.ps1"

# processa o que já estiver pendente ao iniciar
if (Test-Path $fila) { & $processa }

# espera a pasta existir (caso o OneDrive ainda não tenha criado)
while (-not (Test-Path $fila)) { Start-Sleep -Seconds 60 }

$fsw = New-Object System.IO.FileSystemWatcher
$fsw.Path = $fila
$fsw.Filter = "pedido-*.json"
$fsw.EnableRaisingEvents = $true
Register-ObjectEvent $fsw Created -SourceIdentifier PlannerPedido | Out-Null
Register-ObjectEvent $fsw Renamed -SourceIdentifier PlannerPedidoR | Out-Null

while ($true) {
  # acorda com pedido novo; a cada 5 min faz uma varredura de segurança
  $e = Wait-Event -Timeout 300
  if ($e) { Remove-Event -EventIdentifier $e.EventIdentifier -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2   # deixa o OneDrive terminar de gravar o arquivo
  & $processa
}
