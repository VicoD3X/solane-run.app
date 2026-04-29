$ErrorActionPreference = "Continue"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ApiRoot = (Resolve-Path (Join-Path $Root "..\solane-api")).Path
$BotRootCandidate = Join-Path $Root "..\solane-bot"
$BotRoot = if (Test-Path $BotRootCandidate) { (Resolve-Path $BotRootCandidate).Path } else { $null }
$StatePath = Join-Path $Root "dev.logs\local-state.json"

function Write-Check {
  param([string]$Name, [bool]$Ok, [string]$Detail = "")
  $status = if ($Ok) { "OK" } else { "WARN" }
  Write-Host ("[{0}] {1} {2}" -f $status, $Name, $Detail)
}

Write-Host "Solane local doctor"
Write-Host ""

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
Write-Check "Node.js" ($null -ne $node) ($(if ($node) { (& node --version) } else { "not found" }))
Write-Check "npm" ($null -ne $npm) ($(if ($npm) { (& npm --version) } else { "not found" }))

$apiPython = Join-Path $ApiRoot ".venv\Scripts\python.exe"
Write-Check "API virtualenv" (Test-Path $apiPython) $apiPython
if (Test-Path $apiPython) {
  try {
    $version = & $apiPython --version
    Write-Check "API Python" $true $version
  } catch {
    Write-Check "API Python" $false $_.Exception.Message
  }
}

$nodeModules = Join-Path $Root "node_modules"
Write-Check "Frontend dependencies" (Test-Path $nodeModules) $nodeModules

if ($BotRoot) {
  $botPython = Join-Path $BotRoot ".venv\Scripts\python.exe"
  Write-Check "Bot repository" $true $BotRoot
  Write-Check "Bot virtualenv" (Test-Path $botPython) $botPython
} else {
  Write-Check "Bot repository" $false "not found next to Solane Run"
}

$apiPort = 8001
$webPort = 5173
if (Test-Path $StatePath) {
  try {
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    if ($state.apiPort) { $apiPort = [int]$state.apiPort }
    if ($state.webPort) { $webPort = [int]$state.webPort }
    Write-Check "Local state" $true $StatePath
  } catch {
    Write-Check "Local state" $false $_.Exception.Message
  }
} else {
  Write-Check "Local state" $false "workspace has not been started through scripts/local-start.ps1"
}

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/health" -TimeoutSec 5
  Write-Check "API health" $true "port $apiPort, $($health.service)"
} catch {
  Write-Check "API health" $false "port $apiPort, $($_.Exception.Message)"
}

try {
  $detail = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/route-intel/crossroads/30002768" -TimeoutSec 10
  $gateCount = @($detail.gates).Count
  Write-Check "Gate attribution probe" ($gateCount -gt 0) "Uedama gates=$gateCount"
} catch {
  Write-Check "Gate attribution probe" $false $_.Exception.Message
}

try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$webPort/route-intel" -UseBasicParsing -TimeoutSec 5
  Write-Check "Frontend route-intel" ($response.StatusCode -eq 200) "port $webPort"
} catch {
  Write-Check "Frontend route-intel" $false "port $webPort, $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Tip: npm run local:start chooses a fallback API port automatically if Windows keeps a ghost socket on 8001."
