from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from .db import SessionLocal
from .models import Asset, Price, FxRate
from .price_fetcher import ids_from_positions, read_mapping_ids
from .clients import CoingeckoClient
from .compaction import compact_all


def _ms_to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).replace(tzinfo=None)


def _upsert_assets_by_ids(ids: List[str]) -> Dict[str, int]:
    """Ensure Asset rows exist for given Coingecko ids, returns cg_id -> asset_id."""
    # Reuse upsert via markets endpoint minimally by synthesizing rows
    # But we might not have names/symbols here; fallback to pre-existing rows.
    m: Dict[str, int] = {}
    with SessionLocal() as db:
        assets = db.query(Asset).filter(Asset.coingecko_id.in_(ids)).all()
        by_id = {a.coingecko_id: a for a in assets if a.coingecko_id}
        for cg_id in ids:
            a = by_id.get(cg_id)
            if not a:
                # Try to find by symbol heuristic (cg_id often equals slug; we cannot guess symbol reliably)
                # Create placeholder asset if truly missing
                a = Asset(symbol=cg_id[:10].upper(), name=cg_id, coingecko_id=cg_id, active=True)
                db.add(a)
                db.commit()
                db.refresh(a)
            m[cg_id] = a.id
    return m


def backfill_prices(days: str = "365", vs_list: List[str] | Tuple[str, ...] = ("USD", "GBP", "BTC")) -> None:
    """Backfill USD prices and FX series (GBPUSD, BTCUSD) for portfolio assets.
    - days: Coingecko range, e.g. '30', '365'
    - vs_list: kept for API compatibility; only USD prices are stored, FX derived for GBP and BTC.
    """
    # Coingecko free endpoints limit reliable ranges; constrain to 365 days max
    if str(days).lower() == "max":
        days = "365"
    ids = ids_from_positions() or read_mapping_ids()
    if not ids:
        return

    client = CoingeckoClient()

    # Map cg_id -> asset_id
    id_map = _upsert_assets_by_ids(ids)

    # Prepare FX series: BTCUSD and GBPUSD (via USDC)
    btc_chart_usd = client.market_chart("bitcoin", vs_currency="usd", days=days)
    btc_usd_series = [(int(t), float(p)) for t, p in btc_chart_usd.get("prices", [])]

    usdc_usd_chart = client.market_chart("usd-coin", vs_currency="usd", days=days)
    usdc_gbp_chart = client.market_chart("usd-coin", vs_currency="gbp", days=days)
    usdc_usd_series = [(int(t), float(p)) for t, p in usdc_usd_chart.get("prices", [])]
    usdc_gbp_series = [(int(t), float(p)) for t, p in usdc_gbp_chart.get("prices", [])]

    with SessionLocal() as db:
        # Insert FX: BTCUSD
        for t_ms, btc_usd in btc_usd_series:
            db.add(FxRate(base_ccy="BTC", quote_ccy="USD", rate=btc_usd, at=_ms_to_dt(t_ms)))

        # Insert FX: GBPUSD via USDC (USD/GBP)
        j = 0
        for t_ms, usdc_usd in usdc_usd_series:
            # advance pointer in GBP series to closest
            while j + 1 < len(usdc_gbp_series) and abs(usdc_gbp_series[j + 1][0] - t_ms) <= abs(usdc_gbp_series[j][0] - t_ms):
                j += 1
            usdc_gbp = usdc_gbp_series[j][1] if usdc_gbp_series else 0.0
            if usdc_usd and usdc_gbp:
                db.add(FxRate(base_ccy="GBP", quote_ccy="USD", rate=(usdc_usd / usdc_gbp), at=_ms_to_dt(t_ms)))

        # Insert USD prices for each asset
        for cg_id in ids:
            try:
                asset_id = id_map.get(cg_id)
                if not asset_id:
                    continue
                chart_usd = client.market_chart(cg_id, vs_currency="usd", days=days)
                series_usd = [(int(t), float(p)) for t, p in chart_usd.get("prices", [])]
                for t_ms, price in series_usd:
                    db.add(Price(asset_id=asset_id, ccy="USD", price=price, at=_ms_to_dt(t_ms)))
                db.commit()
            except Exception:
                db.rollback()
                continue

    # Compact after writes
    compact_all()
