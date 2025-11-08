from datetime import datetime
from .price_fetcher import read_mapping_ids, fetch_markets, store_prices, derive_and_store_btc_prices
from .indicators import fetch_btcd, fetch_dxy_fred, fetch_fear_greed, store_indicator
from .rules import run_rules


def run_once() -> None:
    # Prices
    ids = read_mapping_ids()
    rows_usd = fetch_markets(ids, "usd")
    rows_gbp = fetch_markets(ids, "gbp")
    btc_usd, _ = store_prices(rows_usd, rows_gbp)
    derive_and_store_btc_prices(rows_usd, btc_usd)

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


if __name__ == "__main__":
    print(f"[runner] starting cycle at {datetime.utcnow().isoformat()}Z")
    run_once()
    print(f"[runner] finished at {datetime.utcnow().isoformat()}Z")
