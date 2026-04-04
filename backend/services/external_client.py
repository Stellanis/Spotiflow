import threading
import time

import requests


class ExternalAPIClient:
    def __init__(self, provider, base_url=None, timeout=10, retries=3, min_interval=0.0):
        self.provider = provider
        self.base_url = base_url
        self.timeout = timeout
        self.retries = retries
        self.min_interval = min_interval
        self.session = requests.Session()
        self._lock = threading.Lock()
        self._last_request_at = 0.0

    def request_json(self, method, path="", params=None, headers=None, timeout=None):
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        attempt = 0
        while attempt < self.retries:
            attempt += 1
            self._respect_rate_limit()
            try:
                response = self.session.request(
                    method,
                    url,
                    params=params,
                    headers=headers,
                    timeout=timeout or self.timeout,
                )
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt < self.retries:
                        time.sleep(attempt)
                        continue
                response.raise_for_status()
                return response.json()
            except requests.RequestException:
                if attempt >= self.retries:
                    raise
                time.sleep(attempt)
        return None

    def _respect_rate_limit(self):
        if not self.min_interval:
            return
        with self._lock:
            elapsed = time.time() - self._last_request_at
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self._last_request_at = time.time()
