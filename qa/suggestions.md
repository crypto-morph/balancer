# Code Quality Review - Balancer Project

## Executive Summary

This review examines the codebase for code structure, build quality, modularisation, and variable management. The project shows good architectural separation but has several areas requiring attention before production deployment.

---

## 1. Code Structure Issues

### 1.1 Database Session Management

**Issue**: Inconsistent transaction handling and missing rollback on errors.

**Location**: Multiple files (`price_fetcher.py`, `rules.py`, `indicators.py`, `importer.py`)

**Concerns**:
- Database sessions use context managers (`with SessionLocal() as db`) but lack explicit rollback on exceptions
- Multiple commits within loops in `upsert_assets_for_markets()` (lines 41, 47) can lead to partial state if later iterations fail
- No transaction boundaries clearly defined for multi-step operations
- In `rules.py`, commits happen inside loops (lines 160, 218) which could leave inconsistent state

**Recommendation**:
```python
# Example improvement
with SessionLocal() as db:
    try:
        # All operations
        db.commit()
    except Exception:
        db.rollback()
        raise
```

### 1.2 Error Handling

**Issue**: Inconsistent and insufficient error handling throughout the codebase.

**Locations**:
- `http_client.py`: Catches generic `Exception` (line 19) - too broad
- `indicators.py`: Silent failures return `0.0` (lines 11, 27, 39) - masks real issues
- `price_fetcher.py`: No error handling for API failures or database operations
- `rules.py`: No error handling for database queries or calculations
- Frontend API routes: Errors are swallowed and return empty data (lines 15-16 in both route files)

**Recommendation**:
- Use specific exception types
- Log errors appropriately
- Consider custom exception classes for business logic errors
- Frontend should handle errors gracefully but not silently fail

### 1.3 Missing Type Safety

**Issue**: Inconsistent type hints and missing type annotations.

**Locations**:
- `rules.py`: Functions like `latest_price()`, `get_price_book()`, `latest_fx()` accept `db` parameter without type annotation
- `price_fetcher.py`: `upsert_assets_for_markets()` accepts `List[dict]` - should use TypedDict or Pydantic models
- Frontend: Some types are defined inline but could be extracted to shared types file

**Recommendation**:
- Add proper type hints for all function parameters
- Use TypedDict or Pydantic models for API responses
- Consider using `mypy` for type checking

### 1.4 Deprecated API Usage

**Issue**: Use of deprecated `datetime.utcnow()`.

**Location**: Throughout codebase (16 occurrences)

**Concern**: `datetime.utcnow()` is deprecated in Python 3.12+. Should use `datetime.now(timezone.utc)`.

**Recommendation**: Replace all instances with timezone-aware alternatives.

---

## 2. Build Quality Issues

### 2.1 No Testing Infrastructure

**Issue**: Complete absence of tests.

**Concern**: No unit tests, integration tests, or test configuration found. This is a critical gap for a financial application.

**Recommendation**:
- Add `pytest` for Python backend
- Add `jest` or `vitest` for TypeScript frontend
- Create test fixtures and mocks for external APIs
- Add CI/CD pipeline to run tests automatically

### 2.2 Missing Linting and Formatting

**Issue**: No visible linting configuration or code formatting standards.

**Concern**: Code style inconsistencies and potential bugs may go undetected.

**Recommendation**:
- Add `ruff` or `black` for Python formatting
- Add `eslint` configuration (partially present but not enforced)
- Add `prettier` for TypeScript/React
- Add pre-commit hooks

### 2.3 Logging Infrastructure

**Issue**: Using `print()` statements instead of proper logging.

**Location**: `runner.py` (lines 34, 36)

**Concern**: No structured logging, log levels, or log rotation. Critical for production debugging.

**Recommendation**:
- Use Python's `logging` module
- Configure log levels (DEBUG, INFO, WARNING, ERROR)
- Add structured logging for JSONL output
- Consider adding request/response logging for API calls

### 2.4 Dependency Management

**Issue**: Some dependencies lack version pinning.

**Location**: `requirements.txt` has versions, but `package.json` uses `^` ranges

**Concern**: Potential for breaking changes in minor/patch updates.

**Recommendation**:
- Consider using exact versions or lock files
- Review dependency update strategy
- Add security scanning (e.g., `safety` for Python, `npm audit` for Node)

### 2.5 Missing Build Configuration

**Issue**: No CI/CD configuration, Docker files, or deployment scripts.

**Concern**: Difficult to ensure consistent builds and deployments.

