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
