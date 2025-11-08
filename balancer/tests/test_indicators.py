from balancer.indicators import fetch_dxy_fred, fetch_fear_greed, fetch_btcd


def test_fetch_dxy_without_key_returns_zero(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    class FakeFred:
        def __init__(self, api_key=None):
            pass
        def series_observations(self, series_id: str):
            return {"observations": []}
    monkeypatch.setattr("balancer.indicators.FredClient", lambda api_key=None: FakeFred(api_key))
    assert fetch_dxy_fred(api_key=None) == 0.0


def test_fetch_btcd_handles_empty(monkeypatch):
    class FakeClient:
        def global_metrics(self):
            return {}
    monkeypatch.setattr("balancer.indicators.CoingeckoClient", lambda: FakeClient())
    assert isinstance(fetch_btcd(), float)


def test_fetch_fear_greed_handles_empty(monkeypatch):
    class FakeFG:
        def latest(self):
            return {"data": []}
    monkeypatch.setattr("balancer.indicators.FearGreedClient", lambda: FakeFG())
    assert fetch_fear_greed() == 0.0
