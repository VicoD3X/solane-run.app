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

## Release ZIP

Create the local release archive:

```powershell
npm run export:zip
```

The archive is written to:

```text
D:\PROJECT\DEPLOY\Solane Run.zip
```

Upload it later to:

```text
/srv/solane-run/releases/Solane Run.zip
```

The ZIP excludes local env files, Git metadata, dependencies, build output, logs, and caches.

## One-command VPS Deploy

Use the deployment script for normal releases:

```powershell
npm run deploy:vps
```

The script:

- refuses dirty Git repositories by default;
- runs frontend checks and API checks;
- creates `tar.gz` archives from Git `HEAD`;
- uploads both frontend and API to the VPS;
- uses a server-side deployment lock;
- creates a backup under `/srv/solane-run/backups`;
- extracts into `.new` directories, then swaps atomically;
- rebuilds API, web, and the Solane-owned Caddy edge;
- verifies local health and public HTTPS endpoints;
- attempts rollback if the server-side deployment fails.

If the API repository is not at `D:\PROJECT\solane-api`, pass the path explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-vps.ps1 -ApiRepoPath "D:\PROJECT\solane-api"
```
