# Testing Quick Start

This guide provides quick instructions for running the test suite.

## Backend Tests

### Setup
```bash
# Activate virtual environment
. .venv/bin/activate

# Install test dependencies (if not already installed)
pip install -r requirements-dev.txt
```

### Running Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=balancer --cov-report=html

# Run specific test file
pytest balancer/tests/test_rules.py

# Run with verbose output
pytest -v

# Run specific test
pytest balancer/tests/test_rules.py::test_evaluate_take_profit_2x
```

### Test Files
- `balancer/tests/conftest.py` - Shared fixtures
- `balancer/tests/test_price_fetcher.py` - Price fetching tests
- `balancer/tests/test_rules.py` - Business rules tests
- `balancer/tests/test_importer.py` - Import functionality tests
- `balancer/tests/test_exporter.py` - Export functionality tests
- `balancer/tests/test_alerts.py` - Alert logging tests
- `balancer/tests/test_utils.py` - Utility function tests
- `balancer/tests/test_indicators.py` - Indicator fetching tests (existing)
- `balancer/tests/test_clients_coingecko.py` - Coingecko client tests (existing)

## Frontend Tests

### Setup
```bash
cd web

# Install dependencies (if not already installed)
npm install
```

### Running Tests
```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Test Files
- `web/src/test/setup.ts` - Test setup and mocks
- `web/src/components/*.test.tsx` - Component tests
- `web/src/app/api/**/route.test.ts` - API route tests
- `web/e2e/*.spec.ts` - End-to-end tests

## CI/CD

Tests run automatically on push/PR via GitHub Actions (`.github/workflows/test.yml`).

## Coverage Goals

- **Backend**: 80%+ coverage for business logic modules
- **Frontend**: 70%+ coverage for components and API routes

## Troubleshooting

### Backend Tests
- Ensure virtual environment is activated
- Check that test database path is writable
- Verify all dependencies are installed

### Frontend Tests
- Ensure Node.js 18+ is installed
- Clear `node_modules` and reinstall if issues occur
- For E2E tests, ensure dev server can start on port 3000

### Common Issues
- **Import errors**: Check that paths match your project structure
- **Mock failures**: Verify mocks are set up correctly in `setup.ts`
- **Database errors**: Tests use in-memory SQLite, should not require real DB

