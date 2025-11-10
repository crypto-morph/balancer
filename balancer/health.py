from __future__ import annotations
from datetime import datetime, timedelta, UTC
from typing import Dict, Any
from .db import SessionLocal
from .models import Asset, Position
from sqlalchemy import text


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
        # Only consider assets that are in the portfolio (positions), held (>0 coins), and are not fiat
        asset_ids = [
            row[0]
            for row in (
                db.query(Position.asset_id)
                .join(Asset, Asset.id == Position.asset_id)
                .filter(Position.coins > 0, (Asset.is_fiat == False) | (Asset.is_fiat.is_(None)))
                .distinct()
                .all()
            )
        ]
        out: Dict[str, Any] = {
            "assets_total": len(asset_ids),
            "prices": {"hourly_24h_missing": 0, "daily_1y_missing": 0},
            "fx": {"GBPUSD": {"hourly_24h_missing": 0, "daily_1y_missing": 0},
                    "BTCUSD": {"hourly_24h_missing": 0, "daily_1y_missing": 0}},
        }

        # Helper to count distinct buckets present
        def count_price_buckets_hourly(asset_id: int) -> int:
            sql = text(
                "SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H', at)) AS c FROM prices "
                "WHERE asset_id = :aid AND ccy = 'USD' AND at >= datetime('now','-24 hours')"
            )
            row = db.execute(sql, {"aid": asset_id}).fetchone()
            return int((row[0] if row else 0) or 0)

        def count_price_buckets_daily(asset_id: int) -> int:
            sql = text(
                "SELECT COUNT(DISTINCT date(at)) AS c FROM prices "
                "WHERE asset_id = :aid AND ccy = 'USD' AND at >= datetime('now','-365 days')"
            )
            row = db.execute(sql, {"aid": asset_id}).fetchone()
            return int((row[0] if row else 0) or 0)

        def count_fx_buckets_hourly(base: str) -> int:
            sql = text(
                "SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H', at)) AS c FROM fx_rates "
                "WHERE base_ccy = :base AND quote_ccy = 'USD' AND at >= datetime('now','-24 hours')"
            )
            row = db.execute(sql, {"base": base}).fetchone()
            return int((row[0] if row else 0) or 0)

        def count_fx_buckets_daily(base: str) -> int:
            sql = text(
                "SELECT COUNT(DISTINCT date(at)) AS c FROM fx_rates "
                "WHERE base_ccy = :base AND quote_ccy = 'USD' AND at >= datetime('now','-365 days')"
            )
            row = db.execute(sql, {"base": base}).fetchone()
            return int((row[0] if row else 0) or 0)

        # Prices: expect ~24 hourly buckets in last 24h and ~365 daily buckets in last 1y
        for aid in asset_ids:
            hourly = count_price_buckets_hourly(aid)
            if hourly < 20:  # allow slack
                out["prices"]["hourly_24h_missing"] += 1
            daily = count_price_buckets_daily(aid)
            if daily < 300:  # allow slack
                out["prices"]["daily_1y_missing"] += 1

        # FX coverage
        for base in ("GBP", "BTC"):
            hourly = count_fx_buckets_hourly(base)
            if hourly < 20:
                out["fx"][f"{base}USD"]["hourly_24h_missing"] += 1
            daily = count_fx_buckets_daily(base)
            if daily < 300:
                out["fx"][f"{base}USD"]["daily_1y_missing"] += 1

        return out


def report_24h_per_asset() -> Dict[str, Any]:
    """Return per-asset 24h hourly bucket coverage for non-fiat, held assets.
    Classify assets with >=20 hourly buckets as 'full', others as 'missing'.
    """
    with SessionLocal() as db:
        rows = db.execute(
            text(
                """
                SELECT a.symbol AS symbol,
                       COUNT(DISTINCT strftime('%Y-%m-%d %H', p.at)) AS buckets
                  FROM positions pos
                  JOIN assets a ON a.id = pos.asset_id
                  LEFT JOIN prices p ON p.asset_id = a.id AND p.ccy = 'USD' AND p.at >= datetime('now','-24 hours')
                 WHERE pos.coins > 0 AND (a.is_fiat = 0 OR a.is_fiat IS NULL)
                 GROUP BY a.id, a.symbol
                 ORDER BY a.symbol
                """
            )
        ).fetchall()
        full: list[dict] = []
        missing: list[dict] = []
        for symbol, buckets in rows:
            item = {"symbol": symbol, "buckets_24h": int(buckets or 0), "ok": int(buckets or 0) >= 20}
            if item["ok"]:
                full.append(item)
            else:
                missing.append(item)
        return {"full": full, "missing": missing, "total": len(full) + len(missing)}
