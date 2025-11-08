import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

from .db import SessionLocal
from .models import Portfolio, Position, Asset, Price, FxRate
from .rules import position_market_value_usd, position_cost_basis_usd
from .config import BASE_DIR, DEFAULT_PORTFOLIO_NAME


def latest_price_usd(db, asset_id: int) -> float | None:
    row = (
        db.query(Price)
        .filter(Price.asset_id == asset_id, Price.ccy == "USD")
        .order_by(Price.at.desc())
        .first()
    )
    return float(row.price) if row else None


def latest_price_ccy(db, asset_id: int, ccy: str) -> float | None:
    row = (
        db.query(Price)
        .filter(Price.asset_id == asset_id, Price.ccy == ccy)
        .order_by(Price.at.desc())
        .first()
    )
    return float(row.price) if row else None


def latest_fx(db, base: str, quote: str) -> float | None:
    row = (
        db.query(FxRate)
        .filter(FxRate.base_ccy == base, FxRate.quote_ccy == quote)
        .order_by(FxRate.at.desc())
        .first()
    )
    return float(row.rate) if row else None


def export_portfolio_json(portfolio_name: str = DEFAULT_PORTFOLIO_NAME) -> Path:
    out_path = Path(BASE_DIR) / "portfolio.json"
    with SessionLocal() as db:
        pf = db.query(Portfolio).filter_by(name=portfolio_name).first()
        if not pf:
            out_path.write_text(json.dumps({"as_of": datetime.utcnow().isoformat() + "Z", "assets": []}, indent=2))
            return out_path
        positions = (
            db.query(Position)
            .join(Asset, Asset.id == Position.asset_id)
            .filter(Position.portfolio_id == pf.id, Asset.active)
            .all()
        )
        assets_payload: List[Dict[str, Any]] = []
        total_mv_usd = 0.0
        total_mv_gbp = 0.0
        total_mv_btc = 0.0
        gbp_usd = latest_fx(db, "GBP", "USD") or 0.0
        btc_usd = latest_fx(db, "BTC", "USD") or 0.0
        for pos in positions:
            asset = db.query(Asset).get(pos.asset_id)
            mv_usd = position_market_value_usd(db, pos) or 0.0
            cb_usd = position_cost_basis_usd(db, pos) or 0.0
            price_usd = latest_price_usd(db, pos.asset_id) or 0.0

            price_gbp = latest_price_ccy(db, pos.asset_id, "GBP") or 0.0
            price_btc = latest_price_ccy(db, pos.asset_id, "BTC") or 0.0

            mv_gbp = price_gbp * pos.coins if price_gbp else (mv_usd / gbp_usd if gbp_usd else 0.0)
            mv_btc = price_btc * pos.coins if price_btc else (mv_usd / btc_usd if btc_usd else 0.0)

            cb_gbp = (cb_usd / gbp_usd) if gbp_usd else 0.0
            cb_btc = (cb_usd / btc_usd) if btc_usd else 0.0

            total_mv_usd += mv_usd
            total_mv_gbp += mv_gbp
            total_mv_btc += mv_btc
            assets_payload.append(
                {
                    "symbol": asset.symbol,
                    "name": asset.name,
                    "coingecko_id": asset.coingecko_id,
                    "is_stable": bool(asset.is_stable),
                    "is_fiat": bool(asset.is_fiat),
                    "coins": pos.coins,
                    "price_usd": price_usd,
                    "price_gbp": price_gbp,
                    "price_btc": price_btc,
                    "mv_usd": mv_usd,
                    "mv_gbp": mv_gbp,
                    "mv_btc": mv_btc,
                    "cb_usd": cb_usd,
                    "cb_gbp": cb_gbp,
                    "cb_btc": cb_btc,
                }
            )
        payload: Dict[str, Any] = {
            "as_of": datetime.utcnow().isoformat() + "Z",
            "portfolio": pf.name,
            "total_mv_usd": total_mv_usd,
            "total_mv_gbp": total_mv_gbp,
            "total_mv_btc": total_mv_btc,
            "assets": assets_payload,
        }
        out_path.write_text(json.dumps(payload, indent=2))
        return out_path


if __name__ == "__main__":
    export_portfolio_json()
