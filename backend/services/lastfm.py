import pylast
import os
import time
from datetime import datetime, timedelta
from collections import Counter

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
            
            curl_cmd = 'curl.exe' if os.name == 'nt' else 'curl'
            cmd = [
                curl_cmd, '-s',
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

    def get_listening_clock_data(self, user: str, period: str = "1month"):
        """
        Aggregates scrobbles by hour of day (0-23).
        """
        start_ts, all_tracks = self._get_recent_tracks_cached(user, period)
        
        # Initialize hours
        hour_counts = {h: 0 for h in range(24)}
        
        for t in all_tracks:
            if "date" in t:
                ts = int(t["date"]["uts"])
                # Convert to local time? 
                # Last.fm returns UTC. For a "Listening Clock", local time is better.
                # But we don't know user timezone. 
                # We'll use server local time for now, or just UTC.
                # Ideally we'd ask user for timezone.
                # Let's assume standard behavior is using datetime.fromtimestamp which uses system local time.
                dt = datetime.fromtimestamp(ts)
                hour_counts[dt.hour] += 1
                
        return [{"hour": h, "count": c} for h, c in hour_counts.items()]

    def get_genre_breakdown(self, user: str, period: str = "1month"):
        """
        Estimates top genres based on Top Artists for the period.
        """
        # 1. Get Top Artists (reuse cache optimization)
        # We need a get_top_artists method, or just use raw request here for now
        # to avoid modifying too much.
        try:
            # Check cache for breakdown itself?
            cache_key = f"genres_{user}_{period}"
            now = time.time()
            if cache_key in self._cache:
                timestamp, data = self._cache[cache_key]
                if now - timestamp < self._cache_ttl:
                    return data

            self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
            if not self.api_key:
                return []

            import requests
            
            # Fetch Top Artists
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "user.gettopartists",
                "user": user,
                "api_key": self.api_key,
                "format": "json",
                "period": period,
                "limit": 20 # Limit to top 20 artists for performance
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            artists = []
            if "topartists" in data and "artist" in data["topartists"]:
                artists = data["topartists"]["artist"]
                if isinstance(artists, dict):
                    artists = [artists]
            
            tag_counts = Counter()
            
            for artist in artists:
                name = artist.get("name")
                playcount = int(artist.get("playcount", 1))
                
                if name:
                    # Get Artist Tags (Cached)
                    tags = self._get_artist_tags(name)
                    # Weighted by playcount? Or just frequency?
                    # Weighted by playcount gives better representation of listening time.
                    # But we must normalize.
                    # Let's just count occurrences in top artists for now? 
                    # No, playcount weighting is "Deep Stats".
                    
                    # Take top 3 tags per artist to avoid noise
                    for tag in tags[:3]: 
                        tag_counts[tag] += playcount
            
            # Convert to list
            result = [{"name": tag, "value": count} for tag, count in tag_counts.most_common(15)]
            
            self._cache[cache_key] = (now, result)
            return result
            
        except Exception as e:
            print(f"Error generating genre breakdown: {e}")
            return []

    def get_artist_listeners(self, artist_name):
        """Fetches and caches global listener count for an artist."""
        cache_key = f"artist_listeners_{artist_name}"
        if cache_key in self._cache:
             # Cache for 7 days
             timestamp, data = self._cache[cache_key]
             if time.time() - timestamp < 604800:
                 return data
                 
        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "artist.getinfo",
                "artist": artist_name,
                "api_key": self.api_key,
                "format": "json"
            }
            
            response = requests.get(url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if "artist" in data:
                    listeners = int(data["artist"].get("stats", {}).get("listeners", 0))
                    self._cache[cache_key] = (time.time(), listeners)
                    return listeners
        except Exception as e:
            print(f"Error fetching listeners for {artist_name}: {e}")
            
        return 0

    def _get_artist_tags(self, artist_name):
        """Helper to fetch and cache artist tags."""
        cache_key = f"artist_tags_{artist_name}"
        if cache_key in self._cache:
            # Longer TTL for artist metadata? 
            # We use the same TTL for simplicity
            return self._cache[cache_key][1]
            
        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "artist.gettoptags",
                "artist": artist_name,
                "api_key": self.api_key,
                "format": "json"
            }
            
            response = requests.get(url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                tags = []
                if "toptags" in data and "tag" in data["toptags"]:
                    raw_tags = data["toptags"]["tag"]
                    if isinstance(raw_tags, dict):
                        raw_tags = [raw_tags]
                    
                    for t in raw_tags:
                        t_name = t.get("name", "").lower()
                        # simple filter
                        if t_name not in ["seen live", "seen", "concerts"]: 
                             tags.append(t_name.title()) # Capitalize
                
                self._cache[cache_key] = (time.time(), tags)
                return tags
        except Exception as e:
            print(f"Error fetching tags for {artist_name}: {e}")
        
        return []

    def get_on_this_day(self, user: str):
        """
        Fetches tracks listened to on this day in previous years (1-5 years ago).
        """
        now = datetime.now()
        years_back = 5
        history = []
        
        self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        if not self.api_key:
            return []

        import requests

        for i in range(1, years_back + 1):
            year = now.year - i
            
            # Start and end of that day in UTC timestamps
            start_date = datetime(year, now.month, now.day, 0, 0, 0)
            end_date = datetime(year, now.month, now.day, 23, 59, 59)
            
            start_ts = int(start_date.timestamp())
            end_ts = int(end_date.timestamp())
            
            # Check cache
            cache_key = f"otd_{user}_{year}_{now.month}_{now.day}"
            
            if cache_key in self._cache:
                history.append(self._cache[cache_key][1])
                continue

            try:
                url = "http://ws.audioscrobbler.com/2.0/"
                params = {
                    "method": "user.getrecenttracks",
                    "user": user,
                    "api_key": self.api_key,
                    "format": "json",
                    "from": start_ts,
                    "to": end_ts,
                    "limit": 5 
                }
                
                response = requests.get(url, params=params, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    tracks = []
                    if "recenttracks" in data and "track" in data["recenttracks"]:
                        raw = data["recenttracks"]["track"]
                        if isinstance(raw, dict): raw = [raw]
                        if isinstance(raw, list):
                             for t in raw:
                                 if "@attr" in t and t["@attr"].get("nowplaying"): continue
                                 tracks.append({
                                     "artist": t.get("artist", {}).get("#text"),
                                     "title": t.get("name"),
                                     "image": t.get("image", [{}])[-1].get("#text"),
                                     "year": year
                                 })

                    entry = {
                        "year": year,
                        "date": start_date.strftime("%Y-%m-%d"),
                        "track_count": int(data.get("recenttracks", {}).get("@attr", {}).get("total", 0)),
                        "top_tracks": tracks[:3] 
                    }
                    
                    history.append(entry)
                    self._cache[cache_key] = (time.time(), entry)
                    
            except Exception as e:
                print(f"Error fetching On This Day for {year}: {e}")
        
        return history

    def get_listening_streak(self, user: str):
        """
        Calculates current listening streak (consecutive days with at least 1 scrobble).
        Checks up to 365 days back.
        """
        cache_key = f"streak_{user}" 
        now_ts = time.time()
        if cache_key in self._cache:
             timestamp, data = self._cache[cache_key]
             if now_ts - timestamp < 3600: 
                 return data

        try:
             # Reuse 3month cache to avoid heavy hitting
             start_ts, all_tracks = self._get_recent_tracks_cached(user, "3month")
             
             if not all_tracks:
                 return {"current_streak": 0}
                 
             active_days = set()
             for t in all_tracks:
                 if "date" in t:
                     ts = int(t["date"]["uts"])
                     date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                     active_days.add(date_str)
            
             streak = 0
             check_date = datetime.now()
             
             today_str = check_date.strftime('%Y-%m-%d')
             if today_str in active_days:
                 streak += 1
             else:
                 pass
                 
             while True:
                 check_date -= timedelta(days=1)
                 date_str = check_date.strftime('%Y-%m-%d')
                 if date_str in active_days:
                     if streak == 0 and date_str != today_str: 
                         streak += 1
                     elif streak > 0:
                         streak += 1
                 else:
                     if streak == 0:
                         pass 
                     break
                     
                 if streak > 100: 
                     break
            
             result = {"current_streak": streak}
             self._cache[cache_key] = (now_ts, result)
             return result

        except Exception as e:
            print(f"Error calculating streak: {e}")
            return {"current_streak": 0}

    def get_top_artists(self, user: str, period: str = "1month", limit: int = 10):
        # Check cache
        cache_key = f"top_artists_{user}_{period}_{limit}"
        now = time.time()
        
        if cache_key in self._cache:
            timestamp, data = self._cache[cache_key]
            if now - timestamp < self._cache_ttl:
                return data

        self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
        if not self.api_key:
            return []

        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "user.gettopartists",
                "user": user,
                "api_key": self.api_key,
                "format": "json",
                "period": period,
                "limit": limit
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            artists = []
            if "topartists" in data and "artist" in data["topartists"]:
                raw_artists = data["topartists"]["artist"]
                if isinstance(raw_artists, dict):
                    raw_artists = [raw_artists]
                
                for a in raw_artists:
                    artists.append({
                        "name": a.get("name"),
                        "playcount": int(a.get("playcount", 0)),
                        "url": a.get("url"),
                        # "image": ... # Last.fm artist images are often missing or generic, but we can try
                    })
            
            self._cache[cache_key] = (now, artists)
            return artists

        except Exception as e:
            print(f"Error fetching top artists: {e}")
            return []

    def get_artist_diversity(self, user: str, period: str = "1month"):
        """
        Calculates a diversity score (0-100) based on Top Artists distribution.
        Uses Gini Coefficient or Entropy.
        High score = very diverse listening (flat distribution).
        Low score = repetitive listening (spiky distribution).
        """
        try:
             # Fetch Top Artists
             # We'll use a direct request here for simplicity as we need raw playcounts
             # and maybe we can cache this specific calculation
             cache_key = f"diversity_{user}_{period}"
             now = time.time()
             if cache_key in self._cache:
                 timestamp, data = self._cache[cache_key]
                 if now - timestamp < self._cache_ttl:
                     return data
             
             self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
             if not self.api_key: return {"score": 0, "label": "Unknown"}

             import requests
             import math

             url = "http://ws.audioscrobbler.com/2.0/"
             params = {
                "method": "user.gettopartists",
                "user": user,
                "api_key": self.api_key,
                "format": "json",
                "period": period,
                "limit": 50 
             }
             
             response = requests.get(url, params=params, timeout=10)
             if response.status_code != 200: return {"score": 0, "label": "Error"}
             
             data = response.json()
             artists = []
             if "topartists" in data and "artist" in data["topartists"]:
                 artists = data["topartists"]["artist"]
                 if isinstance(artists, dict): artists = [artists]
             
             if not artists: return {"score": 0, "label": "No Data"}

             # Calculate Entropy
             # p_i = playcount_i / total_playcount
             # H = -sum(p_i * log2(p_i))
             # Max H for N items is log2(N)
             # Score = (H / Max_H) * 100
             
             playcounts = [int(a.get("playcount", 1)) for a in artists]
             total_plays = sum(playcounts)
             
             if total_plays == 0: return {"score": 0, "label": "No Data"}
             
             entropy = 0
             for count in playcounts:
                 p = count / total_plays
                 if p > 0:
                     entropy -= p * math.log2(p)
             
             # Normalize
             # If we only have 1 artist, entropy is 0. 
             # If we have 50 artists played equally, entropy is log2(50) ~= 5.64
             # We limit N to 50.
             n = len(playcounts)
             max_entropy = math.log2(n) if n > 1 else 1
             
             normalized_score = (entropy / max_entropy) * 100 if max_entropy > 0 else 0
             
             # Labels
             if normalized_score >= 90: label = "Explorer"
             elif normalized_score >= 70: label = "Eclectic"
             elif normalized_score >= 50: label = "Balanced"
             elif normalized_score >= 30: label = "Focused"
             else: label = "Obsessive"
             
             result = {"score": round(normalized_score), "label": label}
             self._cache[cache_key] = (now, result)
             return result

        except Exception as e:
            print(f"Error calculating diversity: {e}")
            return {"score": 0, "label": "Error"}

    def get_mainstream_score(self, user: str, period: str = "1month"):
        """
        Calculates a mainstream score (0-100) based on global listener counts of Top Artists.
        High score = Popular / Mainstream.
        Low score = Underground / Niche.
        """
        try:
             cache_key = f"mainstream_{user}_{period}"
             now = time.time()
             if cache_key in self._cache:
                 timestamp, data = self._cache[cache_key]
                 if now - timestamp < self._cache_ttl:
                     return data
             
             self.api_key = get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY")
             if not self.api_key: return {"score": 0, "label": "Unknown"}

             import requests
             import math

             url = "http://ws.audioscrobbler.com/2.0/"
             params = {
                "method": "user.gettopartists",
                "user": user,
                "api_key": self.api_key,
                "format": "json",
                "period": period,
                "limit": 50 
             }
             
             response = requests.get(url, params=params, timeout=10)
             if response.status_code != 200: return {"score": 0, "label": "Error"}
             
             data = response.json()
             artists = []
             if "topartists" in data and "artist" in data["topartists"]:
                 artists = data["topartists"]["artist"]
                 if isinstance(artists, dict): artists = [artists]
             
             if not artists: return {"score": 0, "label": "No Data"}

             # Need 'listeners' count for each artist.
             # 'user.gettopartists' usually does NOT return global listeners count, only playcount.
             # We might need to fetch info for each artist? detailed fetch is too slow for 50 artists.
             # Wait, does user.getTopArtists return listeners? 
             # Let's check documentation or assumption. 
             # Documentation says it returns Rank, Name, Playcount, MBID, URL, Streamable, Image.
             # It does NOT return global listeners.
             # We can't make 50 API calls here.
             
             # Alternative: 'get_chart_data' style approximation?
             # Or just check top 5 artists? 5 calls is acceptable.
             # Let's check top 10 weighted by playcount.
             
             top_10 = artists[:10]
             total_pop_score = 0
             total_weight = 0
             
             for a in top_10:
                 name = a.get("name")
                 user_playcount = int(a.get("playcount", 1))
                 
                 # Check cache for artist info (listeners)
                 # We can reuse _get_artist_tags helper style caching or get_track_info cache?
                 # Let's make a quick helper or raw request.
                 listeners = self._get_artist_listeners(name)
                 
                 # Log scale for popularity
                 # Max listeners ~5M (The Weeknd/Taylor Swift on Last.fm have high #'s)
                 # Actually The Weeknd has ~3.5M listeners? No, much more newly?
                 # Last.fm listeners usually cap around 6-7M for all time legends.
                 # Let's maximize at 5,000,000 for "100% Mainstream".
                 # If > 5M, it's 100.
                 
                 if listeners > 0:
                     # Log score: log10(listeners)
                     # log10(5,000,000) ~= 6.7
                     # log10(100) = 2 (very niche)
                     # Score = (log10(listeners) / 6.7) * 100
                     
                     log_pop = math.log10(listeners)
                     max_log = 6.7
                     score = (log_pop / max_log) * 100
                     score = max(0, min(100, score))
                 else:
                     score = 0
                     
                 total_pop_score += score * user_playcount
                 total_weight += user_playcount
                 
             final_score = total_pop_score / total_weight if total_weight > 0 else 0
             
             # Labels
             if final_score >= 85: label = "Mainstream"
             elif final_score >= 70: label = "Popular"
             elif final_score >= 50: label = "Trendy"
             elif final_score >= 30: label = "Underground"
             else: label = "Obscure"
             
             result = {"score": round(final_score), "label": label}
             self._cache[cache_key] = (now, result)
             return result

        except Exception as e:
            print(f"Error calculating mainstream score: {e}")
            return {"score": 0, "label": "Error"}

    def _get_artist_listeners(self, artist_name):
        """Helper to fetch artist global listeners with caching."""
        cache_key = f"artist_listeners_{artist_name}"
        if cache_key in self._cache:
            return self._cache[cache_key][1]
            
        try:
            import requests
            url = "http://ws.audioscrobbler.com/2.0/"
            params = {
                "method": "artist.getinfo",
                "artist": artist_name,
                "api_key": self.api_key,
                "format": "json"
            }
            # Retrieve simplified info
            response = requests.get(url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if "artist" in data:
                    listeners = int(data["artist"].get("stats", {}).get("listeners", 0))
                    self._cache[cache_key] = (time.time(), listeners)
                    return listeners
        except Exception as e:
            print(f"Error fetching listeners for {artist_name}: {e}")
        
        return 0
