from __future__ import annotations
from datetime import datetime, timedelta, UTC
from typing import Dict, Any
from .db import SessionLocal


def _now() -> datetime:
    return datetime.now(UTC)


def verify_health() -> Dict[str, Any]:
    """Return simple coverage stats for prices (USD) and FX (GBPUSD, BTCUSD).
    - Checks last 24h hourly coverage and last 365d daily coverage by bucket presence.
    """
    now = _now()
    since_24h = now - timedelta(hours=24)
    since_1y = now - timedelta(days=365)

    with SessionLocal() as db:
        # Assets with at least one USD price
        assets = db.execute("SELECT id FROM assets WHERE active = 1").fetchall()
        asset_ids = [r[0] for r in assets]
        out: Dict[str, Any] = {
            "assets_total": len(asset_ids),
            "prices": {"hourly_24h_missing": 0, "daily_1y_missing": 0},
            "fx": {"GBPUSD": {"hourly_24h_missing": 0, "daily_1y_missing": 0},
                    "BTCUSD": {"hourly_24h_missing": 0, "daily_1y_missing": 0}},
        }

        # Helper to count distinct buckets present
        def count_price_buckets(asset_id: int, since: datetime, fmt: str) -> int:
            sql = (
                "SELECT COUNT(DISTINCT strftime(?, at)) FROM prices "
                "WHERE asset_id = ? AND ccy = 'USD' AND at >= ?"
            )
            return int(db.execute(sql, (fmt, asset_id, since)).fetchone()[0] or 0)

        def count_fx_buckets(base: str, since: datetime, fmt: str) -> int:
            sql = (
                "SELECT COUNT(DISTINCT strftime(?, at)) FROM fx_rates "
                "WHERE base_ccy = ? AND quote_ccy = 'USD' AND at >= ?"
            )
            return int(db.execute(sql, (fmt, base, since)).fetchone()[0] or 0)

        # Prices: expect ~24 hourly buckets in last 24h and ~365 daily buckets in last 1y
        for aid in asset_ids:
            hourly = count_price_buckets(aid, since_24h, "%Y-%m-%d %H")
            if hourly < 20:  # allow slack
                out["prices"]["hourly_24h_missing"] += 1
            daily = count_price_buckets(aid, since_1y, "%Y-%m-%d")
            if daily < 300:  # allow slack
                out["prices"]["daily_1y_missing"] += 1

        # FX coverage
        for base in ("GBP", "BTC"):
            hourly = count_fx_buckets(base, since_24h, "%Y-%m-%d %H")
            if hourly < 20:
                out["fx"][f"{base}USD"]["hourly_24h_missing"] += 1
            daily = count_fx_buckets(base, since_1y, "%Y-%m-%d")
            if daily < 300:
                out["fx"][f"{base}USD"]["daily_1y_missing"] += 1

        return out
