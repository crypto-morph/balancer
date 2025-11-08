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

    def markets(self, ids: List[str], vs_currency: str) -> List[Dict[str, Any]]:
        if not ids:
            return []
        url = urljoin(self.base, "coins/markets")
        headers = None
        params = {
            "ids": ",".join(ids),
            "vs_currency": vs_currency.lower(),
        }
        if COINGECKO_API_KEY:
            params["x_cg_demo_api_key"] = COINGECKO_API_KEY
        attempts = 0
        while True:
            try:
                resp = self.http.get(url, params=params, headers=headers)
                return resp.json() or []
            except HTTPError as e:
                status = getattr(e.response, "status_code", None)
                if status == 429 and attempts < 3:
                    attempts += 1
                    time.sleep(1.5 * attempts)
                    continue
                raise

    def global_metrics(self) -> Dict[str, Any]:
        url = urljoin(self.base, "global")
        resp = self.http.get(url)
        return resp.json() or {}


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
