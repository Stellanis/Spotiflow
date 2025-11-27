import pylast
import os
import time

from database import get_setting

class LastFMService:
    def __init__(self):
        self.api_key = None
        self.api_secret = None
        self.network = None
        self._cache = {}
        self._cache_ttl = 120  # 2 minutes

    def get_recent_tracks(self, user: str, limit: int = 10):
        # Check cache
        cache_key = f"{user}_{limit}"
        now = time.time()
        
        if cache_key in self._cache:
            timestamp, data = self._cache[cache_key]
            if now - timestamp < self._cache_ttl:
                return data

        # Refresh credentials from DB in case they changed
        self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        self.api_secret = get_setting("LASTFM_API_SECRET") or os.getenv("LASTFM_API_SECRET")
        
        if self.api_key:
            self.network = pylast.LastFMNetwork(api_key=self.api_key, api_secret=self.api_secret)
            
        if not self.network:
            print("Last.fm credentials not configured")
            return []
        
        try:
            user_obj = self.network.get_user(user)
            recent_tracks = user_obj.get_recent_tracks(limit=limit)
            
            tracks = []
            for track in recent_tracks:
                image_url = None
                try:
                    image_url = track.track.get_cover_image()
                except Exception:
                    pass

                tracks.append({
                    "artist": track.track.artist.name,
                    "title": track.track.title,
                    "album": track.album,
                    "image": image_url,
                    "timestamp": track.timestamp
                })
            
            # Update cache
            self._cache[cache_key] = (now, tracks)
            return tracks
            
        except Exception as e:
            print(f"Error fetching from Last.fm: {e}")
            # If we have stale data, return it instead of crashing
            if cache_key in self._cache:
                return self._cache[cache_key][1]
            raise e
