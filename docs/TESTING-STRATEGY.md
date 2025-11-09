# Testing Strategy

This document outlines a comprehensive testing strategy for the Balancer project, derived from the living documentation in `README.md` and `docs/spec.md`. The goal is to ensure all major functionality—both frontend (FE) and backend (BE)—is thoroughly tested.

## Philosophy

The living documentation (`docs/spec.md` and `README.md`) serves as the **source of truth** for requirements. Each feature, rule, and behavior described in these documents should have corresponding tests that verify the implementation matches the specification.

### Key Principles

1. **Documentation-Driven Testing**: Every requirement in `docs/spec.md` should map to test cases
2. **Testability by Design**: The codebase follows dependency injection patterns (see `docs/spec.md#engineering-principles`) to enable mocking and unit testing
3. **Comprehensive Coverage**: Tests should cover:
   - Business logic (rules, calculations, validations)
   - Data transformations (imports, exports, currency conversions)
   - API endpoints (both backend services and Next.js API routes)
   - UI components and user interactions
   - Integration points (external APIs, database operations)

## Using Documentation as Test Requirements

### Mapping Spec to Tests

The following sections in `docs/spec.md` should be systematically converted to test cases:

#### 1. Rules and Strategy (`docs/spec.md#rules-and-strategy`)

**100% Profit Laddering Rule**
- Test: At 1x profit (100%), sell 33% of position
- Test: At 2x profit (200%), sell 33% of remaining position
- Test: At 4x profit (400%), sell 33% of remaining position
- Test: Continue doubling thresholds (8x, 16x, etc.)
- Test: Cool-off period (1 day default, configurable via `COOLOFF_DAYS`) prevents re-triggering
- Test: Minimum trade size enforcement ($50 USD default)

**Drift-based Rebalancing**
- Test: Rebalance when drift > 20% of target (configurable via `DRIFT_BAND`)
- Test: Suggested trade must be ≥ $50 USD (configurable via `MIN_TRADE_USD`)
- Test: Target weights respect tiered caps (Mega/Large/Mid/Small/Moonshots)
- Test: Narrative guardrail (max 40% in any single narrative)

#### 2. Portfolio Inputs (`docs/spec.md#portfolio-inputs`)

**Importer Service**
- Test: Parse tab-delimited token list with GBP amounts
- Test: Normalize currency symbols and thousands separators
- Test: Map symbols to Coingecko IDs via `cg-mapping.txt`
- Test: Handle single average cost per asset
- Test: Treat GBP fiat as cash balance
- Test: Group stablecoins (USDC, USDT, SUSDe) with GBP cash

#### 3. Data and Integrations (`docs/spec.md#data-and-integrations`)

**Price Fetching (Coingecko)**
- Test: Single request to `coins/markets` with all IDs and `vs_currency=GBP`
- Test: API key sent as `x_cg_demo_api_key` query param when available
- Test: USD derived from GBP via USDC-implied FX
- Test: BTC prices derived from BTCUSD
- Test: Store prices in USD, GBP, and BTC currencies
- Test: Retry logic with backoff for 429 errors
- Test: Fallback to `cg-mapping.txt` IDs when no active positions

**Indicators**
- Test: BTCD from Coingecko `/global` (market_cap_percentage.btc)
- Test: BTCD fallback calculation from market caps
- Test: DXY from FRED DTWEXBGS via FRED API
- Test: Fear & Greed from alternative.me `/fng/`
- Test: Caching TTL (BTCD/F&G hourly, DXY daily)
- Test: Store snapshots in `indicators` table

#### 4. Backend Services (`docs/spec.md#services-and-jobs`)

**Runner Pipeline**
- Test: Price job runs hourly
- Test: Indicators fetched and stored
- Test: Rule engine evaluates all positions
- Test: Alerts written to JSONL log
- Test: Portfolio JSON exported for UI

**Database Operations**
- Test: Schema migrations (Alembic)
- Test: CRUD operations for all tables (assets, portfolios, positions, prices, fx_rates, targets, alerts, indicators, etc.)
- Test: Unique constraints (e.g., `uq_asset_symbol`)
- Test: Foreign key relationships
- Test: Time-series data storage and retrieval

