import os
from typing import Any, Dict
from balancer.clients import CoingeckoClient

class FakeResp:
    def __init__(self, payload: Any):
        self._payload = payload
    def json(self):
        return self._payload

class FakeHttp:
    def __init__(self):
        self.last: Dict[str, Any] | None = None
    def get(self, url: str, params: Dict[str, Any] | None = None, headers: Dict[str, str] | None = None):
        self.last = {"url": url, "params": dict(params or {}), "headers": dict(headers or {})}
        return FakeResp([])

def test_coingecko_markets_includes_params(monkeypatch):
    fake_http = FakeHttp()
    # Do not rely on specific env value; just ensure the param is set when key exists
    c = CoingeckoClient(http=fake_http)
    ids = ["bitcoin", "ethereum"]
    out = c.markets(ids, "GBP")
    assert out == []
    assert fake_http.last is not None
    params = fake_http.last["params"]
    assert params.get("ids") == ",".join(ids)
    assert params.get("vs_currency") == "gbp"
    if os.getenv("COINGECKO_API_KEY"):
        assert "x_cg_demo_api_key" in params
