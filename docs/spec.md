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

- Store prices from CG in USD only. Convert to GBP and BTC on-demand via `fx_rates`.
- FX series stored:
  - `GBP->USD` (derived via USDC where possible or direct FX if added later)
  - `BTC->USD` (from BTCUSD price)
- Average cost may be stored in GBP when provided; convert to the viewing currency for P+L.
- Stablecoins set: {USDC, USDT, SUSDe} + GBP as cash. Grouped in UI and excluded from 30-cap.

### Price Retention & Compaction Policy

- Only a single value per asset per period is stored for USD prices.
- Granularity targets per asset (USD):
  - Hourly granularity for the most recent 24 hours.
  - Daily granularity for the most recent 365 days.
  - Monthly granularity forever (post 1 year).
- Compaction job maintains these guarantees by:
  - Keeping the last sample in each hour/day/month bucket.
  - Deleting superseded samples and any non-USD `prices` rows.
  - Maintaining `fx_rates` with similar granularity (hourly 24h, daily 1y, monthly forever) for GBPUSD and BTCUSD.

### Backfill and Ongoing Updates

- Backfill (Coingecko):
  - Fetch USD `market_chart` for assets up to 365 days (CG range limit).
  - Fetch USDC in GBP and USD to derive GBPUSD; store as `fx_rates`.
  - Fetch BTCUSD and store as `fx_rates` (BTC->USD).
  - Insert only USD `prices` rows; then compact.
- Runner (hourly):
  - Fetch markets (USD) for all portfolio assets.
  - Fetch USDC in GBP and USD to derive GBPUSD.
  - Record BTCUSD as `fx_rates`.
  - Insert USD prices and applicable FX; then compact.

## Services and Jobs

- Importer: parse token list, sanitize symbols and currency formats, map via cg-mapping.txt, upsert assets/positions.
- Price job (hourly): fetch USD prices (single value per asset per hour), update `fx_rates` (GBPUSD, BTCUSD), then run compaction.
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

## Engineering Principles

- Environment-driven configuration
  - All external endpoints, timeouts, keys, and feature flags are read from `.env` (or environment) with sane defaults.
  - The same `.env` can be shared between backend and frontend (do not commit secrets; use local overrides for dev).
- Modularity and separation of concerns
  - HTTP clients encapsulate API access (Coingecko, FRED, alternative.me), with retries and timeouts.
  - Services implement business logic (pricing, indicators, rules) and depend on clients.
  - Importers/CLIs are thin layers calling services.
- Testability
  - Clients and services are unit-testable via dependency injection and mocks.
- Observability
  - JSONL alerts and structured logs for key events.

### Coding Standards

**Python Deprecation Warnings**

To avoid deprecation warnings and ensure compatibility with Python 3.12+ and SQLAlchemy 2.0+:

1. **Datetime Usage**
   - ❌ **Don't use**: `datetime.utcnow()` (deprecated in Python 3.12)
   - ✅ **Use instead**: `datetime.now(UTC)` (timezone-aware)
   - **Example**:
     ```python
     from datetime import datetime, UTC
     
     # For current UTC time
     now = datetime.now(UTC)
     
     # For SQLAlchemy column defaults
     at = Column(DateTime, default=lambda: datetime.now(UTC))
     ```

2. **SQLAlchemy Query Methods**
   - ❌ **Don't use**: `db.query(Model).get(id)` (deprecated in SQLAlchemy 2.0)
   - ✅ **Use instead**: `db.get(Model, id)` (Session.get)
   - **Example**:
     ```python
     # Old way (deprecated)
     asset = db.query(Asset).get(asset_id)
     
     # New way (SQLAlchemy 2.0+)
     asset = db.get(Asset, asset_id)
     ```

3. **Running Tests**
   - Always run `./balancerctl test all` before committing to catch deprecation warnings
   - Fix warnings immediately to maintain code quality
   - Tests should pass with zero deprecation warnings (except harmless pytest/argparse warnings)

## Recent Design Decisions (Nov 2025)

