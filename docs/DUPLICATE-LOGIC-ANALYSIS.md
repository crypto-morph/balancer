# Duplicate Logic Analysis

This document identifies duplicate logic across frontend and backend that should be consolidated into single points of truth.

## 🔴 Critical Duplications

### 1. **Project Root & Database Path Calculation**
**Duplicated in:** 10+ API routes

**Locations:**
- `web/src/app/api/portfolio/route.ts:7-8`
- `web/src/app/api/icons/route.ts:11-31`
- `web/src/app/api/changes/route.ts:16-17`
- `web/src/app/api/portfolio/summary/route.ts:7-8`
- `web/src/app/api/indicators/route.ts:7-8`
- `web/src/app/api/data/health/route.ts:7-8`
- `web/src/app/api/dev/db/route.ts:19-20`
- `web/src/app/api/positions/update/route.ts:23-24`
- `web/src/app/api/alerts/route.ts:7-8`

**Current Pattern:**
```typescript
const projectRoot = path.resolve(process.cwd(), '..')
const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
```

**Recommendation:** Create `web/src/lib/db-config.ts`
```typescript
export function getProjectRoot(): string {
  return path.resolve(process.cwd(), '..')
}

export function getDbPath(): string {
  const projectRoot = getProjectRoot()
  return process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
}

export function getCacheDir(): string {
  return path.join(getProjectRoot(), '.cache')
}
```

---

### 2. **Portfolio Filtering Query**
**Duplicated in:** Multiple API routes

**Locations:**
- `web/src/app/api/portfolio/route.ts:12-19`
- `web/src/app/api/icons/route.ts:35-42`
- `web/src/app/api/changes/route.ts:33-39`

**Current Pattern:**
```typescript
const posRows = db.prepare(`
  SELECT ...
  FROM positions p
  JOIN assets a ON a.id = p.asset_id
  JOIN portfolios pf ON pf.id = p.portfolio_id
  WHERE a.active = 1 AND (pf.name = COALESCE(?, pf.name))
`).all(process.env.PORTFOLIO_NAME || null)
```

**Recommendation:** Create `web/src/lib/db-queries.ts`
```typescript
export function getPortfolioName(): string | null {
  return process.env.PORTFOLIO_NAME || null
}

export function getActivePositionsQuery(db: Database) {
  return db.prepare(`
    SELECT a.symbol, a.name, a.coingecko_id, a.is_stable, a.is_fiat,
           p.coins, p.avg_cost_per_unit, a.id AS asset_id
    FROM positions p
    JOIN assets a ON a.id = p.asset_id
    JOIN portfolios pf ON pf.id = p.portfolio_id
    WHERE a.active = 1 AND (pf.name = COALESCE(?, pf.name))
  `)
}
```

---

### 3. **Latest Price Queries**
**Duplicated in:** Multiple routes with slight variations

**Locations:**
- `web/src/app/api/portfolio/route.ts:30`
- `web/src/app/api/changes/route.ts:41-42`
- `web/src/app/api/portfolio/summary/route.ts:25-27`
- `balancer/exporter.py:12-29` (Python version)

**Current Patterns:**
```typescript
// Latest USD price
const qPriceLatestUsd = db.prepare("SELECT price FROM prices WHERE asset_id = ? AND ccy = 'USD' ORDER BY at DESC LIMIT 1")

// Latest price for any currency
const qLatest = db.prepare(`SELECT price FROM prices WHERE asset_id = ? AND ccy = ? ORDER BY at DESC LIMIT 1`)

// Price at or before timestamp
const qAtOrBefore = db.prepare(`SELECT price FROM prices WHERE asset_id = ? AND ccy = ? AND at <= ? ORDER BY at DESC LIMIT 1`)
```

**Backend Equivalent:**
```python
# balancer/exporter.py
def latest_price_usd(db, asset_id: int) -> float | None:
    row = db.query(Price).filter(Price.asset_id == asset_id, Price.ccy == "USD").order_by(Price.at.desc()).first()
    return float(row.price) if row else None

def latest_price_ccy(db, asset_id: int, ccy: str) -> float | None:
    row = db.query(Price).filter(Price.asset_id == asset_id, Price.ccy == ccy).order_by(Price.at.desc()).first()
    return float(row.price) if row else None
```