**Recommendation**:
- Add `.github/workflows` or similar CI configuration
- Consider Docker containers for consistent environments
- Add deployment documentation

---

## 3. Modularisation Issues

### 3.1 Function Responsibilities

**Issue**: Some functions violate single responsibility principle.

**Locations**:
- `store_prices()` in `price_fetcher.py`: Handles asset upserting, price storage, FX rate calculation, and BTC price extraction (lines 52-88)
- `evaluate_drift()` in `rules.py`: Handles querying, calculation, alerting, and database commits (lines 163-218)
- `import_tokenlist()` in `importer.py`: Handles file reading, parsing, asset creation, and position updates (lines 38-107)

**Recommendation**:
- Split functions into smaller, focused units
- Extract database operations into repository/service layers
- Separate business logic from data access

### 3.2 Code Duplication

**Issue**: Repeated patterns across modules.

**Locations**:
- Price fetching logic duplicated in `price_fetcher.py` and `rules.py`
- Database session pattern repeated without abstraction
- Currency code strings ("USD", "GBP", "BTC") hardcoded throughout

**Recommendation**:
- Create shared utilities for common operations
- Extract constants to a central location
- Consider a repository pattern for database access

### 3.3 Tight Coupling

**Issue**: Direct database access in business logic modules.

**Locations**:
- `rules.py` directly queries database instead of using a service layer
- `price_fetcher.py` mixes API calls with database operations
- Frontend API routes directly access filesystem

**Recommendation**:
- Introduce service layer between business logic and data access
- Use dependency injection for testability
- Frontend should call backend APIs, not read files directly

### 3.4 Missing Abstractions

**Issue**: No abstraction for external API clients.

**Concern**: While clients are separated, there's no interface/abstract base class, making testing difficult.

**Recommendation**:
- Create abstract base classes or protocols for clients
- Use dependency injection in functions that use clients
- This enables easy mocking in tests

---

## 4. Variable Management Issues

### 4.1 Magic Numbers and Strings

**Issue**: Hardcoded values throughout codebase.

**Locations**:
- Currency codes: "USD", "GBP", "BTC" hardcoded (should be constants)
- `price_fetcher.py`: Magic strings like "bitcoin", "usd-coin" (lines 72, 74, 81)
- `rules.py`: Magic number `0.33` for take-profit percentage (line 135)
- `importer.py`: Hardcoded stablecoin symbols `{"USDC", "USDT", "SUSDE"}` (line 44)
- Frontend: Polling intervals hardcoded (30000ms, 15000ms)

**Recommendation**:
- Extract all magic values to named constants in `config.py`
- Use enums for currency codes
- Make polling intervals configurable

### 4.2 Inconsistent Naming

**Issue**: Mixed naming conventions.

**Locations**:
- Config variables use `UPPER_CASE` (good)
- Function parameters use `snake_case` (good)
- But some local variables use single letters (`m`, `u`, `g`, `pb`) which reduces readability

**Recommendation**:
- Use descriptive variable names
- Consider renaming: `m` → `asset_id_map`, `u` → `usd_row`, `g` → `gbp_row`, `pb` → `price_book`

### 4.3 Global State

**Issue**: Module-level configuration loading.

**Location**: `config.py` loads environment variables at import time (line 5)

**Concern**: Makes testing difficult and configuration changes require module reload.

**Recommendation**:
- Consider lazy loading or configuration objects
- Allow configuration to be passed as parameters
- This improves testability

### 4.4 Type Coercion Issues

**Issue**: Unsafe type conversions.

**Locations**:
- `config.py`: `float()` and `int()` conversions without validation (lines 16, 19, 20, 30, 31, 35, 39)
- `indicators.py`: Multiple `float()` conversions that could fail (lines 11, 25, 37)
- `utils.py`: Regex-based parsing that could return incorrect values

**Recommendation**:
- Add validation before type conversion
- Use try/except with specific error handling
- Consider using Pydantic for configuration validation

### 4.5 Missing Constants for Business Logic

**Issue**: Business rule values scattered throughout code.

**Locations**:
- Take-profit percentage (33%) hardcoded in `rules.py`
- Drift band and min trade values have defaults but are also hardcoded in some places
- Alert cooldown logic uses `timedelta(days=COOLOFF_DAYS)` but the calculation is embedded

**Recommendation**:
- Extract all business rule constants to `config.py`
- Document the rationale for each value
- Make them easily configurable

---

## 5. Frontend-Specific Concerns

### 5.1 API Route Implementation

