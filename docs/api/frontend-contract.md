# Solane Run Frontend API Contract

This public repository contains the Solane Run web frontend only. The backend owns public EVE ESI adapters, pricing rules, internal caches, and operational workflows.

The frontend talks to the Solane Run API through:

```text
VITE_API_BASE_URL=https://api.example.local
```

All examples below are frontend-facing contracts, not backend implementation guidance.

## Principles

- Keep this contract stable for the public source-available frontend.
- Do not expose internal pricing formulas, route policy internals, credentials, or operational rules.
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

The Solane Run API owns catalog construction and filtering. The current frontend expects selectable systems to include HighSec, LowSec, Pochven, Thera, and Zarzakh according to Solane Run service rules.

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

The Solane Run API owns route policy, public ESI calls, caching, fallback behavior, and internal route intelligence.

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
    "level": "moderate",
    "label": "Moderate"
  },
  "routeRisk": {
    "level": "nominal",
    "label": "Nominal",
    "isBlocking": false,
    "reason": "No elevated PVP activity detected.",
    "affectedSystems": [],
    "lastSyncedAt": "2026-04-27T07:45:00Z",
    "confidence": "calibrating",
    "trend": "stable",
    "routeStandard": "golden",
    "routeStandardLabel": "Golden Standard",
    "lowSecShipKillsLastHour": null
  },
  "jumps": 2
}
```

`shipJumpsLastHour` may be `null` when traffic data is unavailable. `routeTraffic` may report `Unavailable` and should not block the route display.

`routeRisk` is a display-safe Solane Run risk signal. `Restricted` may block the quote, while smart PVP risk levels can be shown without exposing internal scoring rules. `trend` is optional and may be `stable`, `recurrent`, `volatile`, or `unavailable`. `routeStandard` is a route comfort label only and never bypasses blocking risk controls. `lowSecShipKillsLastHour` is only populated when LowSec systems on the route are covered by Route Risk telemetry.

The calculator should prefer a blocking risk returned by quote validation/calculation over a non-blocking or unavailable route-only risk. This keeps endpoint-level restrictions visible immediately while the full route overview is still syncing.

## Route Intel

```http
GET /api/route-intel/overview
GET /api/route-intel/crossroads/{systemId}
GET /api/route-intel/gold/{routeId}
GET /api/route-intel/corruption/{systemId}
```

Route Intel is a free, frontend-facing reconnaissance surface. It exposes display-safe summaries only:

- `crossroads`: dangerous HighSec pipe watchlist, ordered by highest ESI ship kills last hour.
- `gold`: Solane Run Golden Standard route pairs and route-detail telemetry.
- `corruption`: CCP insurgency corruption level 5 and 4 systems.

The frontend may render route names, public ESI traffic/kills, corruption/suppression state, route risk labels, waypoint lists, and zKillboard display summaries. It must not assume private scoring formulas, ganker watchlist internals, or zKillboard implementation details.

`zkillIntel` is complementary and may be `null` or `status: "unavailable"` without blocking any Route Intel panel:

```json
{
  "status": "ready",
  "killmailCount": 3,
  "pvpKillmailCount": 2,
  "totalValue": 1500000000,
  "highValueKillmailCount": 1,
  "latestKillmailAt": null,
  "labels": ["isk:1b+"],
  "fetchedAt": "2026-04-29T08:00:00Z",
  "recentKillmails": [
    {
      "killmailId": 135076695,
      "totalValue": 1500000000,
      "destroyedValue": 900000000,
      "droppedValue": 600000000,
      "locationId": 50014064,
      "npc": false,
      "solo": false,
      "labels": ["pvp", "isk:1b+"]
    }
  ]
}
```

Expected overview shape:

```json
{
  "donationCharacter": "Vito Solane",
  "crossroads": {
    "status": "ready",
    "label": "12 systems",
    "summary": "HighSec gank pipe watchlist.",
    "items": [
      {
        "system": { "id": 30002768, "name": "Uedama" },
        "severity": "active_gank",
        "label": "Gank",
        "summary": "High ship loss activity detected.",
        "distanceFromJita": 6,
        "shipJumpsLastHour": 2400,
        "shipKillsLastHour": 18,
        "podKillsLastHour": 1,
        "zkillIntel": null
      }
    ]
  },
  "gold": {
    "status": "ready",
    "label": "Golden routes",
    "summary": "Manually reviewed Solane corridors.",
    "items": [
      {
        "routeId": "jita--amarr",
        "origin": { "id": 30000142, "name": "Jita" },
        "destination": { "id": 30002187, "name": "Amarr" },
        "label": "Jita - Amarr",
        "status": "ready"
      }
    ]
  },
  "corruption": {
    "status": "ready",
    "label": "Corruption watch",
    "summary": "Insurgency systems at corruption level 5 and 4.",
    "items": []
  }
}
```

Supported Route Intel statuses are `ready`, `watchlist_pending`, `calibrating`, and `unavailable`. Supported severities are `safe`, `watched`, `active_gank`, `severe`, `restricted`, `unavailable`, and `pending`.

## Contract Acceptance

```http
GET /api/solane/service-window
```

The active API uses a schedule-only EUTZ activity signal for the Contract Acceptance card. It does not require EVE SSO, corporation-contract scopes, operator login, or refresh tokens.

Expected shape:

```json
{
  "level": "high_activity",
  "label": "High Activity",
  "detail": "Prime EUTZ",
  "lastSyncedAt": "2026-04-27T10:45:00Z",
  "isFresh": true,
  "source": "schedule"
}
```

The supported levels are:

- `low_activity`: `23:00-08:00 Europe/Paris`, detail `Night EUTZ`.
- `medium_activity`: `08:00-17:00 Europe/Paris`, detail `Day EUTZ`.
- `high_activity`: `17:00-23:00 Europe/Paris`, detail `Prime EUTZ`.

The frontend should display this as service availability context only. It must not infer account, order, or corporation workload data.

## Archived Private ESI

The previous `contract-acceptance` prototype based on EVE SSO and corporation contracts was removed from the active runtime. The archival notes live in the API repository and can be revisited after production deployment is stable.

Removed endpoint:

```http
GET /api/solane/contract-acceptance
```

## Quote Validation

```http
POST /api/solane/quote/validate
```

The Solane Run API owns Solane Engine guardrails for route eligibility, cargo size availability, collateral limits, route risk restrictions, and future service rules. The public frontend may use the response to disable impossible UI options, but must not treat its local fallback as authoritative.

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
  "blockedCode": null,
  "maxCollateral": 5000000000,
  "risk": {
    "level": "nominal",
    "label": "Nominal",
    "isBlocking": false,
    "reason": "No restricted systems selected.",
    "affectedSystems": [],
    "lastSyncedAt": null,
    "confidence": "live",
    "trend": "stable",
    "routeStandard": "standard",
    "routeStandardLabel": "Standard Route",
    "lowSecShipKillsLastHour": null
  }
}
```

