# Project Spec (Living Document)

This document captures the current design, decisions, and pointers for the Balancer MVP. It is updated as we iterate.

## Objectives

- Advisory-only portfolio assistant. No trade execution.
- Hourly data refresh. Suggestions respect a 1-day cool-off after an applied rebalance.
- Default valuation in USD. Toggle to GBP and BTC.
- Stablecoins (incl. GBP as "cash") excluded from the 30-asset cap and shown as an aggregated row with expansion.

## Rules and Strategy

- 100% Profit Laddering:
  - At 1x (100% profit): sell 33% of position.
  - At 2x (200% profit): sell 33% of the remaining position.
  - At 4x (400% profit): sell 33% of the remaining position.
  - Continue doubling thresholds as needed.
- Drift-based Rebalancing:
  - Target weights emphasize large caps over small caps.
  - Rebalance when drift > 20% of target and suggested trade ≥ $50 (both configurable).
- Minimum trade size: $50 USD equivalent (configurable).
- Manual Execution:
  - User records buys/sells manually for now. Avg cost kept as a single figure per asset.

### Target Weights (seed defaults)

- Cap and exclusions: Max 30 non-stable assets; stables (incl. GBP cash) excluded from cap.
- Tiered by market cap rank (editable per asset):
  - Mega (Top 2: BTC/ETH): 40% total (BTC 25%, ETH 15%).
  - Large (Ranks 3–20): 30% total; per-asset cap 6%.
  - Mid (Ranks 21–100): 20% total; per-asset cap 3%.
  - Small (Ranks 101–300): 8% total; per-asset cap 2%.
  - Moonshots (>300/new): 2% total; per-asset cap 1%.
- Narrative guardrail: Max 40% in any single narrative (asset can have multiple; highest-weighted counts).

## Portfolio Inputs

- Import from a raw token list (tab/CSV-like), with GBP amounts supported.
- Single average cost per asset, sourced initially from Koinly and entered manually.
- Non-asset fiat (GBP) treated as cash balance and grouped with stablecoins for display.
  - Prototype file: docs/initial-data/tokenlist.txt

## Data and Integrations

- Prices and market data: Coingecko (CG) primary; public sources acceptable for indicators.
- Mapping file: docs/initial-data/cg-mapping.txt is the source of truth for ID resolution.
  - The first line (comma-separated Coingecko IDs) is authoritative; any subsequent pasted API rows are ignored by tooling.
- Indicators to track (stored in DB):
  - BTC Dominance (BTCD)
  - DXY (Dollar Index)
  - Crypto Fear & Greed Index
- News: start as a stub; explore sources later (CG/CMC/RSS/X).

### Indicator Providers (confirmed)

- BTCD: Coingecko `/global` (market_cap_percentage.btc). Fallback: compute from BTC market cap / total crypto market cap via CG.
- DXY: FRED DTWEXBGS (trade-weighted USD index) via FRED API (free key in `.env`). Option to swap to Alpha Vantage DXY later.
- Fear & Greed: alternative.me `/fng/`.
- Caching: BTCD/F&G hourly TTL; DXY daily TTL. Persist snapshots in `indicators`.

## Backend and DB

- Language: Python (venv), ORM: SQLAlchemy; migrations: Alembic.
- DB: SQLite for dev; schema designed to migrate to MySQL.
- Archival: one SQLite DB per calendar year for time-series heavy tables; simple retrieval across years.

### Proposed Schema (tables)

- assets(id, symbol, name, coingecko_id, is_stable, is_fiat, eligible_note, active)
- portfolios(id, name, base_currency)
- positions(id, portfolio_id, asset_id, coins, avg_cost_ccy, avg_cost_per_unit, as_of)
- prices(id, asset_id, ccy, price, at)
- fx_rates(id, base_ccy, quote_ccy, rate, at)
- targets(id, portfolio_id, asset_id, target_weight, min_trade_usd, drift_band)
- narratives(id, name, active)
- asset_narratives(asset_id, narrative_id)
- alerts(id, portfolio_id, asset_id, type, message, payload_json, severity, at)
- trades_manual(id, portfolio_id, asset_id, side, qty, price_ccy, price, fee_ccy, fee, note, at)
- indicators(id, name, value, at)
- news_items(id, asset_id, source, title, url, at)

### Conventions

- Store prices from CG in USD and GBP. Derive BTC valuations via BTCUSD or direct vs_currency=btc.
- Average cost may be stored in GBP when provided; convert to the viewing currency for P+L.
- Stablecoins set: {USDC, USDT, SUSDe} + GBP as cash. Grouped in UI and excluded from 30-cap.

## Services and Jobs

- Importer: parse token list, sanitize symbols and currency formats, map via cg-mapping.txt, upsert assets/positions.
- Price job (hourly): fetch prices (USD/GBP; BTC if used), update prices and fx_rates.
- Rule engine:
  - Laddered 100% rule triggers with 1-day cool-off per asset after an action is taken.
  - Drift checks against targets with thresholds and min-trade enforcement.
- Alerts: write JSONL to a log file; surface summaries in the UI.

## Frontend and Testing

- Frontend: Next.js + Tailwind + shadcn/ui.
- Views:
  - Dashboard: total P+L, top/bottom 5, BTCD/DXY/Fear&Greed, currency toggle.
  - Portfolio table: token, coins, MV, P+L, period moves; stablecoins aggregated with expansion.
  - Actions panel: suggested sells/rebalances with rationale and cool-off status.
  - Asset detail: summary, narratives, links (CG/CMC), news modal (stub).
- Testing:
  - Backend: pytest; lint: ruff.
  - Frontend: ESLint; Playwright later.
  - Markdown: markdownlint with --fix in CI.

## Operations and Deployment

- Local dev hosting initially.
- Hourly pricing via cron or systemd timer on Ubuntu 24.04; write a small setup guide later.
- Secrets via .env; no auth in dev.
- Commit DB initially; reassess at ~20MB.
- No Docker for prototype; production could use Kubernetes (Rancher Desktop available locally).

## Roadmap

- Phase 1 (MVP): importer, pricing job, laddered 100% rule, drift checks, JSONL alerts, minimal dashboard.
- Phase 2: narratives tagging, indicators, news feed, UI polish.
- Phase 3: advanced analytics, external alert channels, auto-mapping tooling, performance tuning.

## Open Items

- Confirm indicator data sources and acceptable staleness.
- Finalize target weight initialization (e.g., by market cap tiers with editable overrides).
- Define the exact stablecoin set beyond USDC/USDT/SUSDe/GBP if needed.
