# Contributing

Solane Run is currently a beta-stage EVE Online freight calculator. Contributions should stay focused, practical, and aligned with the public-ESI-first direction.

## Product Rules

- The interface is English-only.
- Public ESI and SDE-backed data are preferred.
- Do not add EVE SSO, private ESI scopes, saved account data, private structures, contracts, or order workflows unless the project owner explicitly requests it.
- Keep the UI useful on the first screen. This is an app surface, not a marketing landing page.
- Keep the global UI accent fixed to Solane Run violet.
- Preserve service colors only where they describe route or system security context for Pochven, Thera, HighSec, LowSec, and Zarzakh.

## Development

Install dependencies:

```powershell
npm install
py -m pip install -r apps/api/requirements-dev.txt
```

Run locally:

```powershell
npm run dev:api
npm run dev:web
```

Before opening a pull request, run the relevant checks:

```powershell
npm run lint:web
npm run build:web
npm run test:api
node scripts/verify-ui.mjs
```

For Docker-related changes:

```powershell
docker compose -f infra/docker-compose.yml config
```

## Pull Requests

Good pull requests are small, specific, and easy to verify. Include screenshots for visual changes and call out any EVE data or route behavior that changed.