**Recommendation:** 
- **Frontend:** Create `web/src/lib/db-queries.ts` with prepared statement factories
- **Backend:** Already has functions in `exporter.py` - ensure all code uses them

---

### 4. **FX Rate Queries**
**Duplicated in:** Multiple routes

**Locations:**
- `web/src/app/api/portfolio/route.ts:31`
- `web/src/app/api/changes/route.ts:43`
- `balancer/exporter.py:32-39` (Python version)
- `balancer/rules.py:43-50` (Python version)

**Current Patterns:**
```typescript
// Latest FX rate
const qFxLatest = db.prepare("SELECT rate FROM fx_rates WHERE base_ccy = ? AND quote_ccy = 'USD' ORDER BY at DESC LIMIT 1")

// FX rate at or before timestamp
const qFxAtOrBefore = db.prepare("SELECT rate FROM fx_rates WHERE base_ccy = ? AND quote_ccy = 'USD' AND at <= ? ORDER BY at DESC LIMIT 1")
```

**Backend Equivalent:**
```python
# balancer/exporter.py
def latest_fx(db, base: str, quote: str) -> float | None:
    row = db.query(FxRate).filter(FxRate.base_ccy == base, FxRate.quote_ccy == quote).order_by(FxRate.at.desc()).first()
    return float(row.rate) if row else None
```

**Recommendation:**
- **Frontend:** Add to `web/src/lib/db-queries.ts`
- **Backend:** Already has `latest_fx()` - ensure all code uses it (some routes might be duplicating)

---

### 5. **Currency Conversion Logic**
**Duplicated in:** Frontend route and backend exporter

**Locations:**
- `web/src/app/api/portfolio/route.ts:38-42`
- `balancer/exporter.py:70-74`

**Current Pattern (Frontend):**
```typescript
const price_usd = qPriceLatestUsd.get(r.asset_id)?.price ?? 0
const gbp_usd = qFxLatest.get('GBP')?.rate ?? 0
const btc_usd = qFxLatest.get('BTC')?.rate ?? 0
const price_gbp = gbp_usd > 0 ? price_usd / gbp_usd : 0
const price_btc = btc_usd > 0 ? price_usd / btc_usd : 0
```

**Current Pattern (Backend):**
```python
price_gbp = latest_price_ccy(db, pos.asset_id, "GBP") or 0.0
price_btc = latest_price_ccy(db, pos.asset_id, "BTC") or 0.0
mv_gbp = price_gbp * pos.coins if price_gbp else (mv_usd / gbp_usd if gbp_usd else 0.0)
mv_btc = price_btc * pos.coins if price_btc else (mv_usd / btc_usd if btc_usd else 0.0)
```

**Recommendation:** 
- **Frontend:** Create `web/src/lib/currency-conversion.ts` with conversion utilities
- **Backend:** The logic in `exporter.py` is already centralized, but ensure consistency

---

### 6. **Market Value Calculation**
**Duplicated in:** Frontend route, backend exporter, and backend rules

**Locations:**
- `web/src/app/api/portfolio/route.ts:43-45`
- `balancer/exporter.py:63,70-71`
- `balancer/rules.py:72-80`

**Current Patterns:**
```typescript
// Frontend
const mv_usd = r.coins * price_usd
const mv_gbp = r.coins * price_gbp
const mv_btc = r.coins * price_btc
```

```python
# Backend - exporter.py
mv_usd = position_market_value_usd(db, pos) or 0.0
mv_gbp = price_gbp * pos.coins if price_gbp else (mv_usd / gbp_usd if gbp_usd else 0.0)
mv_btc = price_btc * pos.coins if price_btc else (mv_usd / btc_usd if btc_usd else 0.0)

# Backend - rules.py
def position_market_value_usd(db, pos: Position) -> Optional[float]:
    pb = get_price_book(db, pos.asset_id)
    if pb.usd is not None:
        return pb.usd * pos.coins
    if pb.gbp is not None:
        rate = gbp_to_usd(db)
        if rate:
            return pb.gbp * rate * pos.coins
    return None
```

