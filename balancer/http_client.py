from typing import Any, Dict, Optional
import time
import requests
from .config import HTTP_TIMEOUT, HTTP_RETRIES

class HttpClient:
    def __init__(self, timeout: float | None = None, retries: int | None = None):
        self.timeout = timeout if timeout is not None else HTTP_TIMEOUT
        self.retries = retries if retries is not None else HTTP_RETRIES
        self.session = requests.Session()

    def get(self, url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> requests.Response:
        last_exc: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                resp = self.session.get(url, params=params, headers=headers, timeout=self.timeout)
                resp.raise_for_status()
                return resp
            except Exception as e:
                last_exc = e
                if attempt < self.retries:
                    time.sleep(1.0 * (attempt + 1))
                else:
                    raise
        # Should not reach here
        if last_exc:
            raise last_exc
        raise RuntimeError("HTTP GET failed with unknown error")