`allowedSizes` uses the public UI keys `small`, `medium`, and `freighter`. `blockedReason` and `blockedCode` are display-safe summaries only; detailed service rules and pricing logic remain private.

`maxCollateral` is dynamic and may change after endpoint or size changes. The frontend should render it directly and must not infer the underlying Solane Engine rules.

When `risk.isBlocking` is `true`, the frontend should block contract review and downstream quote inputs immediately, while keeping Pick Up and Destination editable so the user can leave the restricted route.

## Quote Calculation

```http
POST /api/solane/quote/calculate
```

The Solane Run API owns reward calculation, route-dependent pricing, speed availability, and internal service rules. The frontend must display the returned reward and blocked state directly.

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
  "blockedCode": null,
  "maxCollateral": 5000000000,
  "reward": 13050000,
  "currency": "ISK",
  "pricingMode": "per_jump",
  "pricingLabel": "Normal per-jump rate",
  "routeJumps": 9,
  "risk": {
    "level": "watched",
    "label": "Watched",
    "isBlocking": false,
    "reason": "Light PVP signal detected on route.",
    "affectedSystems": [{ "id": 30003504, "name": "Niarja" }],
    "lastSyncedAt": "2026-04-27T07:45:00Z",
    "confidence": "calibrating",
    "trend": "recurrent",
    "routeStandard": "standard",
    "routeStandardLabel": "Standard Route",
    "lowSecShipKillsLastHour": 18
  }
}
```

`pricingMode` may be `fixed`, `per_jump`, `hybrid`, or `blocked`. When pricing is unavailable, `valid` is `false`, `reward` is `0`, and `blockedReason` plus `blockedCode` contain display-safe messages. The frontend must not duplicate or publish pricing formulas.

When collateral is below the API minimum, `valid` is `false`, `reward` is `0`, and the frontend should display the `blockedReason` without rendering a copyable reward.

When `risk.isBlocking` is `true`, the frontend must display the blocked state directly and must not try to bypass it locally.

## Deferred Private Surfaces

The following surfaces are intentionally not part of the active calculator API. They may return later after production deployment is stable:

- internal contract templates
- future account or order workflows
- optional EVE SSO operator tooling
- corporation contract workload intelligence

When those endpoints are introduced, document only the frontend request/response contract here. Do not publish backend formulas or implementation details.
