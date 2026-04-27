# Solane Run Repository Instructions

Solane Run is an EVE Online freight calculator. Keep contributions aligned with the beta direction:

- The UI is English-only.
- Prefer public ESI and SDE-backed data. Do not add EVE SSO, private ESI scopes, saved account data, private structures, or contract/order workflows unless explicitly requested.
- Preserve the premium space-logistics visual system: dark interface, restrained futuristic styling, short-radius panels, fixed Solane violet UI accents, and service colors only for route/system security context.
- Frontend code lives in `apps/web` and uses React, Vite, TypeScript, Tailwind, local fonts, and lucide-react icons.
- Backend code lives in `apps/api` and uses FastAPI, Pydantic, and async httpx.
- Keep Docker and Hetzner deployment changes in `infra`.
- Run relevant checks before finishing: `npm run lint:web`, `npm run build:web`, `npm run test:api`, and `node scripts/verify-ui.mjs` for UI changes.
