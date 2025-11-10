from pathlib import Path
from typing import List, Tuple, Dict, Any
import json

from .config import INITIAL_TOKENLIST, AVG_COST_DEFAULT_CCY
from .db import Base, engine, SessionLocal
from .models import Asset, Portfolio, Position
from .utils import parse_money_gbp, parse_float, clean_name


def read_tokenlist_lines(path: str) -> List[str]:
    p = Path(path)
    if not p.exists():
        return []
    return p.read_text(encoding="utf-8").splitlines()


def parse_row(line: str) -> Tuple[str, str, float, float, float]:
    # Expect tab or multiple spaces delimited. Columns:
    # Token, Symbol, Price(£), Coins, Value(£), Average Buy Price(£)
    parts = [x for x in line.replace("\t", "\u0001").split("\u0001") if x != ""]
    if len(parts) == 1:
        # fallback split by multiple spaces
        parts = [p for p in line.split() if p]
    if len(parts) < 6:
        # try splitting by tabs directly
        parts = line.split("\t")
    if len(parts) < 6:
        # pad to avoid index errors
        parts = parts + [""] * (6 - len(parts))
    token = clean_name(parts[0])
    symbol = parts[1].strip() if len(parts) > 1 else ""
    price_gbp = parse_money_gbp(parts[2] if len(parts) > 2 else "0")
    coins = parse_float(parts[3] if len(parts) > 3 else "0")
    avg_buy_price_gbp = parse_money_gbp(parts[5] if len(parts) > 5 else "0")
    return token, symbol, price_gbp, coins, avg_buy_price_gbp


def import_tokenlist(tokenlist_path: str = INITIAL_TOKENLIST, portfolio_name: str = "Default") -> None:
    Base.metadata.create_all(bind=engine)
    lines = read_tokenlist_lines(tokenlist_path)
    if not lines:
        return
    header_skipped = False
    stable_symbols = {"USDC", "USDT", "SUSDE"}
    with SessionLocal() as db:
        # ensure portfolio exists
        portfolio = db.query(Portfolio).filter_by(name=portfolio_name).first()
        if not portfolio:
            portfolio = Portfolio(name=portfolio_name, base_currency="USD")
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)

        for line in lines:
            if not header_skipped:
                header_skipped = True
                continue
            if not line.strip():
                continue
            token, symbol, _price_gbp, coins, avg_buy_price_gbp = parse_row(line)
            # Identify GBP fiat row
            is_gbp_cash = symbol.upper() == "GBP" or token.upper() == "GBP"
            is_stable = symbol.upper() in stable_symbols or is_gbp_cash
            is_fiat = is_gbp_cash
            # Skip rows with zero coins and zero avg price if symbol is empty
            if not symbol:
                continue
            # upsert asset
            asset = db.query(Asset).filter_by(symbol=symbol.upper()).first()
            if not asset:
                asset = Asset(
                    symbol=symbol.upper(),
                    name=token or symbol.upper(),
                    coingecko_id=None,
                    is_stable=is_stable,
                    is_fiat=is_fiat,
                    active=True,
                )
                db.add(asset)
                db.commit()
                db.refresh(asset)
            else:
                # update stability/fiat flags if changed
                if asset.is_stable != is_stable or asset.is_fiat != is_fiat:
                    asset.is_stable = is_stable
                    asset.is_fiat = is_fiat
                    db.add(asset)
                    db.commit()
            
            # upsert position
            pos = db.query(Position).filter_by(portfolio_id=portfolio.id, asset_id=asset.id).first()
            if not pos:
                pos = Position(
                    portfolio_id=portfolio.id,
                    asset_id=asset.id,
                    coins=coins,
                    avg_cost_ccy=AVG_COST_DEFAULT_CCY,
                    avg_cost_per_unit=avg_buy_price_gbp,
                )
                db.add(pos)
            else:
                pos.coins = coins
                pos.avg_cost_per_unit = avg_buy_price_gbp
                db.add(pos)
            db.commit()


def import_portfolio_json(path: str, portfolio_name: str = "Default") -> None:
    p = Path(path)
    if not p.exists():
        return
    data: Dict[str, Any] = json.loads(p.read_text(encoding="utf-8"))
    assets = data.get("assets") or []
    if not isinstance(assets, list):
        return
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        # ensure portfolio exists
        portfolio = db.query(Portfolio).filter_by(name=portfolio_name).first()
        if not portfolio:
            portfolio = Portfolio(name=portfolio_name, base_currency="USD")
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)
        for a in assets:
            sym = (a.get("symbol") or "").upper()
            name = a.get("name") or sym
            cg = a.get("coingecko_id") or None
            coins = float(a.get("coins") or 0.0)
            if not sym:
                continue
            asset = db.query(Asset).filter_by(symbol=sym).first()
            if not asset:
                asset = Asset(symbol=sym, name=name, coingecko_id=cg, active=True)
                db.add(asset)
                db.commit()
                db.refresh(asset)
            else:
                # update name and mapping if provided
                updated = False
                if name and asset.name != name:
                    asset.name = name
                    updated = True
                if cg and asset.coingecko_id != cg:
                    asset.coingecko_id = cg
                    updated = True
                if updated:
                    db.add(asset)
                    db.commit()
            pos = db.query(Position).filter_by(portfolio_id=portfolio.id, asset_id=asset.id).first()
            if not pos:
                pos = Position(
                    portfolio_id=portfolio.id,
                    asset_id=asset.id,
                    coins=coins,
                    avg_cost_ccy=AVG_COST_DEFAULT_CCY,
                    avg_cost_per_unit=0.0,
                )
                db.add(pos)
            else:
                pos.coins = coins
                db.add(pos)
            db.commit()


if __name__ == "__main__":
    import_tokenlist()
