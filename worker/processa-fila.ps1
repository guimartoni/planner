# -------------------------------------------------------------------
# Planner - Fila IA: processa os pedidos de IA do Planner usando o
# Claude Code instalado neste PC (assinatura Claude Max, sem custo de API).
#
# O app grava pedidos em "OneDrive - Finamob\planner-ia-fila\pedido-*.json";
# este script gera "resposta-*.json" na mesma pasta e o OneDrive sincroniza.
# Agendado no Windows (Agendador de Tarefas) a cada 5 minutos.
# -------------------------------------------------------------------
$ErrorActionPreference = "Continue"
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$fila = Join-Path $env:USERPROFILE "OneDrive - Finamob\planner-ia-fila"
if (-not (Test-Path $fila)) { exit 0 }
$pedidos = Get-ChildItem -Path $fila -Filter "pedido-*.json" -File -ErrorAction SilentlyContinue
if (-not $pedidos) { exit 0 }

$log = Join-Path $PSScriptRoot "fila-log.txt"
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "dd/MM HH:mm:ss"), $m) -Encoding utf8 }

Set-Location $PSScriptRoot

foreach ($p in $pedidos) {
  $id = $p.BaseName -replace "^pedido-", ""
  $respPath = Join-Path $fila "resposta-$id.json"
  if (Test-Path $respPath) { Remove-Item $p.FullName -Force -Confirm:$false; continue }
  try {
    $pedido = Get-Content -Raw -Path $p.FullName -Encoding utf8 | ConvertFrom-Json
    if (-not $pedido.prompt) { Remove-Item $p.FullName -Force -Confirm:$false; continue }
    Log "Processando $id (tipo: $($pedido.tipo))"
    $out = $pedido.prompt | & claude -p --model sonnet --output-format text
    $texto = ($out | Out-String).Trim()
    if (-not $texto) { Log "Sem resposta do Claude para $id (tento de novo na proxima rodada)"; continue }
    $m = [regex]::Match($texto, "\{[\s\S]*\}")
    $conteudo = if ($m.Success) { $m.Value } else { $texto }
    $resp = @{ id = $id; resposta = $conteudo; em = (Get-Date -Format "o") } | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($respPath, $resp, (New-Object System.Text.UTF8Encoding($false)))
    Remove-Item $p.FullName -Force -Confirm:$false
    Log "Resposta gravada para $id"
  } catch {
    Log "Erro em $id : $($_.Exception.Message)"
  }
}

# mantém o log pequeno
try {
  if ((Test-Path $log) -and ((Get-Item $log).Length -gt 200KB)) {
    $tail = Get-Content $log -Tail 200
    Set-Content -Path $log -Value $tail -Encoding utf8
  }
} catch {}
