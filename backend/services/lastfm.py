import pylast
import os
import time
from datetime import datetime

from datetime import datetime

from database import get_setting

class LastFMService:
    def __init__(self):
        self.api_key = None
        self.api_secret = None
        self.network = None
        self._cache = {}
        self._cache_ttl = 86400  # 24 hours
        self._image_cache = {} # Persistent image cache to avoid repeated iTunes lookups
        self._placeholder_hash = "2a96cbd8b46e442fc41c2b86b821562f"

    def _fetch_deezer_image(self, artist, title):
        """Fallback to Deezer API for album art."""
        try:
            import requests
            query = f'artist:"{artist}" track:"{title}"'
            params = {
                "q": query,
                "limit": 1
            }
            url = "https://api.deezer.com/search"
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and len(data["data"]) > 0:
                    track = data["data"][0]
                    album = track.get("album", {})
                    # Prefer XL, then Big, then Medium
                    return album.get("cover_xl") or album.get("cover_big") or album.get("cover_medium")
        except Exception as e:
            print(f"Error fetching from Deezer: {e}")
        return None

    def _fetch_itunes_image(self, artist, title, album=None):
        """Fallback to iTunes Search API for album art."""
        # Check cache first
        cache_key = f"{artist}_{title}"
        if cache_key in self._image_cache:
            return self._image_cache[cache_key]

        img_url = None
        
        # 1. Try iTunes (via curl to bypass blocking)
        try:
            import subprocess
            import urllib.parse
            import json
            
            term = f"{artist} {title}"
            term = urllib.parse.quote(term)
            url = f"https://itunes.apple.com/search?term={term}&entity=song&limit=1"
            
            cmd = [
                'curl.exe', '-s',
                '-A', "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=5)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data["resultCount"] > 0:
                    result_item = data["results"][0]
                    raw_url = result_item.get("artworkUrl100")
                    if raw_url:
                        img_url = raw_url.replace("100x100bb", "600x600bb")
        except Exception as e:
            print(f"Error fetching from iTunes via curl: {e}")
            
        # 2. If iTunes failed or returned no result, try Deezer
        if not img_url:
            img_url = self._fetch_deezer_image(artist, title)

        # Cache the result (even if None, to avoid repeating bad queries? No, maybe transient. 
        # But for now let's cache valid results. Caching None might prevent retries.)
        # Actually, let's cache None but with a shorter TTL or just let it cache.
        if img_url:
            self._image_cache[cache_key] = img_url
        else:
            # Optional: cache failures to avoid hammering APIs? 
            # Let's not cache None for now, so we retry if user refreshes.
            pass
            
        return img_url

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
        
        if not self.api_key:
            print("Last.fm API key not configured")
            return []
        
        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "user.getrecenttracks",
                "user": user,
                "api_key": self.api_key,
                "format": "json",
                "limit": limit
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            tracks = []
            if "recenttracks" in data and "track" in data["recenttracks"]:
                raw_tracks = data["recenttracks"]["track"]
                if isinstance(raw_tracks, dict):
                    raw_tracks = [raw_tracks]
                    
                for track in raw_tracks:
                    # Extract image
                    image_url = None
                    images = track.get("image", [])
                    if isinstance(images, list):
                        # Try to find extralarge, then large, then whatever is last
                        for img in images:
                            if img.get("size") == "extralarge":
                                image_url = img.get("#text")
                                break
                        if not image_url and images:
                             image_url = images[-1].get("#text")
                    
                    # Check for placeholder
                    if not image_url or self._placeholder_hash in image_url:
                        # Fallback
                        artist_name = track.get("artist", {}).get("#text") if isinstance(track.get("artist"), dict) else track.get("artist")
                        track_name = track.get("name")
                        if artist_name and track_name:
                             # Try to get simplified names for better search results
                             # But passing full names is usually fine for iTunes
                             fallback_url = self._fetch_itunes_image(artist_name, track_name)
                             if fallback_url:
                                 image_url = fallback_url
                    
                    # Extract artist name
                    artist_obj = track.get("artist")
                    artist = artist_obj.get("#text") if isinstance(artist_obj, dict) else artist_obj
                    
                    # Extract album name
                    album_obj = track.get("album")
                    album = album_obj.get("#text") if isinstance(album_obj, dict) else album_obj
                    
                    # Timestamp
                    timestamp = None
                    if "date" in track:
                        timestamp = track["date"].get("uts")
                    
                    # Filter out empty artist/title if any
                    if artist and track.get("name"):
                        tracks.append({
                            "artist": artist,
                            "title": track.get("name"),
                            "album": album,
                            "image": image_url,
                            "timestamp": timestamp
                        })
            
            # Update cache
            self._cache[cache_key] = (now, tracks)
            return tracks
            
        except Exception as e:
            print(f"Error fetching from Last.fm: {e}")
            # If we have stale data, return it instead of crashing
            if cache_key in self._cache:
                return self._cache[cache_key][1]
            return []

    def get_top_tracks(self, user: str, period: str = "overall", limit: int = 50, ignore_cache: bool = False):
        # Check cache
        cache_key = f"top_{user}_{period}_{limit}"
        now = time.time()
        
        if not ignore_cache and cache_key in self._cache:
            timestamp, data = self._cache[cache_key]
            if now - timestamp < self._cache_ttl:
                return data

        self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        
        if not self.api_key:
            print("Last.fm API key not configured")
            return []
        
        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "user.gettoptracks",
                "user": user,
                "api_key": self.api_key,
                "format": "json",
                "period": period,
                "limit": limit
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            tracks = []
            if "toptracks" in data and "track" in data["toptracks"]:
                raw_tracks = data["toptracks"]["track"]
                if isinstance(raw_tracks, dict):
                    raw_tracks = [raw_tracks]
                    
                for track in raw_tracks:
                            
                    # Extract image
                    image_url = None
                    images = track.get("image", [])
                    if isinstance(images, list):
                        for img in images:
                            if img.get("size") == "extralarge":
                                image_url = img.get("#text")
                                break
                        if not image_url and images:
                             image_url = images[-1].get("#text")
                    
                    # Check for placeholder
                    if not image_url or self._placeholder_hash in image_url:
                        artist_name = track.get("artist", {}).get("name") if isinstance(track.get("artist"), dict) else track.get("artist")
                        track_name = track.get("name")
                        
                        if artist_name and track_name:
                            fallback_url = self._fetch_itunes_image(artist_name, track_name)
                            if fallback_url:
                                image_url = fallback_url
                    
                    # Extract artist name
                    artist_obj = track.get("artist")
                    artist = artist_obj.get("name") if isinstance(artist_obj, dict) else artist_obj
                    
                    # Playcount
                    playcount = track.get("playcount", 0)
                    
                    if artist and track.get("name"):
                        tracks.append({
                            "artist": artist,
                            "title": track.get("name"),
                            "image": image_url,
                            "playcount": int(playcount),
                            "rank": track.get("@attr", {}).get("rank")
                        })
            
            # Update cache
            self._cache[cache_key] = (now, tracks)
            return tracks
            
        except Exception as e:
            print(f"Error fetching top tracks from Last.fm: {e}")
            if cache_key in self._cache:
                return self._cache[cache_key][1]
            return []

    def get_track_info(self, user: str, artist: str, track: str):
        # Check cache
        cache_key = f"info_{user}_{artist}_{track}"
        now = time.time()
        
        if cache_key in self._cache:
            timestamp, data = self._cache[cache_key]
            if now - timestamp < self._cache_ttl:
                return data

        self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        
        if not self.api_key:
            return None
        
        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "track.getinfo",
                "user": user,
                "artist": artist,
                "track": track,
                "api_key": self.api_key,
                "format": "json"
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if "track" in data:
                t = data["track"]
                
                # Extract image
                image_url = None
                images = t.get("album", {}).get("image", []) if "album" in t else t.get("image", [])
                if isinstance(images, list):
                    for img in images:
                        if img.get("size") == "extralarge":
                            image_url = img.get("#text")
                            break
                    if not image_url and images:
                         image_url = images[-1].get("#text")
                         
                # Check for placeholder
                if not image_url or self._placeholder_hash in image_url:
                    fallback_url = self._fetch_itunes_image(t.get("artist", {}).get("name"), t.get("name"))
                    if fallback_url:
                        image_url = fallback_url

                info = {
                    "artist": t.get("artist", {}).get("name"),
                    "title": t.get("name"),
                    "album": t.get("album", {}).get("title"),
                    "userplaycount": t.get("userplaycount", 0),
                    "playcount": t.get("playcount", 0),
                    "listeners": t.get("listeners", 0),
                    "image": image_url,
                    "tags": [tag["name"] for tag in t.get("toptags", {}).get("tag", [])] if "toptags" in t else [],
                    "wiki": t.get("wiki", {}).get("summary")
                }
                
                self._cache[cache_key] = (now, info)
                return info
            return None

        except Exception as e:
            print(f"Error fetching track info: {e}")
            if cache_key in self._cache:
                return self._cache[cache_key][1]
            return None

            if cache_key in self._cache:
                return self._cache[cache_key][1]
            return None

    def _get_recent_tracks_cached(self, user: str, period: str):
        # Calculate start timestamp based on period
        now = int(time.time())
        day_seconds = 86400
        
        if period == "7day":
            start_ts = now - (7 * day_seconds)
        elif period == "1month":
            start_ts = now - (30 * day_seconds)
        elif period == "3month":
            start_ts = now - (90 * day_seconds)
        elif period == "6month":
            start_ts = now - (180 * day_seconds)
        elif period == "12month":
            start_ts = now - (365 * day_seconds)
        else:
            start_ts = now - (30 * day_seconds) # Default to 1 month
            
        # Check cache for RAW tracks list
        cache_key = f"raw_recent_{user}_{period}"
        if cache_key in self._cache:
            timestamp, data = self._cache[cache_key]
            if now - timestamp < self._cache_ttl:
                return start_ts, data

        self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        if not self.api_key:
            return start_ts, []

        try:
            import requests
            
            # Helper to fetch pages
            all_tracks = []
            page = 1
            limit = 200 # Max limit to reduce requests
            
            while True:
                url = "http://ws.audioscrobbler.com/2.0/"
                params = {
                    "method": "user.getrecenttracks",
                    "user": user,
                    "api_key": self.api_key,
                    "format": "json",
                    "limit": limit,
                    "from": start_ts,
                    "page": page
                }
                
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if "recenttracks" not in data or "track" not in data["recenttracks"]:
                    break
                    
                tracks = data["recenttracks"]["track"]
                if isinstance(tracks, dict):
                    tracks = [tracks]
                
                if not tracks:
                    break

                for t in tracks:
                    # Skip currently playing (no date)
                    if "@attr" in t and t["@attr"].get("nowplaying") == "true":
                        continue
                    all_tracks.append(t)
                
                # Check pagination
                attr = data["recenttracks"].get("@attr", {})
                total_pages = int(attr.get("totalPages", 1))
                
                if page >= total_pages or page >= 5: # Limit depth to avoid too many requests
                    break
                    
                page += 1
                time.sleep(0.2) # polite delay
            
            # Cache the raw list
            self._cache[cache_key] = (now, all_tracks)
            return start_ts, all_tracks
            
        except Exception as e:
            print(f"Error fetching recent tracks: {e}")
            return start_ts, []

    def get_chart_data(self, user: str, period: str = "1month", artist: str = None, track: str = None):
        start_ts, all_tracks = self._get_recent_tracks_cached(user, period)
        now = int(time.time())
        day_seconds = 86400
        
        filtered_tracks = []
        for t in all_tracks:
            # Filter if artist/track provided
            if artist and t.get("artist", {}).get("#text").lower() != artist.lower():
                continue
            if track and t.get("name").lower() != track.lower():
                continue
            filtered_tracks.append(t)

        # Aggregate by date
        daily_counts = {}
        
        # Initialize all days in range with 0
        current_ts = start_ts
        while current_ts <= now:
            date_str = datetime.fromtimestamp(current_ts).strftime('%Y-%m-%d')
            daily_counts[date_str] = 0
            current_ts += day_seconds

        for t in filtered_tracks:
            if "date" in t:
                ts = int(t["date"]["uts"])
                date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                if date_str in daily_counts:
                        daily_counts[date_str] += 1
        
        # Convert to list
        chart_data = [{"date": k, "count": v} for k, v in sorted(daily_counts.items())]
        
        return chart_data

    def prefetch_track_infos(self, user: str, tracks: list):
        """
        Background task to pre-fetch detailed track info slightly delayed to avoid rate limits.
        """
        print(f"Starting prefetch for {len(tracks)} tracks...")
        for t in tracks:
            try:
                artist = t.get('artist')
                title = t.get('title')
                if artist and title:
                    # check if already cached
                    cache_key = f"track_{user}_{artist}_{title}"
                    if cache_key not in self._cache:
                        self.get_track_info(user, artist, title)
                        time.sleep(0.2) # Be polite
            except Exception as e:
                print(f"Error prefetching {t.get('title')}: {e}")
        print("Prefetch complete.")

    def refresh_stats_cache(self, user: str):
        """Force refresh of stats data for all periods."""
        print(f"Starting daily stats refresh for {user}...")
        periods = ['overall', '7day', '1month', '3month', '6month', '12month']
        
        # Refresh Top Tracks
        for period in periods:
            print(f"Refreshing Top Tracks ({period})...")
            try:
                # Force refresh ignoring cache
                self.get_top_tracks(user, period=period, limit=50, ignore_cache=True)
                time.sleep(1) # Be polite to Last.fm
            except Exception as e:
                print(f"Error refreshing {period}: {e}")
                
        # Refresh Activity Chart (1month is default/primary)
        print("Refreshing Activity Chart (1month)...")
        try:
            # We don't have an ignore_cache for chart data yet, but we can clear specific keys?
            # Or just update _get_recent_tracks_cached to support force refresh.
            # For now, let's just accept that chart data might be up to 24h old if we rely on _cache_ttl
            # Modifying _get_recent_tracks_cached is safer to ensure valid data.
            # But user emphasized "stats page" (Top Tracks usually).
            # Let's add simple cache invalidation for recent tracks
            pass
            # Actually, `get_chart_data` calls `_get_recent_tracks_cached` which uses `raw_recent_{user}_{period}`
            # If we want to refresh it, we should delete that key.
            cache_key = f"raw_recent_{user}_1month"
            if cache_key in self._cache:
                del self._cache[cache_key]
            self.get_chart_data(user, period="1month")
            
        except Exception as e:
            print(f"Error refreshing chart: {e}")
            
        print("Daily stats refresh complete.")