#### 5. Frontend Views (`docs/spec.md#frontend-and-testing`)

**Dashboard**
- Test: SummaryCard displays total P+L (Market Value − Cost Basis) in GBP
- Test: SummaryCard shows thousands separators and colored sign
- Test: IndicatorsCard renders 30-day sparklines for BTCD and Fear & Greed
- Test: IndicatorsCard shows DXY when data available
- Test: Single-point series render as flat line
- Test: PortfolioPie displays correctly
- Test: Currency toggle (USD/GBP/BTC) updates all values

**Portfolio Table**
- Test: Sortable headers with default sort by Weight (desc)
- Test: Weight column shows asset % of total
- Test: Coins, prices, and money values formatted with locale thousands separators
- Test: Cost Basis displayed as negative value (red)
- Test: Footer totals: Market Value, Cost Basis, Profit / Loss
- Test: Market cap "lozenge" per row (micro/small/medium/large/huge)
- Test: Market cap tooltip shows cap in selected currency
- Test: Market cap clickable to Coingecko
- Test: Stablecoins aggregated with expansion capability
- Test: Inline editing of Coins and Cost Basis
- Test: Cost Basis entry supports USD/GBP/BTC with conversion
- Test: Numeric paste normalization (comma and dot thousands/decimals)

**Actions Panel**
- Test: Suggested sells displayed with rationale
- Test: Suggested rebalances displayed with rationale
- Test: Cool-off status shown per asset
- Test: Actions respect minimum trade size

**Asset Detail**
- Test: Summary information displayed
- Test: Narratives shown
- Test: Links to Coingecko and CoinMarketCap
- Test: News modal (stub) accessible

#### 6. API Endpoints (`docs/spec.md#apis` and `README.md#api-routes`)

**Backend Services (Python)**
- Test: Price fetcher service with mocked Coingecko client
- Test: Indicator services with mocked FRED/F&G clients
- Test: Rule engine with various position scenarios
- Test: Importer with sample token list files
- Test: Exporter generates correct JSON structure

**Next.js API Routes**
- Test: `GET /api/portfolio` returns per-asset latest prices in USD/GBP/BTC
- Test: `GET /api/portfolio` returns market values and `cb_usd`
- Test: `GET /api/portfolio/summary` computes totals and deltas in GBP
- Test: `GET /api/portfolio/summary` returns `total_gbp`, `cost_basis_gbp`, `net_gbp`
- Test: `GET /api/indicators` returns latest values and 30-day series
- Test: `GET /api/indicators` returns BTCD, DXY_TWEX, FEAR_GREED
- Test: `GET /api/icons` caches for 1 week at `.cache/icons.json`
- Test: `GET /api/icons` returns both `images` and `caps`
- Test: `GET /api/icons` falls back to stale cache on failure
- Test: `GET /api/alerts` reads from `alerts.jsonl`
- Test: `POST /api/positions/update` updates positions in SQLite
- Test: API routes handle missing data gracefully
- Test: API routes respect environment variables (`DB_PATH`, `LOG_PATH`)

#### 7. Environment Configuration (`README.md#environment-variables`)

**Configuration Tests**
- Test: All environment variables have sane defaults
- Test: `COINGECKO` API key optional for public endpoints
- Test: `FRED_API_KEY` required for DXY (returns 0 if missing)
- Test: `DB_PATH` defaults to `balancer.db`
- Test: `LOG_PATH` defaults to `alerts.jsonl`
- Test: `INITIAL_TOKENLIST` defaults to `docs/initial-data/tokenlist.txt`
- Test: `CG_MAPPING_FILE` defaults to `docs/initial-data/cg-mapping.txt`
- Test: `BASE_CCY` defaults to USD
- Test: `HTTP_TIMEOUT` defaults to 20 seconds
- Test: `HTTP_RETRIES` defaults to 2
- Test: `COOLOFF_DAYS` defaults to 1
- Test: `MIN_TRADE_USD` defaults to 50
- Test: `DRIFT_BAND` defaults to 0.2

## Backend Testing Strategy

