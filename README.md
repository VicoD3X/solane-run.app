# Solane Run

Solane Run was a beta EVE Online freight calculator. The public calculator is now closed.

The active Solane stack is:

- **Solane API**: private API for EVE Online route, risk, corruption and hauling intel.
- **Solane Discord bot**: persistent Discord panels powered by Solane API.
- **Public domain edge**: `solane-run.app` returns a closed-service notice while keeping `/api/*` online.

The beta calculator source has been preserved in the Git branch `legacy-calculator-beta` and tag `legacy-calculator-beta-2026-05-02`.

## Current Public Behavior

```text
GET /       -> 410 closed-service message
GET /api/*  -> proxied to Solane API
```

Public replacement options for freight service users:

- PushX
- Red Frog
- DSHX

## Repository Role

This repository now owns only the public edge configuration and project-level documentation. It intentionally does not ship an active frontend application.

Kept here:

- proprietary license and public project docs
- Caddy API-only reverse proxy config
- VPS edge deploy helper
- legacy branch/tag pointers

Not kept on `main`:

- React/Vite calculator app
- Route Intel frontend UI
- browser smoke tests and web build scripts
- frontend-facing quote/pricing API contract

## VPS Edge

The production Caddy config lives at:

```text
infra/caddy/Caddyfile.solane-run
```

It serves the closure notice on `/` and proxies `/api/*` to the private API container:

```text
solane-api:8000
```

Deploy only this edge config when needed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-vps.ps1
```

API and bot deployments are handled by their own repositories.

## License

Copyright 2026 Victor A. All rights reserved.

This repository is public for visibility, but it is not open source under a permissive license. Copying, redistribution, hosting, modification, or commercial use requires prior written permission.

## Disclaimer

Solane Run is an independent EVE Online logistics/intel project. It is not affiliated with or endorsed by CCP Games.
