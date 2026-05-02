# Solane Run Edge Deployment

The public calculator is closed. The VPS must keep **Solane API** and **Solane Discord bot** online while the root website returns a closed-service notice.

## Production Behavior

```text
https://solane-run.app/       -> 410 closed-service message
https://solane-run.app/api/*  -> reverse proxy to solane-api:8000
```

The frontend web container is no longer part of production.

## VPS Target

- Host: `root@178.104.165.186`
- Base path: `/srv/solane-run`
- Caddy path: `/srv/solane-run/caddy`
- Shared Docker network: `solane-run`

## Edge Files

```text
infra/caddy/Caddyfile.solane-run
infra/caddy/docker-compose.yml
scripts/deploy-vps.ps1
```

The Caddyfile:

- applies baseline browser/security headers;
- proxies `/api/*` to `solane-api:8000`;
- returns the static closure message on every other path;
- does not reference `solane-web`.

## Deploy Edge Config

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-vps.ps1
```

The script:

- refuses dirty Git state by default;
- validates the local Caddy compose file;
- uploads the Caddyfile and compose file to the VPS;
- restarts Caddy;
- stops the legacy `infra-web-1` container if it exists;
- verifies root `410` and `/api/eve/status` `200`.

Use `-AllowDirty` only for temporary emergency experiments.

## API And Bot

Deploy from their own repositories:

```powershell
cd D:\PROJECT\solane-api
.\scripts\deploy-vps.ps1

cd D:\PROJECT\solane-bot
.\scripts\deploy-vps.ps1
```

## Manual Checks

```powershell
curl.exe -i https://solane-run.app/
curl.exe -sS https://solane-run.app/api/eve/status
```

On the VPS:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker logs --tail=80 solane-run-edge-caddy-1
```
