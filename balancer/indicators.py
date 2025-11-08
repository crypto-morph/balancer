from datetime import datetime
from .db import SessionLocal
from .models import Indicator
from .clients import CoingeckoClient, FredClient, FearGreedClient
from .config import FRED_API_KEY


def fetch_btcd() -> float:
    data = CoingeckoClient().global_metrics()
    perc = ((data.get("data") or {}).get("market_cap_percentage") or {}).get("btc")
    return float(perc) if isinstance(perc, (int, float)) else 0.0


def fetch_dxy_fred(api_key: str | None = None) -> float:
    api_key = api_key or FRED_API_KEY
    if not api_key:
        # No key configured; skip fetching DXY and return 0.0
        return 0.0
    data = FredClient(api_key=api_key).series_observations("DTWEXBGS")
    observations = data.get("observations") or []
    if not observations:
        return 0.0
    val = observations[-1].get("value")
    try:
        return float(val)
    except Exception:
        return 0.0


def fetch_fear_greed() -> float:
    data = FearGreedClient().latest()
    arr = data.get("data") or []
    if not arr:
        return 0.0
    val = arr[0].get("value")
    try:
        return float(val)
    except Exception:
        return 0.0


def store_indicator(name: str, value: float) -> None:
    if not value and value != 0.0:
        return
    with SessionLocal() as db:
        db.add(Indicator(name=name, value=float(value), at=datetime.utcnow()))
        db.commit()
