from __future__ import annotations
from datetime import datetime, timedelta
from typing import Iterable
from .db import SessionLocal
from .models import Price, FxRate, Asset


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
