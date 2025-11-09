"""Shared test fixtures for backend tests."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, UTC
from balancer.db import Base
from balancer.models import Asset, Portfolio, Position, Price, FxRate, Target, Alert, Indicator, Narrative, AssetNarrative, TradeManual, NewsItem


# Ensure all models are imported so Base.metadata includes them
# This is important for schema creation
_ = [Asset, Portfolio, Position, Price, FxRate, Target, Alert, Indicator, Narrative, AssetNarrative, TradeManual, NewsItem]


@pytest.fixture(scope="function")
def test_db():
    """In-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    # Create all tables - ensure all models are registered
    # This must happen before creating the session
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session", autouse=True)
def ensure_real_db_schema():
    """Ensure the real database schema exists before any tests run.
    This is a safety net in case any code path uses the real database."""
    from balancer.db import Base, engine
    # Import all models to register them with Base
    from balancer import models
    # Create schema in the real database (if it doesn't exist)
    # This won't hurt if tables already exist
    try:
        Base.metadata.create_all(engine)
    except Exception:
        # If this fails, tests using mocked databases should still work
        pass


@pytest.fixture
def sample_portfolio(test_db):
    """Create a sample portfolio for testing."""
    portfolio = Portfolio(name="TestPortfolio", base_currency="USD")
    test_db.add(portfolio)
    test_db.commit()
    test_db.refresh(portfolio)
    return portfolio


@pytest.fixture
def sample_assets(test_db):
    """Create sample assets for testing."""
    assets = [
        Asset(symbol="BTC", name="Bitcoin", coingecko_id="bitcoin", is_stable=False, is_fiat=False, active=True),
        Asset(symbol="ETH", name="Ethereum", coingecko_id="ethereum", is_stable=False, is_fiat=False, active=True),
        Asset(symbol="USDC", name="USD Coin", coingecko_id="usd-coin", is_stable=True, is_fiat=False, active=True),
        Asset(symbol="GBP", name="British Pound", coingecko_id=None, is_stable=True, is_fiat=True, active=True),
    ]
    for asset in assets:
        test_db.add(asset)
    test_db.commit()
    for asset in assets:
        test_db.refresh(asset)
    return assets


@pytest.fixture
def sample_positions(test_db, sample_portfolio, sample_assets):
    """Create sample positions for testing."""
    positions = []
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    eth = next(a for a in sample_assets if a.symbol == "ETH")
    usdc = next(a for a in sample_assets if a.symbol == "USDC")
    
    positions.append(
        Position(
            portfolio_id=sample_portfolio.id,
            asset_id=btc.id,
            coins=1.0,
            avg_cost_ccy="GBP",
            avg_cost_per_unit=30000.0,  # £30k per BTC
        )
    )
    positions.append(
        Position(
            portfolio_id=sample_portfolio.id,
            asset_id=eth.id,
            coins=10.0,
            avg_cost_ccy="GBP",
            avg_cost_per_unit=2000.0,  # £2k per ETH
        )
    )
    positions.append(
        Position(
            portfolio_id=sample_portfolio.id,
            asset_id=usdc.id,
            coins=10000.0,
            avg_cost_ccy="GBP",
            avg_cost_per_unit=0.79,  # £0.79 per USDC (GBP/USD ~1.27)
        )
    )
    
    for pos in positions:
        test_db.add(pos)
    test_db.commit()
    for pos in positions:
        test_db.refresh(pos)
    return positions


@pytest.fixture
def sample_prices(test_db, sample_assets):
    """Create sample prices for testing."""
    prices = []
    now = datetime.now(UTC)
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    eth = next(a for a in sample_assets if a.symbol == "ETH")
    usdc = next(a for a in sample_assets if a.symbol == "USDC")
    
    # BTC prices
    prices.append(Price(asset_id=btc.id, ccy="USD", price=60000.0, at=now))
    prices.append(Price(asset_id=btc.id, ccy="GBP", price=48000.0, at=now))  # ~£48k
    prices.append(Price(asset_id=btc.id, ccy="BTC", price=1.0, at=now))
    
    # ETH prices
    prices.append(Price(asset_id=eth.id, ccy="USD", price=3000.0, at=now))
    prices.append(Price(asset_id=eth.id, ccy="GBP", price=2400.0, at=now))  # £2.4k
    prices.append(Price(asset_id=eth.id, ccy="BTC", price=0.05, at=now))
    
    # USDC prices (for FX derivation)
    prices.append(Price(asset_id=usdc.id, ccy="USD", price=1.0, at=now))
    prices.append(Price(asset_id=usdc.id, ccy="GBP", price=0.79, at=now))  # GBP/USD ~1.27
    
    for price in prices:
        test_db.add(price)
    test_db.commit()
    return prices


@pytest.fixture
def sample_fx_rates(test_db):
    """Create sample FX rates for testing."""
    rates = []
    now = datetime.now(UTC)
    
    # GBP/USD derived from USDC
    rates.append(FxRate(base_ccy="GBP", quote_ccy="USD", rate=1.27, at=now))
    # BTC/USD
    rates.append(FxRate(base_ccy="BTC", quote_ccy="USD", rate=60000.0, at=now))
    
    for rate in rates:
        test_db.add(rate)
    test_db.commit()
    return rates


@pytest.fixture
def sample_targets(test_db, sample_portfolio, sample_assets):
    """Create sample targets for testing."""
    targets = []
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    eth = next(a for a in sample_assets if a.symbol == "ETH")
    
    targets.append(
        Target(
            portfolio_id=sample_portfolio.id,
            asset_id=btc.id,
            target_weight=0.25,  # 25%
            min_trade_usd=50.0,
            drift_band=0.2,
        )
    )
    targets.append(
        Target(
            portfolio_id=sample_portfolio.id,
            asset_id=eth.id,
            target_weight=0.15,  # 15%
            min_trade_usd=50.0,
            drift_band=0.2,
        )
    )
    
    for target in targets:
        test_db.add(target)
    test_db.commit()
    for target in targets:
        test_db.refresh(target)
    return targets