- **Pricing fetch (Coingecko)**
  - Single request per run to `coins/markets` with all IDs and `vs_currency=GBP`.
  - API key: sent as `x_cg_demo_api_key` query param (mirrors a known-good request).
  - USD derived from GBP via USDC-implied FX (store `GBP->USD` in `fx_rates`).
  - BTC prices derived from BTCUSD (computed during store) for `ccy=BTC` valuations.

- **ID set used for pricing**
  - Prefer IDs from active positions to minimize API load; fallback to `docs/initial-data/cg-mapping.txt` first-line IDs.

- **Icons**
  - Next.js API `/api/icons` fetches once from Coingecko `coins/markets` and returns `{coingecko_id -> image_url}` (assets CDN URLs).
  - 1-week on-disk cache at `.cache/icons.json`; on failure, serve stale cache.
  - UI falls back to a symbol-based icon if no image is available.

- **UI formatting**
  - Currency toggle: USD/GBP/BTC tabs.
  - Labels: “Market Value” and “Cost Basis” (avoid MV/CB abbreviations).
  - Markers: `$`, `£`, and `BTC` suffix for BTC.
  - Price precision: 2dp for USD/GBP; 8dp for BTC.
  - Coins precision: fixed per-asset based on USD price (stable across tabs) to target ~$1 granularity.

- **Runner logging**
  - Timezone-aware UTC (`datetime.now(UTC)`) with single-line summary: `[runner] start -> end (duration)`.

- **Resilience**
  - Coingecko client has basic backoff for 429 and minimized request count.
  - Icons endpoint uses cache and optional key to avoid rate limiting.

- **Frontend UI (dashboard)**
  - SummaryCard shows Profit / Loss (GBP) i.e., Market Value − Cost Basis, with thousands separators and colored sign.
  - IndicatorsCard renders 30‑day sparklines for BTCD and Fear & Greed; DXY appears when data is available. Single-point series render as a flat line.
  - PortfolioPie enlarged and placed above the table for readability.
  - PortfolioTable:
    - Sortable headers; default sorted by Weight (desc).
    - Weight column shows asset % of total.
    - Coins, prices, and money values formatted with locale thousands separators.
    - Cost Basis displayed as a negative value (red) to reflect sunk cost.
    - Footer totals: Market Value, Cost Basis, and Profit / Loss rows.
    - Market cap “lozenge” per row (micro/small/medium/large/huge), tooltip shows cap in selected currency; clickable to Coingecko.
  - Editing:
    - Edit Coins and Cost Basis inline. Cost Basis entry supports USD/GBP/BTC (converted to USD on submit via per-asset FX).
    - Numeric paste normalization supports both comma and dot thousands/decimals (Koinly-friendly).

- **APIs**
  - /api/portfolio now DB-backed (not portfolio.json): returns per-asset latest prices in USD/GBP/BTC, market values, and `cb_usd`.
  - /api/portfolio/summary computes totals and deltas in GBP and returns `total_gbp`, `cost_basis_gbp`, and `net_gbp` (MV−CB).
  - /api/indicators returns latest values and 30‑day series for BTCD, DXY_TWEX, FEAR_GREED.
  - /api/icons caches 1 week and now returns both `images` and `caps` (market caps in USD). Falls back to stale cache on failure; refreshed when caps missing.

- **Dev ergonomics**
  - If Turbopack panics in dev, use webpack by setting `NEXT_DISABLE_TURBOPACK=1` (e.g., in `web/.env.local`) and restart dev.

## Roadmap

- Phase 1 (MVP): importer, pricing job, laddered 100% rule, drift checks, JSONL alerts, minimal dashboard.
- Phase 2: narratives tagging, indicators, news feed, UI polish.
- Phase 3: advanced analytics, external alert channels, auto-mapping tooling, performance tuning.

## Open Items

- Confirm indicator data sources and acceptable staleness.
- Finalize target weight initialization (e.g., by market cap tiers with editable overrides).
- Define the exact stablecoin set beyond USDC/USDT/SUSDe/GBP if needed.
