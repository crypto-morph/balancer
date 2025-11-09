"""Tests for price_fetcher module."""
from unittest.mock import Mock, patch
from balancer.price_fetcher import (
    read_mapping_ids,
    ids_from_positions,
    fetch_markets,
    upsert_assets_for_markets,
    store_prices,
    derive_and_store_btc_prices,
    run_price_fetch,
)
from balancer.models import Asset, Price, FxRate


def test_read_mapping_ids(tmp_path, monkeypatch):
    """Test reading Coingecko IDs from mapping file."""
    mapping_file = tmp_path / "cg-mapping.txt"
    mapping_file.write_text("bitcoin,ethereum,usd-coin\n")
    monkeypatch.setenv("CG_MAPPING_FILE", str(mapping_file))
    
    # Need to reload config and price_fetcher to pick up new env var
    from balancer import config
    import importlib
    importlib.reload(config)
    import balancer.price_fetcher
    importlib.reload(balancer.price_fetcher)
    from balancer.price_fetcher import read_mapping_ids as read_ids
    ids = read_ids()
    assert ids == ["bitcoin", "ethereum", "usd-coin"]


def test_read_mapping_ids_missing_file(monkeypatch):
    """Test reading mapping file when it doesn't exist."""
    monkeypatch.setenv("CG_MAPPING_FILE", "/nonexistent/file.txt")
    from balancer import config
    import importlib
    importlib.reload(config)
    import balancer.price_fetcher
    importlib.reload(balancer.price_fetcher)
    from balancer.price_fetcher import read_mapping_ids as read_ids
    ids = read_ids()
    assert ids == []


def test_ids_from_positions(test_db, sample_portfolio, sample_assets, sample_positions, monkeypatch):
    """Test collecting Coingecko IDs from active positions."""
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.price_fetcher.SessionLocal", mock_session_local)
    
    ids = ids_from_positions()
    # Should return bitcoin, ethereum, usd-coin (from sample_assets)
    assert "bitcoin" in ids
    assert "ethereum" in ids
    assert "usd-coin" in ids


def test_fetch_markets(monkeypatch):
    """Test fetching markets from Coingecko."""
    mock_client = Mock()
    mock_client.markets.return_value = [
        {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "current_price": 60000.0},
        {"id": "ethereum", "symbol": "eth", "name": "Ethereum", "current_price": 3000.0},
    ]
    
    with patch("balancer.price_fetcher.CoingeckoClient", return_value=mock_client):
        result = fetch_markets(["bitcoin", "ethereum"], "gbp")
        assert len(result) == 2
        assert result[0]["id"] == "bitcoin"
        mock_client.markets.assert_called_once_with(["bitcoin", "ethereum"], "gbp")