**Recommendation:**
- **Backend:** `position_market_value_usd()` already exists in `rules.py` - ensure `exporter.py` uses it consistently
- **Frontend:** Create helper function in `web/src/lib/portfolio-calculations.ts`

---

### 7. **Cost Basis Calculation**
**Duplicated in:** Frontend route and backend exporter

**Locations:**
- `web/src/app/api/portfolio/route.ts:46`
- `balancer/exporter.py:64,73-74`

**Current Patterns:**
```typescript
// Frontend
const cb_usd = (r.avg_cost_per_unit || 0) * (r.coins || 0)
```

```python
# Backend
cb_usd = position_cost_basis_usd(db, pos) or 0.0
cb_gbp = (cb_usd / gbp_usd) if gbp_usd else 0.0
cb_btc = (cb_usd / btc_usd) if btc_usd else 0.0
```

**Recommendation:**
- **Backend:** `position_cost_basis_usd()` already exists in `rules.py` - ensure all code uses it
- **Frontend:** Add to `web/src/lib/portfolio-calculations.ts`

---

### 8. **Coingecko ID Extraction from Positions**
**Duplicated in:** Backend and Frontend

**Locations:**
- `balancer/price_fetcher.py:20-43` (Python)
- `web/src/app/api/icons/route.ts:35-43` (TypeScript)

**Current Patterns:**
```python
# Backend
def ids_from_positions() -> List[str]:
    with SessionLocal() as db:
        assets = db.query(Asset).join(Position, Position.asset_id == Asset.id).filter(Asset.active).all()
        ids = [a.coingecko_id for a in assets if a.coingecko_id]
        # de-duplicate
        seen = set()
        out = []
        for x in ids:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out
```

```typescript
// Frontend
const rows = db.prepare(`
  SELECT DISTINCT a.coingecko_id
  FROM positions p
  JOIN assets a ON a.id = p.asset_id
  JOIN portfolios pf ON pf.id = p.portfolio_id
  WHERE a.coingecko_id IS NOT NULL AND a.coingecko_id <> ''
    AND (pf.name = COALESCE(?, pf.name))
`).all(process.env.PORTFOLIO_NAME || null)
ids = Array.from(new Set(rows.map(r => r.coingecko_id))).filter(Boolean)
```

**Recommendation:** 
- **Frontend:** Extract to `web/src/lib/db-queries.ts`
- **Backend:** Already has function - ensure it's used consistently
- **Note:** Backend version doesn't filter by portfolio, frontend does - consider aligning

---

## 🟡 Medium Priority Duplications

### 9. **Portfolio Data Structure**
**Duplicated in:** Backend exporter and frontend route

**Locations:**
- `balancer/exporter.py:79-97` (Python payload)
- `web/src/app/api/portfolio/route.ts:50-64` (TypeScript response)

**Current Patterns:**
Both create similar asset objects with:
- `symbol`, `name`, `coingecko_id`
- `is_stable`, `is_fiat`
- `coins`
- `price_usd`, `price_gbp`, `price_btc`
- `mv_usd`, `mv_gbp`, `mv_btc`
- `cb_usd`, `cb_gbp`, `cb_btc`

**Recommendation:** 
- Define shared TypeScript types in `web/src/lib/types.ts`
- Backend should match this structure when exporting JSON

---

### 10. **Percentage Change Calculation**
**Duplicated in:** Frontend route

**Locations:**
- `web/src/app/api/changes/route.ts:6-10`

**Current Pattern:**
```typescript
function pctChange(latest: number, ref: number | null | undefined): number | null {
  if (!isFinite(latest)) return null
  return ((latest - ref) / ref) * 100
}
```

**Recommendation:** Extract to `web/src/lib/math-utils.ts` for reuse

---

### 11. **Time Calculations (days, hours, etc.)**
**Duplicated in:** Multiple routes

**Locations:**
- `web/src/app/api/changes/route.ts:49-51`
- `web/src/app/api/portfolio/summary/route.ts:12-13`

**Current Patterns:**
```typescript
const oneHour = 60 * 60 * 1000
const oneDay = 24 * oneHour
const days = (n: number) => n * oneDay
```

**Recommendation:** Create `web/src/lib/time-utils.ts`
```typescript
export const ONE_HOUR_MS = 60 * 60 * 1000
export const ONE_DAY_MS = 24 * ONE_HOUR_MS
export const days = (n: number) => n * ONE_DAY_MS
```

