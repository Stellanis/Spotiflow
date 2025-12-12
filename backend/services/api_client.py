import os
import requests
import time
from database import get_setting

class LastFMApiClient:
    def __init__(self):
        self.base_url = "http://ws.audioscrobbler.com/2.0/"
        self._api_key = None

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
            for attempt in range(3):
                try:
                    response = requests.get(self.base_url, params=request_params, timeout=timeout)
                    if response.status_code >= 500:
                        # Server error, retry
                        print(f"Server error {response.status_code} for {method}, retrying ({attempt+1}/3)...")
                        time.sleep(1 * (attempt + 1))
                        continue
                        
                    response.raise_for_status()
                    return response.json()
                except requests.exceptions.RequestException as e:
                    if attempt == 2:
                        raise e
                    print(f"Request error {e}, retrying ({attempt+1}/3)...")
                    time.sleep(1 * (attempt + 1))
            return None
        except requests.exceptions.RequestException as e:
            print(f"Error requesting {method}: {e}")
            return None
