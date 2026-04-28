# Hetzner VPS Deployment Notes

Solane Run is deployed as a classic website: the calculator is the main public page, and `/api/*` is proxied to the private Solane Run API.

## Target

- VPS: Hetzner CPX32 Debian, `clartai-prod-01`
- Domain: `solane-run.app`
- IPv4: `178.104.165.186`
- Public edge: Solane-owned Caddy on the VPS
- Frontend container: `solane-web` on the shared Docker network `solane-run`

## DNS

Create these records in Spaceship:

```text
A     @      178.104.165.186
A     www    178.104.165.186
AAAA  @      <exact host IPv6 from Debian>
AAAA  www    <exact host IPv6 from Debian>
```

Do not use the Hetzner `/64` range directly as the `AAAA` value. Confirm the exact host address on Debian:

```bash
ip -6 addr show scope global
```

## Server Shape

Use one shared Solane directory:

```text
/srv/solane-run
|-- backups
|-- cache
|-- caddy
|   |-- Caddyfile
|   |-- config
|   `-- data
|-- releases
|-- repo
|   |-- api
|   `-- web
`-- shared
    `-- solane-run.env
```

The frontend repository is expected under:

```text
/srv/solane-run/repo/web
```

## Docker Network

Create the shared network once:

```bash
docker network create solane-run
```

The frontend compose joins that network with the alias `solane-web`. The API compose joins the same network with the alias `solane-api`.

## Caddy Integration

Solane Run now owns the public reverse proxy on ports `80` and `443`. The previous Clartai EX-Calendar stack is stopped and kept on disk only.

Use:

```bash
mkdir -p /srv/solane-run/caddy/data /srv/solane-run/caddy/config
cp infra/caddy/Caddyfile.solane-run /srv/solane-run/caddy/Caddyfile
cp infra/caddy/docker-compose.yml /srv/solane-run/caddy/docker-compose.yml
cd /srv/solane-run/caddy
docker compose up -d
```

The Caddy container must be attached to the `solane-run` Docker network so it can resolve `solane-web`.

The complete Caddy config is available in `infra/caddy/Caddyfile.solane-run`.

## Reliable VPS Deploy

Normal releases must use the one-command deployment script from this frontend repository:

```powershell
npm run deploy:vps
```

This script deploys both repositories:

```text
Frontend: D:\PROJECT\Solane Run
API:      D:\PROJECT\solane-api
```

The API path can be overridden when needed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-vps.ps1 -ApiRepoPath "D:\PROJECT\solane-api"
```

Do not deploy by manually copying ZIP files unless debugging a broken deployment script.

The script:

- refuses dirty frontend/API Git repositories by default;
- checks SSH access, Docker and Docker Compose on the VPS;
- runs frontend checks: `lint:web`, `build:web`, `security:web`, `w3c:web`, `verify-ui`, web compose config, Caddy compose config;
- runs API checks: `pytest`, `compileall`, `pip check`, API compose config;
- creates `tar.gz` archives from Git `HEAD`, not Windows ZIP files;
- uploads both archives and a temporary server-side deploy script to `/tmp`;
- creates a server-side deployment lock at `/srv/solane-run/deploy.lock`;
- backs up `/srv/solane-run/repo` to `/srv/solane-run/backups/repo-*.tgz`;
- extracts to `/srv/solane-run/repo/web.new` and `/srv/solane-run/repo/api.new`;
- swaps `.new` into `web` and `api`, keeping `.previous` for rollback;
- rebuilds API, web, and Solane-owned Caddy;
- verifies `http://127.0.0.1:8001/health`, `http://127.0.0.1:8080`, `https://solane-run.app`, and `https://solane-run.app/api/eve/status`;
- attempts rollback automatically if the server-side deployment fails after the swap begins;
- keeps only the latest backup/release history window.

Use `-SkipChecks` only for emergency redeploys after the exact same commit has already passed locally:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-vps.ps1 -SkipChecks
```

Use `-AllowDirty` only for temporary server experiments. Normal production pushes must be committed first.

## What Not To Do

- Do not manually edit `/srv/solane-run/repo/web` or `/srv/solane-run/repo/api`.
- Do not manually run `docker compose up --build` on only one service for a normal release.
- Do not copy `D:\PROJECT\DEPLOY\*.zip` for standard deployment; ZIP export remains only a portable artifact.
- Do not place secrets in either repository. Server env stays in `/srv/solane-run/shared/solane-run.env`.
- Do not start another public reverse proxy on `80/443`; Solane-owned Caddy already owns those ports.

## Manual Verification

After `npm run deploy:vps`, these checks should pass:

```powershell
curl.exe -I https://solane-run.app
curl.exe -sS https://solane-run.app/api/eve/status
```

On the VPS:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -fsS http://127.0.0.1:8001/health
curl -fsSI http://127.0.0.1:8080
```
