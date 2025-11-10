from __future__ import annotations
from datetime import datetime, timedelta
from typing import Iterable, List, Tuple
from .db import SessionLocal
from .models import Price, FxRate, Asset
from .price_fetcher import ids_from_positions, read_mapping_ids, upsert_assets_for_markets
from .clients import CoingeckoClient
import time


def _bucket_hours(now: datetime, hours: int) -> Iterable[datetime]:
    end = now.replace(minute=0, second=0, microsecond=0)
    for i in range(hours):
        yield end - timedelta(hours=i)


def _bucket_days(now: datetime, days: int) -> Iterable[datetime]:
    end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(days):
        yield end - timedelta(days=i)


def carry_forward_missing(now: datetime | None = None) -> None:
    """Fill gaps by carrying forward the last known value for:
    - Prices (USD): hourly last 24h buckets and daily last 365d buckets
    - FX (GBP->USD, BTC->USD): same buckets
    """
    now = now or datetime.utcnow()
    with SessionLocal() as db:
        asset_ids = [r[0] for r in db.query(Asset.id).filter(Asset.active == True).all()]

        # Prices hourly (24h)
        for aid in asset_ids:
            for ts in _bucket_hours(now, 24):
                # if no price in that hour, insert last known before
                exists = (
                    db.query(Price)
                    .filter(Price.asset_id == aid, Price.ccy == "USD", Price.at >= ts, Price.at < ts + timedelta(hours=1))
                    .first()
                )
                if exists:
                    continue
                ref = (
                    db.query(Price)
                    .filter(Price.asset_id == aid, Price.ccy == "USD", Price.at < ts)
                    .order_by(Price.at.desc())
                    .first()
                )
                if ref:
                    db.add(Price(asset_id=aid, ccy="USD", price=ref.price, at=ts))
        db.commit()

        # Prices daily (365d)
        for aid in asset_ids:
            for ts in _bucket_days(now, 365):
                exists = (
                    db.query(Price)
                    .filter(Price.asset_id == aid, Price.ccy == "USD", Price.at >= ts, Price.at < ts + timedelta(days=1))
                    .first()
                )
                if exists:
                    continue
                ref = (
                    db.query(Price)
                    .filter(Price.asset_id == aid, Price.ccy == "USD", Price.at < ts)
                    .order_by(Price.at.desc())
                    .first()
                )
                if ref:
                    db.add(Price(asset_id=aid, ccy="USD", price=ref.price, at=ts))
        db.commit()

        # FX hourly and daily for GBP and BTC
        for base in ("GBP", "BTC"):
            for ts in _bucket_hours(now, 24):
                exists = (
                    db.query(FxRate)
                    .filter(FxRate.base_ccy == base, FxRate.quote_ccy == "USD", FxRate.at >= ts, FxRate.at < ts + timedelta(hours=1))
                    .first()
                )
                if not exists:
                    ref = (
                        db.query(FxRate)
                        .filter(FxRate.base_ccy == base, FxRate.quote_ccy == "USD", FxRate.at < ts)
                        .order_by(FxRate.at.desc())
                        .first()
                    )
                    if ref:
                        db.add(FxRate(base_ccy=base, quote_ccy="USD", rate=ref.rate, at=ts))
            db.commit()

            for ts in _bucket_days(now, 365):
                exists = (
                    db.query(FxRate)
                    .filter(FxRate.base_ccy == base, FxRate.quote_ccy == "USD", FxRate.at >= ts, FxRate.at < ts + timedelta(days=1))
                    .first()
                )
                if not exists:
                    ref = (
                        db.query(FxRate)
                        .filter(FxRate.base_ccy == base, FxRate.quote_ccy == "USD", FxRate.at < ts)
                        .order_by(FxRate.at.desc())
                        .first()
                    )
                    if ref:
                        db.add(FxRate(base_ccy=base, quote_ccy="USD", rate=ref.rate, at=ts))
            db.commit()


