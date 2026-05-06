# Solane Run

Public EVE Online freight calculator for Solane Run.

The site is calculator-only. It does not ship the former Route Intel cockpit,
About page, private ESI workflows, saved quotes, contract automation or operator
tools.

## Current Public Behavior

```text
GET /       -> Solane Run freight calculator
GET /api/*  -> proxied to Solane Engine through the web container
```

The calculator consumes Solane Engine endpoints:

- `GET /api/eve/status`
- `GET /api/eve/systems`
- `GET /api/eve/route`
- `GET /api/solane/service-window`
- `POST /api/solane/quote/validate`
- `POST /api/solane/quote/calculate`

## Calculator Rules

- Public freight sizes are focused on Solane Run core DST / BR service:
  `13,000 m3` and `60,000 m3`.
- NPC nullsec is not offered by the public calculator.
- Collateral limit is `6B ISK`, except `13,000 m3` LowSec service capped
  at `4B ISK`.
- Critical non-HighSec pickup/destination systems are selectable, but the rest
  of the calculator is locked with a visible alert.
- Contract Review is hidden until all freight parameters are filled.
- Traffic flow and route intel are not displayed on the public site.

## Local Development

```powershell
npm install
npm run dev:web
```

Set `VITE_API_BASE_URL=http://localhost:8001` for local API development, or
leave it empty in production so the web container calls same-origin `/api/*`.

## Verification

```powershell
npm run lint:web
npm run build:web
npm run security:web
npm run w3c:web
node scripts\verify-ui.mjs
docker compose -f infra\docker-compose.yml config
docker compose -f infra\caddy\docker-compose.yml config
```

## Deploy

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1
```

The deploy helper archives this repo and `D:\PROJECT\solane-api`, rebuilds
Engine before the web frontend, then verifies `https://solane-run.app`.

## License

Copyright 2026 Victor A. All rights reserved.

This repository is public for visibility, but it is not open source under a
permissive license. Copying, redistribution, hosting, modification or
commercial use requires prior written permission.
