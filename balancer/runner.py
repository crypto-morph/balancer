from datetime import datetime, UTC
from .price_fetcher import run_price_fetch
from .indicators import fetch_btcd, fetch_dxy_fred, fetch_fear_greed, store_indicator
from .rules import run_rules
from .exporter import export_portfolio_json


def run_once() -> None:
    # Prices (single-request pipeline)
    run_price_fetch()

    # Indicators
    btcd = fetch_btcd()
    if btcd:
        store_indicator("BTCD", btcd)
    dxy = fetch_dxy_fred()
    if dxy:
        store_indicator("DXY_TWEX", dxy)
    fng = fetch_fear_greed()
    if fng:
        store_indicator("FEAR_GREED", fng)

    # Rules
    run_rules(portfolio_name="Default")
    # Export portfolio snapshot for UI
    export_portfolio_json()


if __name__ == "__main__":
    start = datetime.now(UTC)
    run_once()
    end = datetime.now(UTC)
    s = start.isoformat().replace("+00:00", "Z")
    e = end.isoformat().replace("+00:00", "Z")
    dur = (end - start).total_seconds()
    print(f"[runner] {s} -> {e} ({dur:.2f}s)")