def test_upsert_assets_for_markets(test_db, monkeypatch):
    """Test upserting assets from market data."""
    market_rows = [
        {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"},
        {"id": "ethereum", "symbol": "eth", "name": "Ethereum"},
    ]
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.price_fetcher.SessionLocal", mock_session_local)
    
    mapping = upsert_assets_for_markets(market_rows)
    assert len(mapping) == 2
    assert "bitcoin" in mapping
    assert "ethereum" in mapping
    
    # Verify assets were created
    btc = test_db.query(Asset).filter(Asset.coingecko_id == "bitcoin").first()
    assert btc is not None
    assert btc.symbol == "BTC"
    assert btc.name == "Bitcoin"


def test_upsert_assets_for_markets_existing(test_db, sample_assets):
    """Test upserting when assets already exist."""
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    market_rows = [
        {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"},
    ]
    
    mapping = upsert_assets_for_markets(market_rows)
    assert mapping["bitcoin"] == btc.id
    
    # Should not create duplicate
    count = test_db.query(Asset).filter(Asset.coingecko_id == "bitcoin").count()
    assert count == 1


def test_store_prices_usd_gbp(test_db, sample_assets, monkeypatch):
    """Test storing USD and GBP prices."""
    rows_usd = [
        {"id": "bitcoin", "symbol": "btc", "current_price": 60000.0},
        {"id": "usd-coin", "symbol": "usdc", "current_price": 1.0},
    ]
    rows_gbp = [
        {"id": "bitcoin", "symbol": "btc", "current_price": 48000.0},
        {"id": "usd-coin", "symbol": "usdc", "current_price": 0.79},
    ]
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.price_fetcher.SessionLocal", mock_session_local)
    
    btc_usd, stored = store_prices(rows_usd, rows_gbp)
    
    assert btc_usd == 60000.0
    assert stored > 0
    
    # Verify prices stored
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    usd_price = test_db.query(Price).filter(Price.asset_id == btc.id, Price.ccy == "USD").first()
    gbp_price = test_db.query(Price).filter(Price.asset_id == btc.id, Price.ccy == "GBP").first()
    
    assert usd_price is not None
    assert usd_price.price == 60000.0
    assert gbp_price is not None
    assert gbp_price.price == 48000.0
    
    # Verify FX rate stored
    fx = test_db.query(FxRate).filter(FxRate.base_ccy == "GBP", FxRate.quote_ccy == "USD").first()
    assert fx is not None
    assert abs(fx.rate - 1.27) < 0.01  # 1.0 / 0.79 ≈ 1.27


def test_store_prices_gbp_only(test_db, sample_assets, monkeypatch):
    """Test storing prices when only GBP available (derives USD via USDC)."""
    rows_usd = []
    rows_gbp = [
        {"id": "bitcoin", "symbol": "btc", "current_price": 48000.0},
        {"id": "usd-coin", "symbol": "usdc", "current_price": 0.79},
    ]
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.price_fetcher.SessionLocal", mock_session_local)
    
    btc_usd, stored = store_prices(rows_usd, rows_gbp)
    
    # Should derive USD from GBP via USDC
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    usd_price = test_db.query(Price).filter(Price.asset_id == btc.id, Price.ccy == "USD").first()
    assert usd_price is not None
    # 48000 * (1.0 / 0.79) ≈ 60759
    assert abs(usd_price.price - 60759.0) < 100.0


def test_derive_and_store_btc_prices(test_db, sample_assets, monkeypatch):
    """Test deriving and storing BTC prices."""
    rows_usd = [
        {"id": "bitcoin", "symbol": "btc", "current_price": 60000.0},
        {"id": "ethereum", "symbol": "eth", "current_price": 3000.0},
    ]
    btc_usd = 60000.0
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.price_fetcher.SessionLocal", mock_session_local)
    
    stored = derive_and_store_btc_prices(rows_usd, btc_usd)
    
    assert stored > 0
    
    # Verify BTC prices stored
    eth = next(a for a in sample_assets if a.symbol == "ETH")
    btc_price = test_db.query(Price).filter(Price.asset_id == eth.id, Price.ccy == "BTC").first()
    assert btc_price is not None
    assert abs(btc_price.price - 0.05) < 0.001  # 3000 / 60000 = 0.05
    
    # Verify BTC/USD FX stored
    fx = test_db.query(FxRate).filter(FxRate.base_ccy == "BTC", FxRate.quote_ccy == "USD").first()
    assert fx is not None
    assert fx.rate == 60000.0


@patch("balancer.price_fetcher.fetch_markets")
@patch("balancer.price_fetcher.ids_from_positions")
@patch("balancer.price_fetcher.read_mapping_ids")
def test_run_price_fetch(mock_read_mapping, mock_ids_from_positions, mock_fetch_markets, test_db, sample_assets, sample_positions, monkeypatch):
    """Test the full price fetch pipeline."""
    mock_ids_from_positions.return_value = ["bitcoin", "ethereum"]
    mock_fetch_markets.return_value = [
        {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "current_price": 48000.0},
        {"id": "ethereum", "symbol": "eth", "name": "Ethereum", "current_price": 2400.0},
        {"id": "usd-coin", "symbol": "usdc", "name": "USD Coin", "current_price": 0.79},
    ]
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.price_fetcher.SessionLocal", mock_session_local)
    
    run_price_fetch()
    
    # Verify prices were stored
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    prices = test_db.query(Price).filter(Price.asset_id == btc.id).all()
    assert len(prices) > 0
    
    mock_fetch_markets.assert_called_once()

