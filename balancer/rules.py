from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List, Dict

from .config import COOLOFF_DAYS, DEFAULT_BASE_CCY
from .db import SessionLocal
from .models import Position, Price, FxRate, Target, Alert, Asset, Portfolio
from .alerts import log_alert


@dataclass
class PriceBook:
    usd: float | None
    gbp: float | None
    btc: float | None


def latest_price(db, asset_id: int, ccy: str) -> Optional[float]:
    row = (
        db.query(Price)
        .filter(Price.asset_id == asset_id, Price.ccy == ccy)
        .order_by(Price.at.desc())
        .first()
    )
    return float(row.price) if row else None


def get_price_book(db, asset_id: int) -> PriceBook:
    return PriceBook(
        usd=latest_price(db, asset_id, "USD"),
        gbp=latest_price(db, asset_id, "GBP"),
        btc=latest_price(db, asset_id, "BTC"),
    )


def latest_fx(db, base: str, quote: str) -> Optional[float]:
    row = (
        db.query(FxRate)
        .filter(FxRate.base_ccy == base, FxRate.quote_ccy == quote)
        .order_by(FxRate.at.desc())
        .first()
    )
    return float(row.rate) if row else None


def gbp_to_usd(db) -> Optional[float]:
    # Prefer stored FX
    rate = latest_fx(db, "GBP", "USD")
    if rate:
        return rate
    # Derive from USDC if available: USD/GBP = usdc_usd / usdc_gbp
    # Find asset with symbol USDC or coingecko_id usd-coin
    usdc_asset = db.query(Asset).filter(Asset.symbol == "USDC").first()
    if not usdc_asset:
        usdc_asset = db.query(Asset).filter(Asset.coingecko_id == "usd-coin").first()
    if not usdc_asset:
        return None
    usdc_usd = latest_price(db, usdc_asset.id, "USD")
    usdc_gbp = latest_price(db, usdc_asset.id, "GBP")
    if usdc_usd and usdc_gbp and usdc_gbp != 0:
        return usdc_usd / usdc_gbp
    return None


def position_market_value_usd(db, pos: Position) -> Optional[float]:
    pb = get_price_book(db, pos.asset_id)
    if pb.usd is not None:
        return pb.usd * pos.coins
    if pb.gbp is not None:
        rate = gbp_to_usd(db)
        if rate:
            return pb.gbp * rate * pos.coins
    return None


def position_cost_basis_usd(db, pos: Position) -> Optional[float]:
    # Avg cost per unit stored in pos.avg_cost_ccy (GBP per spec now)
    if pos.avg_cost_per_unit is None:
        return None
    if (pos.avg_cost_ccy or "").upper() == "USD":
        return pos.avg_cost_per_unit * pos.coins
    if (pos.avg_cost_ccy or "").upper() == "GBP":
        rate = gbp_to_usd(db)
        if rate:
            return pos.avg_cost_per_unit * rate * pos.coins
    # Fallback: unknown ccy, assume USD
    return pos.avg_cost_per_unit * pos.coins


def last_alert_within(db, portfolio_id: int, asset_id: int, kind: str, within: timedelta) -> bool:
    since = datetime.utcnow() - within
    row = (
        db.query(Alert)
        .filter(
            Alert.portfolio_id == portfolio_id,
            Alert.asset_id == asset_id,
            Alert.type == kind,
            Alert.at >= since,
        )
        .order_by(Alert.at.desc())
        .first()
    )
    return row is not None


