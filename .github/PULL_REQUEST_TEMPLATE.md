## Summary

-

## Repository Boundary

- [ ] This change is limited to public edge configuration, documentation, or repository hygiene.
- [ ] This change does not reintroduce calculator/frontend app code.
- [ ] This change does not include secrets, pricing formulas, private ESI logic, bot logic, or API business logic.

## Verification

- [ ] `docker compose -f infra/caddy/docker-compose.yml config`
- [ ] Caddyfile still proxies `/api/*` to `solane-api:8000`
- [ ] Caddyfile still returns the closed-service notice outside `/api/*`
