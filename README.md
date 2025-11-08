# Balancer

A portfolio advisory tool for crypto. Advisory-only (no auto-trading) with hourly price ingestion, daily cool-off on rebalance actions, and a clean web UI.

- Project spec: docs/spec.md
- Data model and APIs: docs/spec.md#backend-and-db
- UI and testing: docs/spec.md#frontend-and-testing
- Operations and setup: docs/spec.md#operations-and-deployment

## Repository Structure

- docs/spec.md — Living specification (source of truth for design/decisions)
- docs/initial-data/
  - tokenlist.txt — Prototype portfolio snapshot (tab-delimited, GBP values)
  - cg-mapping.txt — Coingecko ID mapping list (first line is authoritative)
- Spec.md — Legacy spec with a relocation notice
- .env — Local secrets (e.g., COINGECKO)

## Quick Start

- Backend: Python (venv), SQLite. Config in .env (COINGECKO key).
- Frontend: Next.js + Tailwind + shadcn/ui.
- Runbook and detailed instructions live in docs/spec.md.

## Running the hourly pipeline

- Ensure `.env` is set (see Environment Variables below) and DB path is writable.
- Create and activate venv, install deps, then run once:

```bash
. .venv/bin/activate
python -m balancer.runner
```

### Cron example (hourly)

```
0 * * * * cd /path/to/balancer && . .venv/bin/activate && python -m balancer.runner >> runner.log 2>&1
```

### systemd timer (sketch)

- Service: call `python -m balancer.runner` in the repo directory with the venv activated (or use ExecStart with venv python).
- Timer: `OnCalendar=hourly`.

## Initial Data (prototype)

- docs/initial-data/tokenlist.txt
  - Columns: Token, Symbol, Price(£), Coins, Value(£), Average Buy Price(£)
  - Used by importer to seed assets/positions; currency symbols and thousands separators are normalized.
- docs/initial-data/cg-mapping.txt
  - Line 1: comma-separated Coingecko IDs used to fetch/match assets.
  - Remaining lines may contain pasted API rows; these are ignored by the importer.

## Status

MVP in planning. Spec is a living document; see docs/spec.md for current decisions and roadmap.

## Contributing and Docs

- Update the living spec at `docs/spec.md` when decisions change.
- Keep `docs/initial-data/` in sync with any prototype inputs used by importers.
- Prefer small, incremental changes with clear commit messages.

## Engineering Principles (summary)

- Env-driven config: All endpoints, timeouts, API keys, and feature flags read from `.env`.
- Modularity: HTTP clients (Coingecko, FRED, Fear&Greed) separated from business services (pricing, indicators, rules).
- Observability: JSONL alerts and structured logs for key events.
- Testability: Clients/services designed for dependency injection and mocking.

### Environment Variables

- COINGECKO: Coingecko API key (optional for public endpoints)
- FRED_API_KEY: FRED API key for DXY proxy (DTWEXBGS)
- DB_PATH: path to SQLite DB (default: balancer.db)
- LOG_PATH: alerts log path (default: alerts.jsonl)
- INITIAL_TOKENLIST: path to initial portfolio file (default: docs/initial-data/tokenlist.txt)
- CG_MAPPING_FILE: path to Coingecko IDs mapping (default: docs/initial-data/cg-mapping.txt)
- BASE_CCY: default valuation currency (default: USD)
- HTTP_TIMEOUT: request timeout seconds (default: 20)
- HTTP_RETRIES: number of retries (default: 2)
- COOLOFF_DAYS: rule cool-off in days (default: 1)
