"""Tests for exporter module."""
import json
from balancer.exporter import (
    latest_price_usd,
    latest_price_ccy,
    latest_fx,
)


def test_latest_price_usd(test_db, sample_assets, sample_prices):
    """Test getting latest USD price."""
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    price = latest_price_usd(test_db, btc.id)
    assert price == 60000.0


def test_latest_price_ccy(test_db, sample_assets, sample_prices):
    """Test getting latest price in specific currency."""
    btc = next(a for a in sample_assets if a.symbol == "BTC")
    price = latest_price_ccy(test_db, btc.id, "GBP")
    assert price == 48000.0


def test_latest_fx(test_db, sample_fx_rates):
    """Test getting latest FX rate."""
    rate = latest_fx(test_db, "GBP", "USD")
    assert rate == 1.27


def test_export_portfolio_json(tmp_path, test_db, sample_portfolio, sample_assets, sample_positions, sample_prices, sample_fx_rates, monkeypatch):
    """Test exporting portfolio to JSON."""
    output_file = tmp_path / "portfolio.json"
    import balancer.config
    monkeypatch.setattr(balancer.config, "BASE_DIR", tmp_path)
    
    # Mock SessionLocal to use test_db - must patch before importing
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    # Patch both the db module and exporter module
    monkeypatch.setattr("balancer.db.SessionLocal", mock_session_local)
    monkeypatch.setattr("balancer.exporter.SessionLocal", mock_session_local)
    
    # Re-import exporter to pick up new BASE_DIR
    import importlib
    import balancer.exporter
    importlib.reload(balancer.exporter)
    export_portfolio_json = balancer.exporter.export_portfolio_json
    
    export_portfolio_json("TestPortfolio")
    
    # Verify file created
    assert output_file.exists()
    
    # Verify JSON structure
    data = json.loads(output_file.read_text())
    assert "as_of" in data
    assert "portfolio" in data
    assert data["portfolio"] == "TestPortfolio"
    assert "assets" in data
    assert len(data["assets"]) > 0
    
    # Verify asset structure
    asset = data["assets"][0]
    assert "symbol" in asset
    assert "coins" in asset
    assert "price_usd" in asset
    assert "price_gbp" in asset
    assert "price_btc" in asset
    assert "mv_usd" in asset
    assert "mv_gbp" in asset
    assert "mv_btc" in asset
    assert "cb_usd" in asset
    assert "cb_gbp" in asset
    assert "cb_btc" in asset


def test_export_portfolio_json_empty_portfolio(tmp_path, test_db, monkeypatch):
    """Test exporting non-existent portfolio."""
    output_file = tmp_path / "portfolio.json"
    import balancer.config
    monkeypatch.setattr(balancer.config, "BASE_DIR", tmp_path)
    import importlib
    import balancer.exporter
    importlib.reload(balancer.exporter)
    export_portfolio_json = balancer.exporter.export_portfolio_json
    
    export_portfolio_json("NonExistent")
    
    data = json.loads(output_file.read_text())
    assert "assets" in data
    assert len(data["assets"]) == 0


def test_export_portfolio_json_totals(tmp_path, test_db, sample_portfolio, sample_assets, sample_positions, sample_prices, sample_fx_rates, monkeypatch):
    """Test portfolio totals are calculated correctly."""
    output_file = tmp_path / "portfolio.json"
    import balancer.config
    monkeypatch.setattr(balancer.config, "BASE_DIR", tmp_path)
    
    # Mock SessionLocal to use test_db - must patch before importing
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    # Patch both the db module and exporter module
    monkeypatch.setattr("balancer.db.SessionLocal", mock_session_local)
    monkeypatch.setattr("balancer.exporter.SessionLocal", mock_session_local)
    
    import importlib
    import balancer.exporter
    importlib.reload(balancer.exporter)
    export_portfolio_json = balancer.exporter.export_portfolio_json
    
    export_portfolio_json("TestPortfolio")
    
    data = json.loads(output_file.read_text())
    assert "total_mv_usd" in data
    assert "total_mv_gbp" in data
    assert "total_mv_btc" in data
    
    # Totals should be sum of all positions
    total_mv_usd = sum(a["mv_usd"] for a in data["assets"])
    assert abs(data["total_mv_usd"] - total_mv_usd) < 0.01

