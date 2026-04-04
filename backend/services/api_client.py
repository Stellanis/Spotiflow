import os
from database import get_setting
from .external_client import ExternalAPIClient

class LastFMApiClient:
    def __init__(self):
        self.base_url = "http://ws.audioscrobbler.com/2.0/"
        self._api_key = None
        self.client = ExternalAPIClient("lastfm", base_url=self.base_url, timeout=10, retries=3, min_interval=0.25)

    @property
    def api_key(self):
        if not self._api_key:
            self._api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        return self._api_key

    def request(self, method, params, timeout=10):
        """Make a request to Last.fm API."""
        if not self.api_key:
            print("Last.fm API key not configured")
            return None

        # Ensure defaults
        request_params = {
            "method": method,
            "api_key": self.api_key,
            "format": "json"
        }
        request_params.update(params)

        try:
            return self.client.request_json("GET", "", params=request_params, timeout=timeout)
        except Exception as e:
            print(f"Error requesting {method}: {e}")
            return None
