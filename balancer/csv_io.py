from __future__ import annotations
import csv
from pathlib import Path
from typing import Optional
from .db import SessionLocal
from .models import Asset, Portfolio, Position


CSV_FIELDS = ["symbol", "coins", "avg_cost_ccy", "avg_cost_per_unit"]


def export_portfolio_csv(path: str | Path, portfolio_name: Optional[str] = None) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        # Resolve portfolio
        if portfolio_name:
            pf = db.query(Portfolio).filter(Portfolio.name == portfolio_name).first()
        else:
            pf = db.query(Portfolio).first()
        if not pf:
            # nothing to export
            out.write_text("")
            return
        rows = (
            db.query(Asset.symbol, Position.coins, Position.avg_cost_ccy, Position.avg_cost_per_unit)
            .join(Position, Position.asset_id == Asset.id)
            .filter(Position.portfolio_id == pf.id)
            .all()
        )
        with out.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(CSV_FIELDS)
            for sym, coins, ccy, avg in rows:
                writer.writerow([sym, coins or 0.0, (ccy or "GBP"), avg or 0.0])


def import_portfolio_csv(path: str | Path, portfolio_name: str = "Default") -> None:
    p = Path(path)
    if not p.exists():
        return
    with SessionLocal() as db:
        # Ensure portfolio
        pf = db.query(Portfolio).filter(Portfolio.name == portfolio_name).first()
        if not pf:
            pf = Portfolio(name=portfolio_name, base_currency="USD")
            db.add(pf)
            db.commit()
            db.refresh(pf)
        # Read CSV
        with p.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                sym = (row.get("symbol") or "").strip().upper()
                if not sym:
                    continue
                try:
                    coins = float(row.get("coins") or 0.0)
                except Exception:
                    coins = 0.0
                ccy = (row.get("avg_cost_ccy") or "GBP").upper()
                try:
                    avg = float(row.get("avg_cost_per_unit") or 0.0)
                except Exception:
                    avg = 0.0
                asset = db.query(Asset).filter(Asset.symbol == sym).first()
                if not asset:
                    asset = Asset(symbol=sym, name=sym, active=True)
                    db.add(asset)
                    db.commit()
                    db.refresh(asset)
                pos = (
                    db.query(Position)
                    .filter(Position.portfolio_id == pf.id, Position.asset_id == asset.id)
                    .first()
                )
                if not pos:
                    pos = Position(
                        portfolio_id=pf.id,
                        asset_id=asset.id,
                        coins=coins,
                        avg_cost_ccy=ccy,
                        avg_cost_per_unit=avg,
                    )
                    db.add(pos)
                else:
                    pos.coins = coins
                    pos.avg_cost_ccy = ccy
                    pos.avg_cost_per_unit = avg
                    db.add(pos)
            db.commit()