### Unit Tests

**Location**: `balancer/tests/`

**Structure**: Mirror the module structure (e.g., `test_price_fetcher.py`, `test_rules.py`, `test_importer.py`)

**Tools**:
- `pytest` (already in `requirements-dev.txt`)
- `coverage` for coverage reports
- `ruff` for linting

**Key Areas to Test**:

1. **Clients** (`balancer/clients.py`)
   - Mock HTTP responses
   - Test retry logic and timeouts
   - Test API key injection
   - Test error handling (429, 500, network errors)
   - ✅ Existing: `test_clients_coingecko.py`

2. **Indicators** (`balancer/indicators.py`)
   - Test BTCD calculation (with and without fallback)
   - Test DXY fetch (with and without API key)
   - Test Fear & Greed fetch
   - Test caching logic
   - ✅ Existing: `test_indicators.py`

3. **Price Fetcher** (`balancer/price_fetcher.py`)
   - Test single-request pipeline
   - Test USD derivation from GBP via USDC
   - Test BTC price derivation
   - Test price storage in multiple currencies
   - Test ID resolution (positions vs. mapping file)

4. **Rules** (`balancer/rules.py`)
   - Test 100% profit laddering at each threshold
   - Test cool-off period enforcement
   - Test drift calculation
   - Test rebalance suggestions
   - Test minimum trade size enforcement
   - Test target weight tier enforcement
   - Test narrative guardrails
   - ✅ Existing: `test_rules.py`

5. **Importer** (`balancer/importer.py`)
   - Test token list parsing
   - Test currency normalization
   - Test Coingecko ID mapping
   - Test asset/position upserts
   - Test stablecoin detection
   - ✅ Existing: `test_importer.py`

6. **Exporter** (`balancer/exporter.py`)
   - Test JSON structure matches API expectations
   - Test multi-currency price inclusion
   - Test cost basis calculations
   - ✅ Existing: `test_exporter.py`

7. **Alerts** (`balancer/alerts.py`)
   - Test JSONL log writing
   - Test alert structure and severity levels
   - ✅ Existing: `test_alerts.py`

8. **Database Models** (`balancer/models.py`)
   - Test model relationships
   - Test constraints and validations
   - Test query operations

9. **Utils** (`balancer/utils.py`)
   - Test currency conversion functions
   - Test formatting utilities
   - Test numeric normalization
   - ✅ Existing: `test_utils.py`

### Integration Tests

**Purpose**: Test interactions between services and the database

**Key Scenarios**:

1. **Full Pipeline Test**
   - Run `balancer.runner.run_once()` with mocked external APIs
   - Verify prices stored in DB
   - Verify indicators stored in DB
   - Verify alerts written to JSONL
   - Verify portfolio JSON exported

2. **Database Integration**
   - Test with in-memory SQLite or test DB
   - Test schema creation and migrations
   - Test data persistence across operations

3. **External API Integration** (Optional, use sparingly)
   - Test with real Coingecko API (rate-limited)
   - Test with real FRED API (if key available)
   - Test with real Fear & Greed API
   - Mark as `@pytest.mark.integration` and skip in CI by default

### Test Fixtures and Utilities

**Existing** `balancer/tests/conftest.py`:

The test suite uses a **file-based SQLite database** (temporary file) rather than in-memory to ensure tests never touch the real database. The setup includes:

- **`test_db` fixture**: Function-scoped database session using a temporary SQLite file
- **`setup_test_database` fixture**: Session-scoped fixture that creates the test database schema before all tests and cleans up after
- **Sample data fixtures**: `sample_portfolio`, `sample_assets`, `sample_positions`, `sample_prices`, `sample_fx_rates`, `sample_targets` for consistent test data

**Key Features**:
- Tests use a dedicated temporary database file (never the real `balancer.db`)
- All models are imported to ensure schema is complete
- Database path is patched in both environment variables and `balancer.config`
- Automatic cleanup after test session completes

**Usage in Tests**:
```python
def test_something(test_db, sample_assets, sample_positions):
    # test_db is a SQLAlchemy session
    # sample_assets and sample_positions are already in the database
    asset = test_db.get(Asset, 1)
    assert asset.symbol == "BTC"
```

