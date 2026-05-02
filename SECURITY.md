# Security Policy

The public calculator is closed. This repository now contains only public edge configuration and documentation.

Do not add:

- secrets or `.env` values
- Discord tokens
- EVE SSO credentials
- private ESI scopes
- pricing formulas
- route-risk formulas
- contract/order automation
- frontend calculator code

Sensitive runtime logic belongs in the private `solane-api` service. Discord presentation logic belongs in `solane-discord`.

Production behavior:

- `/` returns a static closed-service notice.
- `/api/*` is proxied to the private Solane API container.
- Security headers are applied by Caddy.

To report a vulnerability, open a private GitHub security advisory when available or contact Victor A. through GitHub.