**Issue**: API routes directly access filesystem instead of calling backend services.

**Locations**: `web/src/app/api/portfolio/route.ts`, `web/src/app/api/alerts/route.ts`

**Concern**: 
- Tight coupling to filesystem structure
- No validation of file contents
- Error handling returns 200 status even on errors
- Not scalable for production

**Recommendation**:
- Create proper backend API endpoints
- Use HTTP client to call backend
- Implement proper error status codes
- Add request validation

### 5.2 Missing Error Boundaries

**Issue**: No React error boundaries in frontend.

**Concern**: Unhandled errors will crash the entire application.

**Recommendation**:
- Add error boundaries around major components
- Implement fallback UI for error states
- Add error logging/reporting

### 5.3 Type Safety

**Issue**: Some types defined inline, missing shared type definitions.

**Locations**: `portfolio-table.tsx`, `alerts-list.tsx`

**Recommendation**:
- Create `types/` directory for shared types
- Extract API response types
- Use stricter TypeScript settings

### 5.4 Hardcoded Polling

**Issue**: Polling intervals hardcoded in components.

**Locations**: `portfolio-table.tsx` (30000ms), `alerts-list.tsx` (15000ms)

**Recommendation**:
- Extract to configuration
- Consider using WebSockets or Server-Sent Events for real-time updates
- Make intervals configurable

---

## 6. Security Concerns

### 6.1 API Key Management

**Issue**: API keys loaded from environment but no validation.

**Location**: `config.py`

**Recommendation**:
- Validate that required keys are present for production
- Never log or expose API keys
- Consider using secret management services

### 6.2 Input Validation

**Issue**: Limited input validation on user-provided data.

**Locations**: 
- `importer.py`: File parsing has minimal validation
- API routes: No input validation

**Recommendation**:
- Add Pydantic models for validation
- Validate file formats before processing
- Sanitise user inputs

### 6.3 SQL Injection Risk

**Issue**: While using ORM reduces risk, some queries use string formatting.

**Recommendation**:
- Audit all database queries
- Ensure all user inputs are parameterised
- Consider using SQLAlchemy's query builder exclusively

---

## 7. Performance Concerns

### 7.1 N+1 Query Problems

**Issue**: Potential N+1 queries in loops.

**Locations**:
- `rules.py`: `evaluate_drift()` queries assets inside loop (line 193)
- `exporter.py`: Queries asset for each position (line 38)

**Recommendation**:
- Use eager loading or batch queries
- Consider using `joinedload` or `selectinload` in SQLAlchemy

### 7.2 File I/O in API Routes

**Issue**: Synchronous file reading in API routes.

**Locations**: Frontend API routes

**Recommendation**:
- Consider caching file contents
- Use async file operations
- Move to proper database-backed API

### 7.3 No Caching

**Issue**: No caching layer for frequently accessed data.

**Recommendation**:
- Add caching for price data
- Cache portfolio calculations
- Consider Redis for distributed caching

---

## 8. Documentation Gaps

### 8.1 Code Documentation

**Issue**: Missing docstrings for many functions.

**Locations**: Most functions lack comprehensive docstrings

**Recommendation**:
- Add docstrings following Google or NumPy style
- Document parameters, return values, and exceptions
- Add module-level documentation

### 8.2 API Documentation

**Issue**: No API documentation for frontend routes.

**Recommendation**:
- Document API endpoints
- Add OpenAPI/Swagger specification
- Document error responses

---

## Priority Recommendations

### High Priority
1. Add comprehensive error handling and logging
2. Implement test suite (unit and integration)
3. Fix database transaction management
4. Replace deprecated `datetime.utcnow()`
5. Add input validation and security hardening

### Medium Priority
6. Refactor large functions for single responsibility
7. Extract magic numbers and strings to constants
8. Improve type safety throughout codebase
9. Add proper logging infrastructure
10. Create service layer abstractions

### Low Priority
11. Add code documentation and docstrings
12. Implement caching layer
13. Optimise database queries
14. Add CI/CD pipeline
15. Improve frontend error handling

---

## Conclusion

The codebase demonstrates good architectural thinking with clear separation of concerns between clients, models, and business logic. However, several critical areas need attention before production deployment:

- **Testing**: Complete absence of tests is the highest risk
- **Error Handling**: Insufficient error handling could lead to silent failures
- **Database Management**: Transaction handling needs improvement
- **Code Quality**: Magic numbers, missing type hints, and code duplication reduce maintainability

Addressing the high-priority items will significantly improve code quality, reliability, and maintainability.


