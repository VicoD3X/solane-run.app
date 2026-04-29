# Solane Run Local Workspace

This document is the stable local process for developing Solane Run on Windows.
It is intentionally centered in the public frontend repository because this repo
is the cockpit that operators open first, while `solane-api` and `solane-bot`
remain sibling services.

## Folder Layout

Expected local layout:

```text
D:\PROJECT
|-- Solane Run
|-- solane-api
`-- solane-bot
```

## Daily Commands

From `D:\PROJECT\Solane Run`:

```powershell
npm run local:start
npm run local:status
npm run local:doctor
npm run local:stop
```

Start the Discord bot too:

```powershell
npm run local:start:bot
```

## What `local:start` Does

- stops existing Solane local frontend/API/bot processes when possible
- starts `solane-api` with Uvicorn on `127.0.0.1`
- starts the Vite frontend on `127.0.0.1`
- injects the actual API URL into Vite through `VITE_API_BASE_URL`
- writes all logs to `dev.logs/`
- writes the active ports to `dev.logs/local-state.json`

Preferred ports:

| Service | Preferred port |
| --- | --- |
| API | `8001` |
| Web | `5173` |

If Windows keeps a ghost socket on `8001`, the script automatically moves the
API to `8002+` and points the frontend at that port for the current session.
This prevents the local UI from silently talking to a stale API process.

## URLs

The script prints the active URLs after startup. Defaults are:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/route-intel
http://127.0.0.1:8001/health
```

If fallback ports are used, trust the printed URLs or run:

```powershell
npm run local:status
```

## Logs

Frontend logs:

```text
D:\PROJECT\Solane Run\dev.logs\web.out.log
D:\PROJECT\Solane Run\dev.logs\web.err.log
```

API logs:

```text
D:\PROJECT\solane-api\dev.logs\api.out.log
D:\PROJECT\solane-api\dev.logs\api.err.log
```

Bot logs when started through the local cockpit:

```text
D:\PROJECT\Solane Run\dev.logs\bot.out.log
D:\PROJECT\Solane Run\dev.logs\bot.err.log
```

## Health Probes

`npm run local:doctor` checks:

- Node.js and npm availability
- API virtualenv availability
- frontend dependencies
- optional bot virtualenv
- API `/health`
- Route Intel gate attribution on Uedama
- frontend `/route-intel`

The Uedama gate attribution probe exists because stale local API processes can
make the UI show `Gate kill attribution unavailable` even when the online VPS is
healthy.

## Standalone Services

Use standalone commands only when debugging a single service.

API:

```powershell
cd D:\PROJECT\solane-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Frontend:

```powershell
cd "D:\PROJECT\Solane Run"
$env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
npm run dev:web
```

Bot:

```powershell
cd D:\PROJECT\solane-bot
$env:SOLANE_API_BASE_URL = "http://127.0.0.1:8001"
.\.venv\Scripts\python.exe -m solane_ai
```

For normal work, prefer the cockpit scripts.

## Cleanup

Stop native local services:

```powershell
npm run local:stop
```

Stop native services and local Docker previews:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-stop.ps1 -IncludeDocker
```

If Windows still reports a phantom socket after a crash, start again with:

```powershell
npm run local:start
```

The API will use the next free port and keep the frontend aligned.