## Frontend Testing Strategy

### Component Tests

**Tools**:
- **React Testing Library** (recommended for component testing)
- **Vitest** or **Jest** as test runner
- **Playwright** for E2E (as mentioned in `docs/spec.md#frontend-and-testing`)

**Setup**:
1. Add to `web/package.json`:
   ```json
   "devDependencies": {
     "@testing-library/react": "^14.0.0",
     "@testing-library/jest-dom": "^6.0.0",
     "vitest": "^1.0.0",
     "@vitest/ui": "^1.0.0"
   }
   ```

2. Create `web/vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   import path from 'path'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   })
   ```

**Key Components to Test**:

1. **SummaryCard** (`web/src/components/summary-card.tsx`)
   - Test P+L calculation display
   - Test thousands separator formatting
   - Test color coding (positive/negative)
   - Test currency toggle updates
   - Test loading and error states
   - ✅ Existing: `web/src/components/summary-card.test.tsx`

2. **IndicatorsCard** (`web/src/components/indicators-card.tsx`)
   - Test sparkline rendering (30-day series)
   - Test DXY conditional display
   - Test single-point series (flat line)
   - Test API data loading states
   - ✅ Existing: `web/src/components/indicators-card.test.tsx`

3. **PortfolioPie** (`web/src/components/portfolio-pie.tsx`)
   - Test chart rendering with sample data
   - Test currency updates
   - ⚠️ Not yet tested (component exists)

4. **PortfolioTable** (`web/src/components/portfolio-table.tsx`)
   - Test sorting functionality
   - Test weight calculation and display
   - Test number formatting (thousands separators)
   - Test cost basis negative display (red)
   - Test footer totals calculation
   - Test market cap lozenge rendering
   - Test stablecoin aggregation and expansion
   - Test inline editing (Coins, Cost Basis)
   - Test currency conversion on Cost Basis entry
   - Test numeric paste normalization
   - ⚠️ Not yet tested (component exists)

5. **AlertsList** (`web/src/components/alerts-list.tsx`)
   - Test alert rendering from API
   - Test severity levels
   - Test empty state
   - ⚠️ Not yet tested (component exists)

### API Route Tests

**Location**: `web/src/app/api/**/route.test.ts`

**Tools**: Vitest with Next.js API route testing utilities

**Key Routes to Test**:

1. **`GET /api/portfolio`**
   - Test database query
   - Test response structure (USD/GBP/BTC prices, market values, `cb_usd`)
   - Test error handling
   - ✅ Existing: `web/src/app/api/portfolio/route.test.ts`

2. **`GET /api/portfolio/summary`**
   - Test totals calculation (`total_gbp`, `cost_basis_gbp`, `net_gbp`)
   - Test delta calculations
   - ✅ Existing: `web/src/app/api/portfolio/summary/route.test.ts`

3. **`GET /api/indicators`**
   - Test latest values retrieval
   - Test 30-day series retrieval
   - Test indicator names (BTCD, DXY_TWEX, FEAR_GREED)
   - ⚠️ Not yet tested (route exists)

4. **`GET /api/icons`**
   - Test Coingecko API call
   - Test caching logic (1 week TTL)
   - Test stale cache fallback
   - Test response structure (`images`, `caps`)
   - ⚠️ Not yet tested (route exists)

5. **`GET /api/alerts`**
   - Test JSONL file reading
   - Test parsing and response structure

6. **`POST /api/positions/update`**
   - Test position update in SQLite
   - Test currency conversion (USD/GBP/BTC)
   - Test validation
   - Test error handling

### End-to-End Tests (Playwright)

**Location**: `web/e2e/*.spec.ts`

**Existing Tests**:
- ✅ `web/e2e/dashboard.spec.ts` - Tests dashboard page loads and displays main components
- ✅ `web/e2e/portfolio-table.spec.ts` - Tests portfolio table interactions

**Setup**:
1. Add to `web/package.json`:
   ```json
   "devDependencies": {
     "@playwright/test": "^1.40.0"
   }
   ```

