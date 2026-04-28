param(
  [string]$HostName = "root@178.104.165.186",
  [string]$ApiRepoPath = "D:\PROJECT\solane-api",
  [string]$RemoteBase = "/srv/solane-run",
  [switch]$AllowDirty,
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

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

function Get-Commit {
  param([string]$RepoPath)
  (git -C $RepoPath rev-parse --short HEAD).Trim()
}

$webRepo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiRepo = (Resolve-Path $ApiRepoPath).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "solane-vps-deploy-$timestamp"
$webArchive = Join-Path $tempRoot "solane-run-web-$timestamp.tar.gz"
$apiArchive = Join-Path $tempRoot "solane-run-api-$timestamp.tar.gz"
$remoteScriptPath = Join-Path $tempRoot "remote-deploy.sh"
$remoteWebArchive = "/tmp/solane-run-web-$timestamp.tar.gz"
$remoteApiArchive = "/tmp/solane-run-api-$timestamp.tar.gz"
$remoteScript = "/tmp/solane-run-deploy-$timestamp.sh"

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
  Invoke-Step "Preflight" {
    Assert-CleanGit $webRepo
    Assert-CleanGit $apiRepo
    Write-Host "Web: $(Get-Commit $webRepo)"
    Write-Host "API: $(Get-Commit $apiRepo)"
    Invoke-External "ssh" @("-o", "BatchMode=yes", "-o", "ConnectTimeout=10", $HostName, "whoami >/dev/null && docker --version >/dev/null && docker compose version >/dev/null")
  }

  if (-not $SkipChecks) {
    Invoke-Step "Frontend checks" {
      Invoke-External "npm.cmd" @("run", "lint:web") $webRepo
      Invoke-External "npm.cmd" @("run", "build:web") $webRepo
      Invoke-External "npm.cmd" @("run", "security:web") $webRepo
      Invoke-External "npm.cmd" @("run", "w3c:web") $webRepo
      Invoke-External "node.exe" @("scripts\verify-ui.mjs") $webRepo
      Invoke-External "docker" @("compose", "-f", "infra\docker-compose.yml", "config") $webRepo
      Invoke-External "docker" @("compose", "-f", "infra\caddy\docker-compose.yml", "config") $webRepo
    }

    Invoke-Step "API checks" {
      Invoke-External ".venv\Scripts\python.exe" @("-m", "pytest") $apiRepo
      Invoke-External ".venv\Scripts\python.exe" @("-m", "compileall", "-q", "app", "tests") $apiRepo
      Invoke-External ".venv\Scripts\python.exe" @("-m", "pip", "check") $apiRepo
      Invoke-External "docker" @("compose", "config") $apiRepo
    }
  }
  else {
    Write-Host "SkipChecks enabled; local verification skipped." -ForegroundColor Yellow
  }

  Invoke-Step "Create git archives" {
    Invoke-External "git" @("-C", $webRepo, "archive", "--format=tar.gz", "-o", $webArchive, "HEAD")
    Invoke-External "git" @("-C", $apiRepo, "archive", "--format=tar.gz", "-o", $apiArchive, "HEAD")
    Write-Host "Created $webArchive"
    Write-Host "Created $apiArchive"
  }

  $remoteDeploy = @'
set -euo pipefail

BASE="$1"
WEB_ARCHIVE="$2"
API_ARCHIVE="$3"
TS="$4"
WEB_COMMIT="$5"
API_COMMIT="$6"

LOCK="$BASE/deploy.lock"
RELEASE="$BASE/releases/$TS"
ENV_FILE="$BASE/shared/solane-run.env"

rollback() {
  echo "Deployment failed; attempting rollback..." >&2
  set +e
  if [ -d "$BASE/repo/web.previous" ]; then
    rm -rf "$BASE/repo/web.failed-$TS"
    [ -d "$BASE/repo/web" ] && mv "$BASE/repo/web" "$BASE/repo/web.failed-$TS"
    mv "$BASE/repo/web.previous" "$BASE/repo/web"
  fi
  if [ -d "$BASE/repo/api.previous" ]; then
    rm -rf "$BASE/repo/api.failed-$TS"
    [ -d "$BASE/repo/api" ] && mv "$BASE/repo/api" "$BASE/repo/api.failed-$TS"
    mv "$BASE/repo/api.previous" "$BASE/repo/api"
  fi
  if [ -f "$ENV_FILE" ] && [ -d "$BASE/repo/api" ]; then
    (cd "$BASE/repo/api" && docker compose --env-file "$ENV_FILE" up -d) || true
  fi
  if [ -f "$ENV_FILE" ] && [ -d "$BASE/repo/web" ]; then
    (cd "$BASE/repo/web" && docker compose --env-file "$ENV_FILE" -f infra/docker-compose.yml up -d) || true
  fi
  if [ -d "$BASE/caddy" ]; then
    (cd "$BASE/caddy" && docker compose up -d) || true
  fi
}

cleanup() {
  rm -rf "$LOCK"
}

if ! mkdir "$LOCK" 2>/dev/null; then
  echo "Another Solane deployment is already running: $LOCK" >&2
  exit 1
fi
trap cleanup EXIT
trap rollback ERR

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$RELEASE" "$BASE/backups" "$BASE/repo" "$BASE/cache" "$BASE/caddy/data" "$BASE/caddy/config"
cp "$WEB_ARCHIVE" "$RELEASE/web-$WEB_COMMIT.tar.gz"
cp "$API_ARCHIVE" "$RELEASE/api-$API_COMMIT.tar.gz"

if [ -d "$BASE/repo" ]; then
  tar -C "$BASE" -czf "$BASE/backups/repo-$TS.tgz" repo
fi

rm -rf "$BASE/repo/web.new" "$BASE/repo/api.new"
mkdir -p "$BASE/repo/web.new" "$BASE/repo/api.new"
tar -xzf "$RELEASE/web-$WEB_COMMIT.tar.gz" -C "$BASE/repo/web.new"
tar -xzf "$RELEASE/api-$API_COMMIT.tar.gz" -C "$BASE/repo/api.new"

test -f "$BASE/repo/web.new/infra/docker-compose.yml"
test -f "$BASE/repo/web.new/apps/web/Dockerfile"
test -f "$BASE/repo/api.new/docker-compose.yml"
test -f "$BASE/repo/api.new/Dockerfile"

rm -rf "$BASE/repo/web.previous" "$BASE/repo/api.previous"
[ -d "$BASE/repo/web" ] && mv "$BASE/repo/web" "$BASE/repo/web.previous"
[ -d "$BASE/repo/api" ] && mv "$BASE/repo/api" "$BASE/repo/api.previous"
mv "$BASE/repo/web.new" "$BASE/repo/web"
mv "$BASE/repo/api.new" "$BASE/repo/api"

if ! docker network inspect solane-run >/dev/null 2>&1; then
  docker network create solane-run >/dev/null
fi

cp "$BASE/repo/web/infra/caddy/Caddyfile.solane-run" "$BASE/caddy/Caddyfile"
cp "$BASE/repo/web/infra/caddy/docker-compose.yml" "$BASE/caddy/docker-compose.yml"
sed -i 's/\r$//' "$BASE/caddy/Caddyfile" "$BASE/caddy/docker-compose.yml"

cd "$BASE/repo/api"
docker compose --env-file "$ENV_FILE" build
docker compose --env-file "$ENV_FILE" up -d

cd "$BASE/repo/web"
docker compose --env-file "$ENV_FILE" -f infra/docker-compose.yml build
docker compose --env-file "$ENV_FILE" -f infra/docker-compose.yml up -d

cd "$BASE/caddy"
docker compose up -d

curl -fsS http://127.0.0.1:8001/health >/dev/null
curl -fsSI http://127.0.0.1:8080 >/dev/null
curl -fsS https://solane-run.app/api/eve/status >/dev/null
curl -fsSI https://solane-run.app >/dev/null

find "$BASE/backups" -maxdepth 1 -type f -name 'repo-*.tgz' -printf '%T@ %p\n' | sort -n | head -n -8 | cut -d' ' -f2- | xargs -r rm -f
find "$BASE/releases" -maxdepth 1 -type d -name '20*' -printf '%T@ %p\n' | sort -n | head -n -12 | cut -d' ' -f2- | xargs -r rm -rf

echo "Solane deploy complete"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
'@

  [System.IO.File]::WriteAllText($remoteScriptPath, ($remoteDeploy -replace "`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))

  Invoke-Step "Upload release" {
    Invoke-External "scp" @($webArchive, "${HostName}:$remoteWebArchive")
    Invoke-External "scp" @($apiArchive, "${HostName}:$remoteApiArchive")
    Invoke-External "scp" @($remoteScriptPath, "${HostName}:$remoteScript")
  }

  Invoke-Step "Deploy on VPS" {
    $webCommit = Get-Commit $webRepo
    $apiCommit = Get-Commit $apiRepo
    Invoke-External "ssh" @($HostName, "chmod +x $remoteScript && bash $remoteScript '$RemoteBase' '$remoteWebArchive' '$remoteApiArchive' '$timestamp' '$webCommit' '$apiCommit'")
  }

  Invoke-Step "Done" {
    Write-Host "Deployed Solane Run to https://solane-run.app" -ForegroundColor Green
  }
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
