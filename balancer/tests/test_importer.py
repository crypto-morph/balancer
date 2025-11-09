"""Tests for importer module."""
import pytest
from pathlib import Path
from balancer.importer import (
    read_tokenlist_lines,
    parse_row,
    import_tokenlist,
)
from balancer.models import Asset, Portfolio, Position


def test_read_tokenlist_lines(tmp_path):
    """Test reading token list file."""
    tokenlist = tmp_path / "tokenlist.txt"
    tokenlist.write_text("Token\tSymbol\tPrice(£)\tCoins\tValue(£)\tAverage Buy Price(£)\nBTC\tBTC\t48000\t1.0\t48000\t30000\n")
    
    lines = read_tokenlist_lines(str(tokenlist))
    assert len(lines) == 2  # Header + 1 row
    assert "Token" in lines[0]
    assert "BTC" in lines[1]


def test_read_tokenlist_lines_missing(tmp_path):
    """Test reading non-existent token list file."""
    lines = read_tokenlist_lines(str(tmp_path / "nonexistent.txt"))
    assert lines == []


def test_parse_row_tab_delimited():
    """Test parsing tab-delimited row."""
    line = "Bitcoin\tBTC\t48000\t1.0\t48000\t30000"
    token, symbol, price_gbp, coins, avg_buy_price_gbp = parse_row(line)
    assert token == "Bitcoin"
    assert symbol == "BTC"
    assert price_gbp == 48000.0
    assert coins == 1.0
    assert avg_buy_price_gbp == 30000.0


def test_parse_row_space_delimited():
    """Test parsing space-delimited row."""
    line = "Bitcoin  BTC  48000  1.0  48000  30000"
    token, symbol, price_gbp, coins, avg_buy_price_gbp = parse_row(line)
    assert token == "Bitcoin"
    assert symbol == "BTC"
    assert price_gbp == 48000.0


def test_parse_row_with_currency_symbol():
    """Test parsing row with currency symbols."""
    line = "Bitcoin\tBTC\t£48,000\t1.0\t£48,000\t£30,000"
    token, symbol, price_gbp, coins, avg_buy_price_gbp = parse_row(line)
    assert price_gbp == 48000.0
    assert avg_buy_price_gbp == 30000.0


def test_import_tokenlist(tmp_path, test_db, monkeypatch):
    """Test importing token list."""
    tokenlist = tmp_path / "tokenlist.txt"
    tokenlist.write_text(
        "Token\tSymbol\tPrice(£)\tCoins\tValue(£)\tAverage Buy Price(£)\n"
        "Bitcoin\tBTC\t48000\t1.0\t48000\t30000\n"
        "Ethereum\tETH\t2400\t10.0\t24000\t2000\n"
        "USD Coin\tUSDC\t0.79\t10000\t7900\t0.79\n"
    )
    
    # Mock SessionLocal to use test_db
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.importer.SessionLocal", mock_session_local)
    # Also need to patch engine to use test_db's bind
    from balancer.importer import engine as importer_engine
    monkeypatch.setattr("balancer.importer.engine", test_db.bind)
    
    import_tokenlist(str(tokenlist), "TestPortfolio")
    
    # Verify portfolio created
    portfolio = test_db.query(Portfolio).filter_by(name="TestPortfolio").first()
    assert portfolio is not None
    
    # Verify assets created
    btc = test_db.query(Asset).filter_by(symbol="BTC").first()
    assert btc is not None
    assert btc.name == "Bitcoin"
    
    eth = test_db.query(Asset).filter_by(symbol="ETH").first()
    assert eth is not None
    
    usdc = test_db.query(Asset).filter_by(symbol="USDC").first()
    assert usdc is not None
    assert usdc.is_stable is True
    
    # Verify positions created
    btc_pos = test_db.query(Position).filter_by(
        portfolio_id=portfolio.id,
        asset_id=btc.id
    ).first()
    assert btc_pos is not None
    assert btc_pos.coins == 1.0
    assert btc_pos.avg_cost_per_unit == 30000.0


def test_import_tokenlist_gbp_cash(tmp_path, test_db, monkeypatch):
    """Test importing GBP as cash/fiat."""
    tokenlist = tmp_path / "tokenlist.txt"
    tokenlist.write_text(
        "Token\tSymbol\tPrice(£)\tCoins\tValue(£)\tAverage Buy Price(£)\n"
        "British Pound\tGBP\t1.0\t1000\t1000\t1.0\n"
    )
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.importer.SessionLocal", mock_session_local)
    monkeypatch.setattr("balancer.importer.engine", test_db.bind)
    
    import_tokenlist(str(tokenlist), "TestPortfolio")
    
    gbp = test_db.query(Asset).filter_by(symbol="GBP").first()
    assert gbp is not None
    assert gbp.is_fiat is True
    assert gbp.is_stable is True


def test_import_tokenlist_stablecoin_detection(tmp_path, test_db, monkeypatch):
    """Test stablecoin detection."""
    tokenlist = tmp_path / "tokenlist.txt"
    tokenlist.write_text(
        "Token\tSymbol\tPrice(£)\tCoins\tValue(£)\tAverage Buy Price(£)\n"
        "USD Coin\tUSDC\t0.79\t10000\t7900\t0.79\n"
        "Tether\tUSDT\t0.79\t5000\t3950\t0.79\n"
    )
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.importer.SessionLocal", mock_session_local)
    monkeypatch.setattr("balancer.importer.engine", test_db.bind)
    
    import_tokenlist(str(tokenlist), "TestPortfolio")
    
    usdc = test_db.query(Asset).filter_by(symbol="USDC").first()
    assert usdc.is_stable is True
    
    usdt = test_db.query(Asset).filter_by(symbol="USDT").first()
    assert usdt.is_stable is True


def test_import_tokenlist_updates_existing(tmp_path, test_db, monkeypatch):
    """Test importing updates existing positions."""
    # Create existing asset and position
    portfolio = Portfolio(name="TestPortfolio", base_currency="USD")
    test_db.add(portfolio)
    test_db.commit()
    test_db.refresh(portfolio)
    
    asset = Asset(symbol="BTC", name="Bitcoin", active=True)
    test_db.add(asset)
    test_db.commit()
    test_db.refresh(asset)
    
    position = Position(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        coins=0.5,
        avg_cost_ccy="GBP",
        avg_cost_per_unit=25000.0,
    )
    test_db.add(position)
    test_db.commit()
    
    # Import with new values
    tokenlist = tmp_path / "tokenlist.txt"
    tokenlist.write_text(
        "Token\tSymbol\tPrice(£)\tCoins\tValue(£)\tAverage Buy Price(£)\n"
        "Bitcoin\tBTC\t48000\t1.0\t48000\t30000\n"
    )
    
    from contextlib import contextmanager
    @contextmanager
    def mock_session_local():
        yield test_db
    
    monkeypatch.setattr("balancer.importer.SessionLocal", mock_session_local)
    monkeypatch.setattr("balancer.importer.engine", test_db.bind)
    
    import_tokenlist(str(tokenlist), "TestPortfolio")
    
    # Position should be updated
    test_db.refresh(position)
    assert position.coins == 1.0
    assert position.avg_cost_per_unit == 30000.0