2. Create `web/playwright.config.ts`

**Key E2E Scenarios**:

1. **Dashboard Load**
   - Navigate to `/`
   - Verify SummaryCard displays
   - Verify IndicatorsCard displays
   - Verify PortfolioPie displays
   - Verify PortfolioTable displays
   - Verify AlertsList displays

2. **Currency Toggle**
   - Click USD/GBP/BTC tabs
   - Verify all values update correctly
   - Verify formatting changes (2dp for USD/GBP, 8dp for BTC)

3. **Portfolio Table Interactions**
   - Test sorting by each column
   - Test stablecoin expansion/collapse
   - Test inline editing (Coins, Cost Basis)
   - Test market cap tooltip
   - Test Coingecko link click

4. **API Error Handling**
   - Mock API failures
   - Verify error states display correctly

## Test Organization

### Directory Structure

```
balancer/
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Shared fixtures
│   ├── test_clients_coingecko.py ✅
│   ├── test_indicators.py       ✅
│   ├── test_price_fetcher.py     (to create)
│   ├── test_rules.py            (to create)
│   ├── test_importer.py         (to create)
│   ├── test_exporter.py         (to create)
│   ├── test_alerts.py           (to create)
│   ├── test_models.py           (to create)
│   ├── test_utils.py            (to create)
│   └── integration/
│       ├── test_runner.py        (to create)
│       └── test_db_operations.py (to create)

web/
├── src/
│   ├── test/
│   │   └── setup.ts             (to create)
│   └── app/
│       └── api/
│           └── **/
│               └── route.test.ts (to create)
├── src/components/
│   └── **/*.test.tsx             (to create)
├── e2e/
│   ├── dashboard.spec.ts        (to create)
│   ├── portfolio-table.spec.ts  (to create)
│   └── currency-toggle.spec.ts  (to create)
└── vitest.config.ts             (to create)
```

### Running Tests

**Backend**:
```bash
# Activate venv
. .venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=balancer --cov-report=html

# Run specific test file
pytest balancer/tests/test_rules.py

# Run with verbose output
pytest -v
```

**Frontend**:
```bash
cd web

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui
```

**Add to `web/package.json`**:
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: |
          python -m venv .venv
          . .venv/bin/activate
          pip install -r requirements-dev.txt
      - run: |
          . .venv/bin/activate
          pytest --cov=balancer --cov-report=xml
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd web
          npm ci
          npm run lint
          npm run test
          npm run build
```

## Test Coverage Goals

### Backend
- **Target**: 80%+ coverage for business logic modules
- **Critical paths**: Rules engine, price fetcher, importer, indicators
- **Lower priority**: HTTP client wrappers (can rely on integration tests)

### Frontend
- **Target**: 70%+ coverage for components and API routes
- **Critical paths**: Portfolio calculations, currency conversions, API routes
- **E2E**: Cover all major user flows

## Maintenance

### Keeping Tests in Sync with Documentation

1. **When updating `docs/spec.md`**:
   - Review affected sections
   - Update or add corresponding test cases
   - Run test suite to verify

2. **When adding new features**:
   - Write tests first (TDD) or alongside implementation
   - Update this testing strategy document if new patterns emerge
   - Ensure tests are documented in code comments referencing spec sections

3. **Regular Review**:
   - Quarterly review of test coverage against spec
   - Identify gaps in test coverage
   - Refactor tests as code evolves

## Next Steps

1. **Immediate**:
   - Set up frontend testing infrastructure (Vitest, React Testing Library)
   - Create test fixtures and utilities (`conftest.py`, test setup files)
   - Write tests for critical business logic (rules engine, price fetcher)

2. **Short-term**:
   - Complete backend unit test coverage
   - Add frontend component tests
   - Set up Playwright for E2E testing

3. **Long-term**:
   - Achieve target coverage goals
   - Set up CI/CD with automated testing
   - Add performance/load testing for API routes
   - Add visual regression testing for UI components

## References

- Project Spec: `docs/spec.md`
- README: `README.md`
- Backend Test Examples: `balancer/tests/`
- Engineering Principles: `docs/spec.md#engineering-principles`
