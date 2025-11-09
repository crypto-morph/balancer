from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
from .db import Base

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    symbol = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    coingecko_id = Column(String, index=True)
    is_stable = Column(Boolean, default=False)
    is_fiat = Column(Boolean, default=False)
    eligible_note = Column(Text)
    active = Column(Boolean, default=True)
    __table_args__ = (UniqueConstraint("symbol", name="uq_asset_symbol"),)

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    base_currency = Column(String, default="USD")

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True, nullable=False)
    coins = Column(Float, default=0.0)
    avg_cost_ccy = Column(String, default="GBP")
    avg_cost_per_unit = Column(Float, default=0.0)
    as_of = Column(DateTime, default=lambda: datetime.now(UTC))
    portfolio = relationship("Portfolio")
    asset = relationship("Asset")
    __table_args__ = (UniqueConstraint("portfolio_id", "asset_id", name="uq_position_portfolio_asset"),)

class Price(Base):
    __tablename__ = "prices"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True, nullable=False)
    ccy = Column(String, index=True, nullable=False)
    price = Column(Float, nullable=False)
    at = Column(DateTime, index=True, default=lambda: datetime.now(UTC))

class FxRate(Base):
    __tablename__ = "fx_rates"
    id = Column(Integer, primary_key=True)
    base_ccy = Column(String, index=True, nullable=False)
    quote_ccy = Column(String, index=True, nullable=False)
    rate = Column(Float, nullable=False)
    at = Column(DateTime, index=True, default=lambda: datetime.now(UTC))
    __table_args__ = (UniqueConstraint("base_ccy", "quote_ccy", "at", name="uq_fx_pair_time"),)

class Target(Base):
    __tablename__ = "targets"
    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True, nullable=False)
    target_weight = Column(Float, default=0.0)
    min_trade_usd = Column(Float, default=50.0)
    drift_band = Column(Float, default=0.2)
    __table_args__ = (UniqueConstraint("portfolio_id", "asset_id", name="uq_target_portfolio_asset"),)

class Narrative(Base):
    __tablename__ = "narratives"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    active = Column(Boolean, default=True)

class AssetNarrative(Base):
    __tablename__ = "asset_narratives"
    asset_id = Column(Integer, ForeignKey("assets.id"), primary_key=True)
    narrative_id = Column(Integer, ForeignKey("narratives.id"), primary_key=True)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True, nullable=False)
    type = Column(String, index=True, nullable=False)
    message = Column(Text, nullable=False)
    payload_json = Column(Text)
    severity = Column(String, default="info")
    at = Column(DateTime, index=True, default=lambda: datetime.now(UTC))

class TradeManual(Base):
    __tablename__ = "trades_manual"
    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True, nullable=False)
    side = Column(String, nullable=False)  # BUY/SELL
    qty = Column(Float, nullable=False)
    price_ccy = Column(String, default="GBP")
    price = Column(Float, default=0.0)
    fee_ccy = Column(String)
    fee = Column(Float, default=0.0)
    note = Column(Text)
    at = Column(DateTime, index=True, default=lambda: datetime.now(UTC))

class Indicator(Base):
    __tablename__ = "indicators"
    id = Column(Integer, primary_key=True)
    name = Column(String, index=True, nullable=False)
    value = Column(Float, nullable=False)
    at = Column(DateTime, index=True, default=lambda: datetime.now(UTC))

class NewsItem(Base):
    __tablename__ = "news_items"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True)
    source = Column(String)
    title = Column(String)
    url = Column(String)
    at = Column(DateTime, index=True, default=lambda: datetime.now(UTC))