---

### 12. **Cache Directory Path**
**Duplicated in:** Multiple routes

**Locations:**
- `web/src/app/api/icons/route.ts:12-13`
- `web/src/app/api/changes/route.ts:18-19`

**Current Pattern:**
```typescript
const cacheDir = path.join(projectRoot, '.cache')
const cachePath = path.join(cacheDir, 'icons.json')
```

**Recommendation:** Use `getCacheDir()` from `web/src/lib/db-config.ts`

---

## 🟢 Low Priority / Minor Duplications

### 13. **Money Formatting Function**
**Duplicated in:** `market-cap-badge.tsx` (duplicates `portfolio/format.ts`)

**Locations:**
- `web/src/components/portfolio/format.ts:3-8` (shared utility)
- `web/src/components/market-cap-badge.tsx:22-27` (duplicate)

**Current Pattern:**
```typescript
// market-cap-badge.tsx (duplicate)
function formatMoney(ccy: "USD" | "GBP" | "BTC", value: number): string {
  const v = value ?? 0;
  if (ccy === "USD") return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (ccy === "GBP") return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v)} BTC`;
}
```

**Recommendation:** Import from `@/components/portfolio/format` instead of duplicating

---

### 14. **Database Connection Pattern**
**Duplicated in:** All API routes

**Current Pattern:**
```typescript
const db = new Database(dbPath)
try {
  // ... queries
} finally {
  db.close()
}
```

**Recommendation:** Create `web/src/lib/db-utils.ts` with connection helper
```typescript
export async function withDb<T>(fn: (db: Database) => T): Promise<T> {
  const db = new Database(getDbPath())
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
```

---

### 14. **Error Handling Pattern**
**Duplicated in:** All API routes

**Current Pattern:**
```typescript
try {
  // ... logic
} catch {
  return NextResponse.json({ ... }, { status: 200 })
}
```

**Recommendation:** Consider creating error handler utility, but this might be too generic

---

## 📋 Summary & Action Plan

### High Priority (Do First)
1. ✅ **Project Root & DB Path** → `web/src/lib/db-config.ts`
2. ✅ **Portfolio Filtering Query** → `web/src/lib/db-queries.ts`
3. ✅ **Latest Price Queries** → `web/src/lib/db-queries.ts`
4. ✅ **FX Rate Queries** → `web/src/lib/db-queries.ts`
5. ✅ **Currency Conversion** → `web/src/lib/currency-conversion.ts`
6. ✅ **Market Value & Cost Basis** → `web/src/lib/portfolio-calculations.ts`

### Medium Priority
7. **Coingecko ID Extraction** → `web/src/lib/db-queries.ts`
8. **Portfolio Data Types** → `web/src/lib/types.ts`
9. **Percentage Change** → `web/src/lib/math-utils.ts`
10. **Time Calculations** → `web/src/lib/time-utils.ts`
11. **Cache Directory** → Use `getCacheDir()` from db-config

### Low Priority
12. **Money Formatting** → Use existing `@/components/portfolio/format`
13. **Database Connection Helper** → `web/src/lib/db-utils.ts`
14. **Error Handling** → Consider if needed

### Backend Consolidation
- Ensure all backend code uses existing functions:
  - `latest_price_usd()`, `latest_price_ccy()` from `exporter.py`
  - `latest_fx()` from `exporter.py`
  - `position_market_value_usd()`, `position_cost_basis_usd()` from `rules.py`
  - `ids_from_positions()` from `price_fetcher.py`

---

## 🎯 Benefits

1. **Single Source of Truth**: Changes to logic only need to be made in one place
2. **Easier Testing**: Test utilities in isolation
3. **Consistency**: Same logic used everywhere ensures consistent behavior
4. **Maintainability**: Easier to understand and modify
5. **Type Safety**: Shared types ensure frontend/backend alignment

---

## 📝 Notes

- Some duplications are acceptable (e.g., simple calculations like `coins * price`)
- Focus on complex logic and queries that are likely to change
- Backend already has good consolidation in `exporter.py` and `rules.py` - ensure all code uses them
- Frontend needs more consolidation work

