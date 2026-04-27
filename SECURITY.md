# Security Policy

Solane Run keeps the public web frontend separate from the private API.

Do not add secrets, EVE SSO credentials, private ESI scopes, pricing formulas,
contract automation, internal service rules, or operational workflows to this
repository.

Security-sensitive backend work belongs in the private `solane-api` repository.

## Frontend guardrails

The public frontend includes a first hardening layer:

- input sanitation for writable fields;
- API response normalization before rendering;
- no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, browser storage, or sourcemaps;
- Content Security Policy in the app shell and stricter deployment headers in Nginx;
- `X-Frame-Options`, `nosniff`, referrer, permissions, and cross-origin isolation headers;
- CI checks through `npm run security:web`, W3C validation, accessibility checks, linting, and build.

These controls reduce accidental injection and deployment mistakes, but they do
not make browser-side code private. Any trust boundary, pricing rule, contract
logic, ESI token, or corporation data must be enforced in `solane-api`.

To report a vulnerability, open a private GitHub security advisory when
available or contact the maintainer through the GitHub profile for Victor A.
