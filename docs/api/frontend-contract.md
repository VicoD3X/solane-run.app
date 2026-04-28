# Solane Run Frontend API Contract

This public repository contains the Solane Run web frontend only. The backend, EVE ESI adapters, pricing rules, internal caches, and operational workflows are private.

The frontend talks to the private API through:

```text
VITE_API_BASE_URL=https://api.example.local
```

All examples below are frontend-facing contracts, not backend implementation guidance.

## Principles

- Keep this contract stable for the public source-available frontend.
- Do not expose internal pricing formulas, route policy internals, ESI credentials, private ESI scopes, or operational rules.
- Return enough data for the UI to render a useful calculator and route reconnaissance surface.
- Prefer additive changes. Removing fields should be treated as a breaking change.
- All UI strings remain English.

## Health

```http
GET /health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "solane-run-api"
}
```

## Tranquility Status

```http
GET /api/eve/status
```

Expected shape:

```json
{
  "players": 18440,
  "server_version": "2938421",
  "start_time": "2026-04-27T11:00:00Z",
  "vip": false,
  "fetched_at": "2026-04-27T07:45:00Z"
}
```

## System Search

```http
GET /api/eve/systems?q=Jita&limit=12
```

The private API owns catalog construction and filtering. The current frontend expects selectable systems to include HighSec, LowSec, Pochven, Thera, and Zarzakh according to Solane Run service rules.

Expected item shape:

```json
{
  "id": 30000142,
  "name": "Jita",
  "securityStatus": 0.9,
  "securityDisplay": "0.9",
  "regionId": 10000002,
  "regionName": "The Forge",
  "constellationId": 20000020,
  "serviceType": "HighSec",
  "color": "#6FCF97"
}
```

## Route

```http
GET /api/eve/route?originId=30000142&destinationId=30002187
```

The private API owns route policy, ESI calls, caching, fallback behavior, and future internal route intelligence.

Expected shape:

```json
{
  "origin_id": 30000142,
  "destination_id": 30002187,
  "flag": "secure",
  "systems": [30000142, 30000144, 30002187],
  "routeSystems": [
    {
      "id": 30000142,
      "name": "Jita",
      "securityDisplay": "0.9",
      "serviceType": "HighSec",
      "color": "#6FCF97",
      "shipJumpsLastHour": 1712
    }
  ],
  "routeTraffic": {
    "totalShipJumpsLastHour": 8430,
    "knownSystems": 3,
    "totalSystems": 3,
    "coverage": 1,
    "level": "busy",
    "label": "Busy"
  },
  "jumps": 2
}
```

`shipJumpsLastHour` may be `null` when traffic data is unavailable. `routeTraffic` may report `Unavailable` and should not block the route display.

## Contract Acceptance

```http
GET /api/solane/contract-acceptance
```

The private API owns the EVE SSO token, corporation contract sync, internal queue interpretation, and freshness policy. The public frontend only receives a compact status for the Road Overview.

Expected shape:

```json
{
  "level": "fast",
  "label": "Fast",
  "lastSyncedAt": "2026-04-27T10:45:00Z",
  "isFresh": true,
  "source": "corp-contracts"
}
```

When private ESI is not configured or unavailable, the API should return:

```json
{
  "level": "syncing",
  "label": "Syncing",
  "lastSyncedAt": null,
  "isFresh": false,
  "source": "syncing"
}
```

The frontend must not infer or publish the underlying queue formula.

## Quote Validation

```http
POST /api/solane/quote/validate
```

The private API owns Solane Engine guardrails for route eligibility, cargo size availability, collateral limits, and future service rules. The public frontend may use the response to disable impossible UI options, but must not treat its local fallback as authoritative.

Expected request shape:

```json
{
  "pickupSystemId": 30000142,
  "destinationSystemId": 30002187,
  "size": "medium",
  "collateral": 5000000000
}
```

Expected response shape:

```json
{
  "valid": true,
  "allowedSizes": ["small", "medium", "freighter"],
  "selectedSizeValid": true,
  "blockedReason": null,
  "maxCollateral": 5000000000
}
```

`allowedSizes` uses the public UI keys `small`, `medium`, and `freighter`. `blockedReason` is a display-safe summary only; detailed service rules and pricing logic remain private.

`maxCollateral` is dynamic and may change after endpoint or size changes. The frontend should render it directly and must not infer the underlying Solane Engine rules.

## Quote Calculation

```http
POST /api/solane/quote/calculate
```

The private API owns reward calculation, route-dependent pricing, speed availability, and internal service rules. The frontend must display the returned reward and blocked state directly.

Expected request shape:

```json
{
  "pickupSystemId": 30000142,
  "destinationSystemId": 30002187,
  "size": "medium",
  "collateral": 5000000000,
  "speed": "normal"
}
```

Expected response shape:

```json
{
  "valid": true,
  "allowedSizes": ["small", "medium", "freighter"],
  "selectedSizeValid": true,
  "blockedReason": null,
  "maxCollateral": 5000000000,
  "reward": 13050000,
  "currency": "ISK",
  "pricingMode": "per_jump",
  "pricingLabel": "Normal per-jump rate",
  "routeJumps": 9
}
```

When pricing is unavailable or the selected speed is not supported, `valid` is `false`, `reward` is `0`, and `blockedReason` contains a display-safe message. The frontend must not duplicate or publish pricing formulas.

## Future Private Endpoints

The following surfaces are expected to move behind private Solane Run endpoints over time:

- quote pricing and reward calculation
- service availability and operational status
- route risk intelligence
- internal contract templates
- future account or order workflows

When those endpoints are introduced, document only the frontend request/response contract here. Do not publish backend formulas or implementation details.
