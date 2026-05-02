param(
  [string]$HostName = "root@178.104.165.186",
  [string]$RemoteBase = "/srv/solane-run",
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param([string]$Title, [scriptblock]$Command)
  Write-Host ""
  Write-Host "== $Title ==" -ForegroundColor Cyan
  & $Command
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = (Get-Location).Path
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath exited with code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

function Assert-CleanGit {
  param([string]$RepoPath)

  if ($AllowDirty) {
    Write-Host "AllowDirty enabled for $RepoPath" -ForegroundColor Yellow
    return
  }

  $status = git -C $RepoPath status --porcelain
  if ($status) {
    Write-Host $status
    throw "Refusing to deploy dirty repository: $RepoPath"
  }
}

function Get-RootStatus {
  try {
    $request = [System.Net.WebRequest]::Create("https://solane-run.app/")
    $request.Timeout = 20000
    $response = $request.GetResponse()
    try {
      return [int]$response.StatusCode
    }
    finally {
      $response.Close()
    }
  }
  catch [System.Net.WebException] {
    if ($_.Exception.Response) {
      $response = $_.Exception.Response
      try {
        return [int]$response.StatusCode
      }
      finally {
        $response.Close()
      }
    }
    throw
  }
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$caddyfile = Join-Path $repo "infra\caddy\Caddyfile.solane-run"
$compose = Join-Path $repo "infra\caddy\docker-compose.yml"

Invoke-Step "Preflight" {
  Assert-CleanGit $repo
  Invoke-External "ssh" @("-o", "BatchMode=yes", "-o", "ConnectTimeout=10", $HostName, "whoami >/dev/null && docker --version >/dev/null && docker compose version >/dev/null")
  Invoke-External "docker" @("compose", "-f", "infra\caddy\docker-compose.yml", "config", "--quiet") $repo
}

Invoke-Step "Upload Caddy edge config" {
  Invoke-External "ssh" @($HostName, "mkdir -p '$RemoteBase/caddy/data' '$RemoteBase/caddy/config'")
  Invoke-External "scp" @($caddyfile, "${HostName}:$RemoteBase/caddy/Caddyfile")
  Invoke-External "scp" @($compose, "${HostName}:$RemoteBase/caddy/docker-compose.yml")
}

Invoke-Step "Restart edge" {
  Invoke-External "ssh" @($HostName, "cd '$RemoteBase/caddy' && docker compose up -d && docker exec solane-run-edge-caddy-1 caddy validate --config /etc/caddy/Caddyfile")
}

Invoke-Step "Stop legacy frontend container if present" {
  Invoke-External "ssh" @($HostName, "docker stop infra-web-1 >/dev/null 2>&1 || true")
}

Invoke-Step "Verify public behavior" {
  $rootStatus = Get-RootStatus
  if ($rootStatus -ne 410) {
    throw "Expected https://solane-run.app/ to return 410, got $rootStatus"
  }

  $api = Invoke-WebRequest -Uri "https://solane-run.app/api/eve/status" -UseBasicParsing -TimeoutSec 20
  if ($api.StatusCode -ne 200) {
    throw "Expected /api/eve/status 200, got $($api.StatusCode)"
  }

  Write-Host "Root: 410 closed" -ForegroundColor Green
  Write-Host "API: 200 online" -ForegroundColor Green
}
