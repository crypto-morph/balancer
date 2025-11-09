from typing import List, Dict, Any
from urllib.parse import urljoin
from .http_client import HttpClient
from .config import (
    COINGECKO_BASE_URL,
    FRED_BASE_URL,
    FNG_BASE_URL,
    COINGECKO_API_KEY,
)
import time
from requests import HTTPError


class CoingeckoClient:
    def __init__(self, http: HttpClient | None = None):
        self.http = http or HttpClient()
        self.base = COINGECKO_BASE_URL.rstrip("/") + "/"
        self.fallback_base = "https://www.coingecko.com/api/v3/"

    def markets(self, ids: List[str], vs_currency: str) -> List[Dict[str, Any]]:
        if not ids:
            return []
        url = urljoin(self.base, "coins/markets")
        headers = None
        params = {
            "ids": ",".join(ids),
            "vs_currency": vs_currency.lower(),
        }
        add_key = bool(COINGECKO_API_KEY)
        if add_key:
            params["x_cg_demo_api_key"] = COINGECKO_API_KEY
        attempts = 0
        tried_no_key = False
        used_fallback = False
        while True:
            try:
                resp = self.http.get(url, params=params, headers=headers)
                return resp.json() or []
            except HTTPError as e:
                status = getattr(e.response, "status_code", None)
                if status == 401 and add_key and not tried_no_key:
                    # Retry once without API key if provided key is invalid
                    params.pop("x_cg_demo_api_key", None)
                    tried_no_key = True
                    continue
                if status == 401 and not used_fallback:
                    # Retry once via fallback base URL without API key
                    params.pop("x_cg_demo_api_key", None)
                    url = urljoin(self.fallback_base, "coins/markets")
                    used_fallback = True
                    continue
                if status == 429 and attempts < 3:
                    attempts += 1
                    time.sleep(1.5 * attempts)
                    continue
                raise

    def global_metrics(self) -> Dict[str, Any]:
        url = urljoin(self.base, "global")
        resp = self.http.get(url)
        return resp.json() or {}

    def market_chart(self, cg_id: str, vs_currency: str, days: str = "max") -> Dict[str, Any]:
        """Fetch historical market chart for a coin.
        Returns dict with lists: prices, market_caps, total_volumes where each is [[ms, value], ...]
        """
        url = urljoin(self.base, f"coins/{cg_id}/market_chart")
        params: Dict[str, Any] = {"vs_currency": vs_currency.lower(), "days": days}
        add_key = bool(COINGECKO_API_KEY)
        if add_key:
            params["x_cg_demo_api_key"] = COINGECKO_API_KEY
        attempts = 0
        tried_no_key = False
        used_fallback = False
        while True:
            try:
                resp = self.http.get(url, params=params)
                return resp.json() or {"prices": []}
            except HTTPError as e:
                status = getattr(e.response, "status_code", None)
                if status == 401 and add_key and not tried_no_key:
                    params.pop("x_cg_demo_api_key", None)
                    tried_no_key = True
                    continue
                if status == 401 and not used_fallback:
                    params.pop("x_cg_demo_api_key", None)
                    url = urljoin(self.fallback_base, f"coins/{cg_id}/market_chart")
                    used_fallback = True
                    continue
                if status == 429 and attempts < 3:
                    attempts += 1
                    time.sleep(1.5 * attempts)
                    continue
                raise


class FredClient:
    def __init__(self, api_key: str, http: HttpClient | None = None):
        self.http = http or HttpClient()
        self.base = FRED_BASE_URL.rstrip("/") + "/"
        self.api_key = api_key

    def series_observations(self, series_id: str) -> Dict[str, Any]:
        url = urljoin(self.base, "series/observations")
        params = {"series_id": series_id, "api_key": self.api_key, "file_type": "json"}
        resp = self.http.get(url, params=params)
        return resp.json() or {}


class FearGreedClient:
    def __init__(self, http: HttpClient | None = None):
        self.http = http or HttpClient()
        self.base = FNG_BASE_URL.rstrip("/") + "/"

    def latest(self) -> Dict[str, Any]:
        url = urljoin(self.base, "fng/")
        resp = self.http.get(url)
        return resp.json() or {}
