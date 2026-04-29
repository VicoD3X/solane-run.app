param(
  [switch]$IncludeDocker
)

$ErrorActionPreference = "Continue"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ApiRootCandidate = Join-Path $Root "..\solane-api"
$BotRootCandidate = Join-Path $Root "..\solane-bot"
$ApiRoot = if (Test-Path $ApiRootCandidate) { (Resolve-Path $ApiRootCandidate).Path } else { $null }
$BotRoot = if (Test-Path $BotRootCandidate) { (Resolve-Path $BotRootCandidate).Path } else { $null }
$StatePath = Join-Path $Root "dev.logs\local-state.json"

function Stop-LocalProcess {
  param([int]$ProcessId, [string]$Reason)
  if ($ProcessId -eq $PID -or $ProcessId -le 0) {
    return
  }
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping PID $ProcessId ($($process.ProcessName)) for $Reason"
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

$patterns = @([regex]::Escape($Root), "app\.main:app", "solane_ai")
if ($ApiRoot) { $patterns += [regex]::Escape($ApiRoot) }
if ($BotRoot) { $patterns += [regex]::Escape($BotRoot) }
$pattern = ($patterns -join "|")

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match $pattern } |
  ForEach-Object { Stop-LocalProcess -ProcessId $_.ProcessId -Reason "Solane local workspace" }

if (Test-Path $StatePath) {
  try {
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    foreach ($port in @($state.apiPort, $state.webPort)) {
      if ($port) {
        Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
          Where-Object { $_.LocalPort -eq [int]$port } |
          ForEach-Object { Stop-LocalProcess -ProcessId $_.OwningProcess -Reason "state port $port" }
      }
    }
  } catch {
    Write-Warning "Could not read local state file: $($_.Exception.Message)"
  }
}

if ($IncludeDocker) {
  if ($ApiRoot) {
    Push-Location $ApiRoot
    docker compose down
    Pop-Location
  }
  Push-Location $Root
  docker compose -f infra\docker-compose.yml down
  Pop-Location
}

Write-Host "Solane local workspace stop command completed."
