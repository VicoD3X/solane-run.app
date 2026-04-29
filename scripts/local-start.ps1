param(
  [int]$PreferredApiPort = 8001,
  [int]$PreferredWebPort = 5173,
  [int]$PortSearchLimit = 20,
  [switch]$WithBot,
  [switch]$NoReset
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ApiRoot = (Resolve-Path (Join-Path $Root "..\solane-api")).Path
$BotRootCandidate = Join-Path $Root "..\solane-bot"
$BotRoot = if (Test-Path $BotRootCandidate) { (Resolve-Path $BotRootCandidate).Path } else { $null }
$LogRoot = Join-Path $Root "dev.logs"
$ApiLogRoot = Join-Path $ApiRoot "dev.logs"
$StatePath = Join-Path $LogRoot "local-state.json"

New-Item -ItemType Directory -Force -Path $LogRoot, $ApiLogRoot | Out-Null

function Get-ProcessCommandLine {
  param([int]$ProcessId)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if ($process) { return [string]$process.CommandLine }
  return ""
}

function Stop-WorkspaceProcess {
  param([int]$ProcessId, [string]$Reason)

  if ($ProcessId -eq $PID -or $ProcessId -le 0) {
    return
  }

  $commandLine = Get-ProcessCommandLine -ProcessId $ProcessId
  $isSolaneProcess =
    $commandLine -match [regex]::Escape($Root) -or
    $commandLine -match [regex]::Escape($ApiRoot) -or
    ($BotRoot -and $commandLine -match [regex]::Escape($BotRoot)) -or
    $commandLine -match "app\.main:app|solane_ai"

  if (-not $isSolaneProcess) {
    Write-Host "Keeping PID $ProcessId for $Reason because it does not look like a Solane local process."
    return
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping PID $ProcessId ($($process.ProcessName)) for $Reason"
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-PortListener {
  param([int]$Port)
  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq $Port }

  foreach ($listener in $listeners) {
    Stop-WorkspaceProcess -ProcessId $listener.OwningProcess -Reason "port $Port"
  }
}

function Stop-WorkspaceProcesses {
  $patterns = @(
    [regex]::Escape($Root),
    [regex]::Escape($ApiRoot),
    "app\.main:app",
    "solane_ai"
  )
  if ($BotRoot) {
    $patterns += [regex]::Escape($BotRoot)
  }

  $pattern = ($patterns -join "|")
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match $pattern } |
    ForEach-Object { Stop-WorkspaceProcess -ProcessId $_.ProcessId -Reason "workspace reset" }
}

function Test-PortFree {
  param([int]$Port)
  $listener = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq $Port } |
    Select-Object -First 1
  return $null -eq $listener
}

function Get-AvailablePort {
  param([int]$PreferredPort)
  for ($port = $PreferredPort; $port -lt ($PreferredPort + $PortSearchLimit); $port++) {
    if (Test-PortFree -Port $port) {
      return $port
    }
  }
  throw "No available port found from $PreferredPort to $($PreferredPort + $PortSearchLimit - 1)."
}

function Wait-HttpOk {
  param([string]$Url, [int]$Seconds = 20)

  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

if (-not $NoReset) {
  Stop-WorkspaceProcesses
  Stop-PortListener -Port $PreferredApiPort
  Stop-PortListener -Port $PreferredWebPort
  Start-Sleep -Seconds 2
}

$ApiPort = Get-AvailablePort -PreferredPort $PreferredApiPort
$WebPort = Get-AvailablePort -PreferredPort $PreferredWebPort

if ($ApiPort -ne $PreferredApiPort) {
  Write-Host "Preferred API port $PreferredApiPort is still occupied. Using $ApiPort for this local session."
}
if ($WebPort -ne $PreferredWebPort) {
  Write-Host "Preferred web port $PreferredWebPort is still occupied. Using $WebPort for this local session."
}

$ApiPython = Join-Path $ApiRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $ApiPython)) {
  throw "API virtualenv not found at $ApiPython. Create it before starting the local workspace."
}

$ApiOut = Join-Path $ApiLogRoot "api.out.log"
$ApiErr = Join-Path $ApiLogRoot "api.err.log"
$WebOut = Join-Path $LogRoot "web.out.log"
$WebErr = Join-Path $LogRoot "web.err.log"
$BotOut = Join-Path $LogRoot "bot.out.log"
$BotErr = Join-Path $LogRoot "bot.err.log"

Remove-Item -LiteralPath $ApiOut, $ApiErr, $WebOut, $WebErr, $BotOut, $BotErr -Force -ErrorAction SilentlyContinue

Start-Process `
  -FilePath $ApiPython `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$ApiPort") `
  -WorkingDirectory $ApiRoot `
  -RedirectStandardOutput $ApiOut `
  -RedirectStandardError $ApiErr `
  -WindowStyle Hidden

if (-not (Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/health" -Seconds 25)) {
  Write-Warning "API did not become healthy on port $ApiPort. Check $ApiErr."
}

$WebPath = Join-Path $Root "apps\web"
$ApiBaseUrl = "http://127.0.0.1:$ApiPort"
$WebCommand = "set VITE_API_BASE_URL=$ApiBaseUrl&& npm run dev -- --host 127.0.0.1 --port $WebPort --strictPort"
Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList @("/c", $WebCommand) `
  -WorkingDirectory $WebPath `
  -RedirectStandardOutput $WebOut `
  -RedirectStandardError $WebErr `
  -WindowStyle Hidden

if (-not (Wait-HttpOk -Url "http://127.0.0.1:$WebPort/" -Seconds 25)) {
  Write-Warning "Web app did not become reachable on port $WebPort. Check $WebErr."
}

$BotStarted = $false
if ($WithBot) {
  if (-not $BotRoot) {
    Write-Warning "Bot repository not found next to Solane Run. Skipping bot start."
  } else {
    $BotPython = Join-Path $BotRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $BotPython)) {
      Write-Warning "Bot virtualenv not found at $BotPython. Skipping bot start."
    } else {
      $BotCommand = "set SOLANE_API_BASE_URL=$ApiBaseUrl&& `"$BotPython`" -m solane_ai"
      Start-Process `
        -FilePath "cmd.exe" `
        -ArgumentList @("/c", $BotCommand) `
        -WorkingDirectory $BotRoot `
        -RedirectStandardOutput $BotOut `
        -RedirectStandardError $BotErr `
        -WindowStyle Hidden
      $BotStarted = $true
    }
  }
}

$state = [ordered]@{
  startedAt = (Get-Date).ToString("o")
  apiPort = $ApiPort
  webPort = $WebPort
  apiBaseUrl = $ApiBaseUrl
  webUrl = "http://127.0.0.1:$WebPort/"
  routeIntelUrl = "http://127.0.0.1:$WebPort/route-intel"
  aboutUrl = "http://127.0.0.1:$WebPort/about"
  withBot = [bool]$BotStarted
  root = $Root
  apiRoot = $ApiRoot
  botRoot = $BotRoot
}
$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StatePath -Encoding UTF8

Write-Host ""
Write-Host "Solane local workspace is running."
Write-Host "Web:        http://127.0.0.1:$WebPort/"
Write-Host "RouteIntel: http://127.0.0.1:$WebPort/route-intel"
Write-Host "API:        http://127.0.0.1:$ApiPort"
Write-Host "Logs:       $LogRoot"
Write-Host ""
Write-Host "Use npm run local:status to inspect it, and npm run local:stop to stop it."