def _ms_to_dt(ms: int) -> datetime:
    # Use naive UTC to match current DB defaults
    return datetime.utcfromtimestamp(ms / 1000.0)


def hourly_backfill_24h() -> None:
    """Fetch 24h series at ~5-min granularity and insert raw USD prices and FX (GBPUSD via USDC, BTCUSD via BTC) for the last 24h.
    Caller should run compaction after this to collapse to hourly buckets.
    """
    ids = ids_from_positions() or read_mapping_ids()
    if not ids:
        return
    client = CoingeckoClient()

    # Ensure assets have coingecko_id mapping populated; batch to avoid rate limits
    def _chunks(seq, n):
        for i in range(0, len(seq), n):
            yield seq[i:i+n]
    for batch in _chunks(ids, 50):
        try:
            market_rows = client.markets(batch, vs_currency="usd")
            if market_rows:
                upsert_assets_for_markets(market_rows)
        except Exception:
            pass
        time.sleep(0.4)

    # FX series first: GBPUSD via USDC (USD/GBP) and BTCUSD via BTC USD
    try:
        usdc_usd = client.market_chart("usd-coin", vs_currency="usd", days="1").get("prices", [])
        time.sleep(0.3)
    except Exception:
        usdc_usd = []
    try:
        usdc_gbp = client.market_chart("usd-coin", vs_currency="gbp", days="1").get("prices", [])
        time.sleep(0.3)
    except Exception:
        usdc_gbp = []
    try:
        btc_usd = client.market_chart("bitcoin", vs_currency="usd", days="1").get("prices", [])
        time.sleep(0.3)
    except Exception:
        btc_usd = []

    with SessionLocal() as db:
        # GBPUSD derivation by aligning to nearest timestamp
        j = 0
        for t_ms, usd_price in usdc_usd:
            while j + 1 < len(usdc_gbp) and abs(usdc_gbp[j + 1][0] - t_ms) <= abs(usdc_gbp[j][0] - t_ms):
                j += 1
            gbp_price = usdc_gbp[j][1] if usdc_gbp else 0.0
            if usd_price and gbp_price:
                try:
                    at_dt = _ms_to_dt(int(t_ms))
                    exists = (
                        db.query(FxRate)
                        .filter(
                            FxRate.base_ccy == "GBP",
                            FxRate.quote_ccy == "USD",
                            FxRate.at == at_dt,
                        )
                        .first()
                    )
                    if not exists:
                        rate = float(usd_price) / float(gbp_price)
                        db.add(FxRate(base_ccy="GBP", quote_ccy="USD", rate=rate, at=at_dt))
                except Exception:
                    pass
        for t_ms, p in btc_usd:
            try:
                at_dt = _ms_to_dt(int(t_ms))
                exists = (
                    db.query(FxRate)
                    .filter(
                        FxRate.base_ccy == "BTC",
                        FxRate.quote_ccy == "USD",
                        FxRate.at == at_dt,
                    )
                    .first()
                )
                if not exists:
                    db.add(FxRate(base_ccy="BTC", quote_ccy="USD", rate=float(p), at=at_dt))
            except Exception:
                pass
        db.commit()

        # Prices for assets (USD)
        for cg_id in ids:
            try:
                series = client.market_chart(cg_id, vs_currency="usd", days="1").get("prices", [])
                time.sleep(0.3)
                # Resolve asset strictly by coingecko_id to avoid creating mismatched placeholders
                asset = db.query(Asset).filter(Asset.coingecko_id == cg_id).first()
                if not asset:
                    # Skip if asset mapping is not established yet
                    continue
                for t_ms, price in series:
                    try:
                        db.add(Price(asset_id=asset.id, ccy="USD", price=float(price), at=_ms_to_dt(int(t_ms))))
                    except Exception:
                        continue
                db.commit()
            except Exception:
                db.rollback()
                continue
