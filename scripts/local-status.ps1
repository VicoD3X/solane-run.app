$ErrorActionPreference = "Continue"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$StatePath = Join-Path $Root "dev.logs\local-state.json"
$ApiRootCandidate = Join-Path $Root "..\solane-api"
$ApiRoot = if (Test-Path $ApiRootCandidate) { (Resolve-Path $ApiRootCandidate).Path } else { $null }

$ApiPort = 8001
$WebPort = 5173
if (Test-Path $StatePath) {
  try {
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    if ($state.apiPort) { $ApiPort = [int]$state.apiPort }
    if ($state.webPort) { $WebPort = [int]$state.webPort }
    Write-Host "State: $StatePath"
    Write-Host "Started: $($state.startedAt)"
  } catch {
    Write-Warning "Could not read local state file: $($_.Exception.Message)"
  }
} else {
  Write-Host "No local state file found. Showing default ports."
}

Write-Host ""
Write-Host "Ports"
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in @($ApiPort, $WebPort, 8001, 8002, 5173) } |
  Sort-Object LocalPort |
  Select-Object LocalAddress, LocalPort, OwningProcess |
  Format-Table -AutoSize

Write-Host "Health"
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 5
  Write-Host "API: OK ($($health.service)) on $ApiPort"
} catch {
  Write-Host "API: unavailable on $ApiPort - $($_.Exception.Message)"
}

try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$WebPort/" -UseBasicParsing -TimeoutSec 5
  Write-Host "Web: OK ($($response.StatusCode)) on $WebPort"
} catch {
  Write-Host "Web: unavailable on $WebPort - $($_.Exception.Message)"
}

try {
  $detail = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/api/route-intel/crossroads/30002768" -TimeoutSec 10
  Write-Host "Gate intel probe: $($detail.system.name), gates=$(@($detail.gates).Count)"
} catch {
  Write-Host "Gate intel probe: unavailable - $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Recent web log"
$WebOut = Join-Path $Root "dev.logs\web.out.log"
if (Test-Path $WebOut) { Get-Content $WebOut -Tail 8 }

if ($ApiRoot) {
  Write-Host ""
  Write-Host "Recent API log"
  $ApiErr = Join-Path $ApiRoot "dev.logs\api.err.log"
  if (Test-Path $ApiErr) { Get-Content $ApiErr -Tail 8 }
}
