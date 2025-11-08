from typing import Dict, List, Tuple
from datetime import datetime
from .config import CG_MAPPING_FILE
from .db import SessionLocal
from .models import Asset, Price, FxRate
from .clients import CoingeckoClient


def read_mapping_ids() -> List[str]:
    try:
        with open(CG_MAPPING_FILE, "r", encoding="utf-8") as f:
            first = f.readline().strip()
            ids = [x.strip() for x in first.split(",") if x.strip()]
            return ids
    except FileNotFoundError:
        return []


def fetch_markets(ids: List[str], vs: str) -> List[dict]:
    client = CoingeckoClient()
    return client.markets(ids, vs)


def upsert_assets_for_markets(market_rows: List[dict]) -> Dict[str, int]:
    """Ensure assets table has rows for each market id; returns map cg_id -> asset_id."""
    m: Dict[str, int] = {}
    with SessionLocal() as db:
        for row in market_rows:
            cg_id = row.get("id")
            symbol = (row.get("symbol") or "").upper()
            name = row.get("name") or symbol
            if not cg_id:
                continue
            asset = db.query(Asset).filter(Asset.coingecko_id == cg_id).first()
            if not asset:
                # fallback: try by symbol
                asset = db.query(Asset).filter(Asset.symbol == symbol).first()
            if not asset:
                asset = Asset(symbol=symbol, name=name, coingecko_id=cg_id, active=True)
                db.add(asset)
                db.commit()
                db.refresh(asset)
            else:
                if not asset.coingecko_id:
                    asset.coingecko_id = cg_id
                    db.add(asset)
                    db.commit()
            m[cg_id] = asset.id
    return m


def store_prices(rows_usd: List[dict], rows_gbp: List[dict]) -> Tuple[float, int]:
    """Store USD and GBP prices. Returns btc_usd and count stored."""
    by_id_usd = {r.get("id"): r for r in rows_usd}
    by_id_gbp = {r.get("id"): r for r in rows_gbp}
    btc_usd = 0.0
    stored = 0
    with SessionLocal() as db:
        # ensure assets exist and get ids mapping
        m = upsert_assets_for_markets(list(by_id_usd.values()) or list(by_id_gbp.values()))
        now = datetime.utcnow()
        usdc_usd = 0.0
        usdc_gbp = 0.0
        for cg_id, asset_id in m.items():
            u = by_id_usd.get(cg_id)
            g = by_id_gbp.get(cg_id)
            if u and isinstance(u.get("current_price"), (int, float)):
                price = Price(asset_id=asset_id, ccy="USD", price=float(u["current_price"]), at=now)
                db.add(price)
                stored += 1
                sym = (u.get("symbol", "") or "").lower()
                if sym == "btc" or cg_id == "bitcoin":
                    btc_usd = float(u["current_price"])
                if sym == "usdc" or cg_id == "usd-coin":
                    usdc_usd = float(u["current_price"])
            if g and isinstance(g.get("current_price"), (int, float)):
                price = Price(asset_id=asset_id, ccy="GBP", price=float(g["current_price"]), at=now)
                db.add(price)
                stored += 1
                symg = (g.get("symbol", "") or "").lower()
                if symg == "usdc" or cg_id == "usd-coin":
                    usdc_gbp = float(g["current_price"])
        # Store GBPUSD FX if derivable from USDC
        if usdc_usd and usdc_gbp:
            rate = usdc_usd / usdc_gbp
            db.add(FxRate(base_ccy="GBP", quote_ccy="USD", rate=rate, at=now))
        db.commit()
    return btc_usd, stored


def derive_and_store_btc_prices(rows_usd: List[dict], btc_usd: float) -> int:
    if not btc_usd:
        return 0
    by_id_usd = {r.get("id"): r for r in rows_usd}
    stored = 0
    now = datetime.utcnow()
    with SessionLocal() as db:
        # map ids to asset ids
        m = upsert_assets_for_markets(list(by_id_usd.values()))
        for cg_id, asset_id in m.items():
            u = by_id_usd.get(cg_id)
            if u and isinstance(u.get("current_price"), (int, float)):
                price_btc = float(u["current_price"]) / btc_usd
                db.add(Price(asset_id=asset_id, ccy="BTC", price=price_btc, at=now))
                stored += 1
        # also store FX rate for BTCUSD
        db.add(FxRate(base_ccy="BTC", quote_ccy="USD", rate=btc_usd, at=now))
        db.commit()
    return stored


def run_price_fetch() -> None:
    ids = read_mapping_ids()
    rows_usd = fetch_markets(ids, "usd")
    rows_gbp = fetch_markets(ids, "gbp")
    btc_usd, _ = store_prices(rows_usd, rows_gbp)
    derive_and_store_btc_prices(rows_usd, btc_usd)