def evaluate_take_profit(db, portfolio_id: int, pos: Position) -> None:
    # Skip zero positions
    if not pos.coins or pos.coins <= 0:
        return
    mv = position_market_value_usd(db, pos)
    cb = position_cost_basis_usd(db, pos)
    if mv is None or cb is None or cb <= 0:
        return
    pnl_multiple = mv / cb  # e.g., 2.0 => 100% profit
    # Determine ladder thresholds crossed: 2x (1x profit), 3x (2x profit)?
    # We use doubling thresholds starting from 2.0, 3.0? Spec states 1x profit (2.0 multiple), 2x profit (3.0 multiple?)
    # Clarified: 1x, 2x, 4x profit => multiples 2.0, 3.0? Actually 2x profit is 3x multiple; 4x profit is 5x multiple.
    # We'll implement thresholds at profit multiples [1, 2, 4] => asset value multiples [2, 3, 5].
    thresholds = [2.0, 3.0, 5.0]
    # Cooldown
    cooldown = timedelta(days=COOLOFF_DAYS)
    for m in thresholds:
        if pnl_multiple >= m:
            if last_alert_within(db, portfolio_id, pos.asset_id, f"take_profit_{int(m)}x_value", cooldown):
                continue
            # Recommend sell 33% of current remaining position
            qty = pos.coins * 0.33
            asset = db.query(Asset).get(pos.asset_id)
            log_alert(
                kind="take_profit",
                message=f"{asset.symbol}: Value >= {m:.1f}x cost. Consider selling 33% (~{qty:.6f} units)",
                payload={
                    "asset_id": pos.asset_id,
                    "portfolio_id": portfolio_id,
                    "multiple": m,
                    "qty_suggested": qty,
                    "mv_usd": mv,
                    "cb_usd": cb,
                },
                severity="info",
            )
            # Record an alert row for cooldown checks
            db.add(
                Alert(
                    portfolio_id=portfolio_id,
                    asset_id=pos.asset_id,
                    type=f"take_profit_{int(m)}x_value",
                    message="suggested take profit",
                    severity="info",
                )
            )
            db.commit()


def evaluate_drift(db, portfolio_id: int, positions: List[Position]) -> None:
    # Build map of target weights
    targets: Dict[int, Target] = {t.asset_id: t for t in db.query(Target).filter(Target.portfolio_id == portfolio_id).all()}
    if not targets:
        return
    # Compute portfolio total MV
    mv_by_asset: Dict[int, float] = {}
    total_mv = 0.0
    for pos in positions:
        mv = position_market_value_usd(db, pos)
        if mv is None:
            continue
        mv_by_asset[pos.asset_id] = mv
        total_mv += mv
    if total_mv <= 0:
        return
    for pos in positions:
        t = targets.get(pos.asset_id)
        if not t:
            continue
        actual_w = (mv_by_asset.get(pos.asset_id, 0.0) / total_mv) if total_mv else 0.0
        drift = actual_w - (t.target_weight or 0.0)
        band = t.drift_band or 0.2
        min_trade = t.min_trade_usd or 50.0
        if abs(drift) >= band:
            # Amount to trade in USD to get back to target
            target_value = (t.target_weight or 0.0) * total_mv
            diff_value = target_value - mv_by_asset.get(pos.asset_id, 0.0)
            if abs(diff_value) >= min_trade:
                side = "BUY" if diff_value > 0 else "SELL"
                asset = db.query(Asset).get(pos.asset_id)
                price_usd = latest_price(db, pos.asset_id, "USD") or 0.0
                qty = abs(diff_value) / price_usd if price_usd else 0.0
                log_alert(
                    kind="rebalance",
                    message=f"{asset.symbol}: Drift {drift:+.2%}. {side} ~${abs(diff_value):.2f} (~{qty:.6f} units)",
                    payload={
                        "asset_id": pos.asset_id,
                        "portfolio_id": portfolio_id,
                        "drift": drift,
                        "side": side,
                        "trade_value_usd": abs(diff_value),
                        "qty_suggested": qty,
                    },
                    severity="info",
                )
                db.add(
                    Alert(
                        portfolio_id=portfolio_id,
                        asset_id=pos.asset_id,
                        type="rebalance_suggested",
                        message="suggested rebalance",
                        severity="info",
                    )
                )
                db.commit()


def run_rules(portfolio_name: str = "Default") -> None:
    with SessionLocal() as db:
        portfolio = db.query(Portfolio).filter_by(name=portfolio_name).first()
        if not portfolio:
            return
        positions = (
            db.query(Position).join(Asset, Asset.id == Position.asset_id).filter(Position.portfolio_id == portfolio.id, Asset.active == True).all()
        )
        for pos in positions:
            evaluate_take_profit(db, portfolio.id, pos)
        evaluate_drift(db, portfolio.id, positions)
