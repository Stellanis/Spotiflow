import time
from datetime import datetime, timedelta
from collections import Counter
import os

from .cache_manager import CacheManager
from .api_client import LastFMApiClient
from .image_provider import ImageProvider

class LastFMService:
    def __init__(self):
        self.cache = CacheManager(ttl=86400)
        self.client = LastFMApiClient()
        self.image_provider = ImageProvider()

    def get_recent_tracks(self, user: str, limit: int = 10, ignore_cache: bool = False):
        # Namespace the key to avoid collisions and allow group invalidation
        cache_key = f"recent_{user}_{limit}"
        
        if ignore_cache:
            # Invalidate all recent tracks caches for this user (any limit)
            self.cache.clear_with_prefix(f"recent_{user}_")
        else:
            cached = self.cache.get(cache_key)
            if cached:
                return cached

        params = {
            "method": "user.getrecenttracks",
            "user": user,
            "limit": limit
        }
        
        data = self.client.request("GET", params)
        if not data:
            return []

        tracks = []
        if "recenttracks" in data and "track" in data["recenttracks"]:
            raw_tracks = data["recenttracks"]["track"]
            if isinstance(raw_tracks, dict):
                raw_tracks = [raw_tracks]
                
            for track in raw_tracks:
                # Extract image using provider
                lastfm_images = track.get("image", [])
                artist_name = track.get("artist", {}).get("#text") if isinstance(track.get("artist"), dict) else track.get("artist")
                track_name = track.get("name")
                
                image_url = self.image_provider.get_image(lastfm_images, artist_name, track_name)
                
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
                
                if artist and track_name:
                    tracks.append({
                        "artist": artist,
                        "title": track_name,
                        "album": album,
                        "image": image_url,
                        "timestamp": timestamp
                    })
        
        self.cache.set(cache_key, tracks)
        return tracks

    def get_top_tracks(self, user: str, period: str = "overall", limit: int = 50, ignore_cache: bool = False):
        cache_key = f"top_{user}_{period}_{limit}"
        
        if not ignore_cache:
            cached = self.cache.get(cache_key)
            if cached:
                return cached

        params = {
            "method": "user.gettoptracks",
            "user": user,
            "period": period,
            "limit": limit
        }

        data = self.client.request("GET", params)
        if not data:
            return []

        tracks = []
        if "toptracks" in data and "track" in data["toptracks"]:
            raw_tracks = data["toptracks"]["track"]
            if isinstance(raw_tracks, dict):
                raw_tracks = [raw_tracks]
                
            for track in raw_tracks:
                lastfm_images = track.get("image", [])
                artist_name = track.get("artist", {}).get("name") if isinstance(track.get("artist"), dict) else track.get("artist")
                track_name = track.get("name")
                
                image_url = self.image_provider.get_image(lastfm_images, artist_name, track_name)
                
                artist_obj = track.get("artist")
                artist = artist_obj.get("name") if isinstance(artist_obj, dict) else artist_obj
                playcount = track.get("playcount", 0)
                
                if artist and track_name:
                    tracks.append({
                        "artist": artist,
                        "title": track_name,
                        "image": image_url,
                        "playcount": int(playcount),
                        "rank": track.get("@attr", {}).get("rank")
                    })
        
        self.cache.set(cache_key, tracks)
        return tracks

    def get_track_info(self, user: str, artist: str, track: str):
        cache_key = f"info_{user}_{artist}_{track}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "track.getinfo",
            "user": user,
            "artist": artist,
            "track": track
        }

        data = self.client.request("GET", params)
        if not data or "track" not in data:
            return None

        t = data["track"]
        lastfm_images = t.get("album", {}).get("image", []) if "album" in t else t.get("image", [])
        image_url = self.image_provider.get_image(lastfm_images, t.get("artist", {}).get("name"), t.get("name"))

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
        
        self.cache.set(cache_key, info)
        return info

    def get_cached_recent_tracks(self, user: str, period: str):
        now = int(time.time())
        day_seconds = 86400
        
        # Period start calculation
        period_map = {
            "7day": 7, "1month": 30, "3month": 90, 
            "6month": 180, "12month": 365
        }
        days = period_map.get(period, 30)
        start_ts = now - (days * day_seconds)
            
        cache_key = f"raw_recent_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return start_ts, cached

        # Fetch all pages
        all_tracks = []
        page = 1
        limit = 200
        
        while True:
            params = {
                "method": "user.getrecenttracks",
                "user": user,
                "limit": limit,
                "from": start_ts,
                "page": page
            }
            
            data = self.client.request("GET", params)
            if not data or "recenttracks" not in data or "track" not in data["recenttracks"]:
                break
                
            tracks = data["recenttracks"]["track"]
            if isinstance(tracks, dict):
                tracks = [tracks]
            
            if not tracks:
                break

            for t in tracks:
                if "@attr" in t and t["@attr"].get("nowplaying") == "true":
                    continue
                all_tracks.append(t)
            
            attr = data["recenttracks"].get("@attr", {})
            total_pages = int(attr.get("totalPages", 1))
            
            # Safety break at 200 pages (approx 40k tracks)
            if page >= total_pages or page >= 200:
                break
                
            page += 1
            time.sleep(0.2)
        
        self.cache.set(cache_key, all_tracks)
        return start_ts, all_tracks

    def prefetch_track_infos(self, user: str, tracks: list):
        import concurrent.futures
        
        print(f"Starting prefetch for {len(tracks)} tracks...")
        
        def fetch_one(t):
            try:
                artist = t.get('artist')
                title = t.get('title')
                if artist and title:
                    self.get_track_info(user, artist, title)
            except Exception as e:
                print(f"Error prefetching {t}: {e}")

        # Use a thread pool to fetch in parallel
        # Max workers limited to 4 to be polite to Last.fm API
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            executor.map(fetch_one, tracks)
            
        print("Prefetch complete.")
    
    def refresh_stats_cache(self, user: str):
        # This calls get_chart_data which is no longer here.
        # Ideally this method should move to AnalyticsService or call it.
        # But this method refreshes Top Tracks too.
        # Let's keep it here but remove the chart data refresh part if it depends on analytics.
        # Or better: Move this entire "Refresh" logic to a coordination service or just the tasks.
        # I'll update it to only refresh tracks here.
        
        print(f"Starting daily stats refresh for {user}...")
        periods = ['overall', '7day', '1month', '3month', '6month', '12month']
        
        for period in periods:
            print(f"Refreshing Top Tracks ({period})...")
            try:
                self.get_top_tracks(user, period=period, limit=50, ignore_cache=True)
                time.sleep(1)
            except Exception as e:
                print(f"Error refreshing {period}: {e}")
                
        # Chart refresh is now job of AnalyticsService
        print("Daily stats refresh complete.")

    def get_artist_listeners(self, artist_name):
        cache_key = f"artist_listeners_{artist_name}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "artist.getinfo",
            "artist": artist_name
        }
        
        data = self.client.request("GET", params)
        if data and "artist" in data:
            listeners = int(data["artist"].get("stats", {}).get("listeners", 0))
            self.cache.set(cache_key, listeners) 
            return listeners
        
        return 0

    def get_artist_tags(self, artist_name):
        cache_key = f"artist_tags_{artist_name}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
            
        params = {
            "method": "artist.gettoptags",
            "artist": artist_name
        }
        
        data = self.client.request("GET", params)
        tags = []
        if data and "toptags" in data and "tag" in data["toptags"]:
            raw_tags = data["toptags"]["tag"]
            if isinstance(raw_tags, dict):
                raw_tags = [raw_tags]
            
            for t in raw_tags:
                t_name = t.get("name", "").lower()
                if t_name not in ["seen live", "seen", "concerts", "fip"]: 
                        tags.append(t_name.title())
        
        self.cache.set(cache_key, tags)
        return tags

    def get_artist_image(self, artist_name):
        cache_key = f"artist_image_{artist_name}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "artist.getinfo",
            "artist": artist_name
        }
        
        data = self.client.request("GET", params)
        image_url = None
        
        if data and "artist" in data:
            a = data["artist"]
            lastfm_images = a.get("image", [])
            # Use image provider to get best image
            image_url = self.image_provider.get_image(lastfm_images, artist_name, None)
            
        self.cache.set(cache_key, image_url)
        return image_url

    def get_on_this_day(self, user: str):
        now = datetime.now()
        years_back = 5
        history = []
        
        for i in range(1, years_back + 1):
            year = now.year - i
            start_date = datetime(year, now.month, now.day, 0, 0, 0)
            end_date = datetime(year, now.month, now.day, 23, 59, 59)
            start_ts = int(start_date.timestamp())
            end_ts = int(end_date.timestamp())
            
            cache_key = f"otd_{user}_{year}_{now.month}_{now.day}"
            cached = self.cache.get(cache_key)
            if cached:
                history.append(cached)
                continue

            params = {
                "method": "user.getrecenttracks",
                "user": user,
                "from": start_ts,
                "to": end_ts,
                "limit": 5
            }
            
            data = self.client.request("GET", params)
            if data:
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
                
                self.cache.set(cache_key, entry)
                history.append(entry)
        
        return history

    def get_top_artists(self, user: str, period: str = "1month", limit: int = 10):
        cache_key = f"top_artists_{user}_{period}_{limit}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "user.gettopartists",
            "user": user,
            "period": period,
            "limit": limit
        }
        
        data = self.client.request("GET", params)
        if not data:
            return []
            
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
                })
        
        self.cache.set(cache_key, artists)
        return artists

    def sync_scrobbles_to_db(self, user: str):
        from database import add_scrobble, get_latest_scrobble_timestamp
        
        last_ts = get_latest_scrobble_timestamp(user)
        # Fetch from last_ts + 1
        start_ts = last_ts + 1 if last_ts > 0 else 0
        
        print(f"Syncing scrobbles for {user} starting from {start_ts}...")
        
        # We use a loop similar to get_cached_recent_tracks but focusing on "from" parameter
        page = 1
        limit = 200
        new_scrobbles_count = 0
        
        while True:
            params = {
                "method": "user.getrecenttracks",
                "user": user,
                "limit": limit,
                "page": page,
                "from": start_ts
            }
            
            data = self.client.request("GET", params)
            if not data or "recenttracks" not in data or "track" not in data["recenttracks"]:
                break
                
            tracks = data["recenttracks"]["track"]
            if isinstance(tracks, dict):
                tracks = [tracks]
            
            if not tracks:
                break

            # Filter out now playing
            valid_tracks = [t for t in tracks if not ("@attr" in t and t["@attr"].get("nowplaying") == "true")]
            
            if not valid_tracks:
                 if page == 1: break # No new tracks at all
            
            for t in valid_tracks:
                if "date" not in t: continue
                
                artist = t.get("artist", {}).get("#text")
                title = t.get("name")
                album = t.get("album", {}).get("#text")
                image_url = t.get("image", [{}])[-1].get("#text")
                ts = int(t["date"]["uts"])
                
                add_scrobble(user, artist, title, album, image_url, ts)
                new_scrobbles_count += 1
            
            attr = data["recenttracks"].get("@attr", {})
            total_pages = int(attr.get("totalPages", 1))
            
            if page >= total_pages or page >= 200:
                break
                
            page += 1
            time.sleep(0.5) # Be gentle with API
            
        print(f"Sync complete. Added {new_scrobbles_count} new scrobbles.")
        return new_scrobbles_count

    def get_artist_top_albums(self, artist: str, limit: int = 5):
        cache_key = f"artist_albums_{artist}_{limit}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "artist.gettopalbums",
            "artist": artist,
            "limit": limit
        }
        
        data = self.client.request("GET", params)
        albums = []
        if data and "topalbums" in data and "album" in data["topalbums"]:
            raw = data["topalbums"]["album"]
            if isinstance(raw, dict): raw = [raw]
            for a in raw:
                # Use ImageProvider for album art
                lastfm_imgs = a.get("image", [])
                album_name = a.get("name")
                # Treat album name as track name for search purposes (it works for iTunes album search logic too if adapted, 
                # but currently get_image uses it for track/album search depending on context. 
                # Actually, get_image with 2 args (artist, title) searches for track.
                # But here we want ALBUM art.
                # ImageProvider.get_image logic: if title is present, looks for track.
                # If we pass album name as title, it might search for a TRACK named like the album.
                # However, many albums have a title track, so this often works.
                # A better approach would be to update ImageProvider to handle 'album' type explicitly, 
                # but stick to the current pattern for minimal risk.
                # Or better: Last.fm usually has good album art, so just filtering the placeholder is key.
                final_image = self.image_provider.get_image(lastfm_imgs, artist, album_name)
                
                albums.append({
                    "name": album_name,
                    "playcount": a.get("playcount"),
                    "image": final_image
                })
        
        self.cache.set(cache_key, albums)
        return albums

    def get_similar_artists(self, artist: str, limit: int = 5):
        cache_key = f"similar_artists_{artist}_{limit}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "artist.getsimilar",
            "artist": artist,
            "limit": limit
        }
        
        data = self.client.request("GET", params)
        artists = []
        if data and "similarartists" in data and "artist" in data["similarartists"]:
            raw = data["similarartists"]["artist"]
            if isinstance(raw, dict): raw = [raw]
            for a in raw:
                # Use ImageProvider to get best image (handling placeholders)
                lastfm_imgs = a.get("image", [])
                artist_name = a.get("name")
                # Passing None for track title implies artist image search
                final_image = self.image_provider.get_image(lastfm_imgs, artist_name, None)
                
                artists.append({
                    "name": artist_name,
                    "match": a.get("match"),
                    "image": final_image
                })
        
        self.cache.set(cache_key, artists)
        return artists

    def get_artist_info(self, artist: str, username: str = None):
        cache_key = f"artist_info_{artist}_{username}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "artist.getinfo",
            "artist": artist
        }
        if username:
            params["user"] = username
            
        data = self.client.request("GET", params)
        if data and "artist" in data:
            self.cache.set(cache_key, data["artist"])
            return data["artist"]
        return None

    def get_artist_top_tracks(self, artist: str, limit: int = 10):
        cache_key = f"artist_top_tracks_{artist}_{limit}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "artist.gettoptracks",
            "artist": artist,
            "limit": limit
        }
        
        data = self.client.request("GET", params)
        tracks = []
        if data and "toptracks" in data and "track" in data["toptracks"]:
            raw = data["toptracks"]["track"]
            if isinstance(raw, dict): raw = [raw]
            for t in raw:
                tracks.append({
                    "title": t.get("name"),
                    "playcount": t.get("playcount"),
                    "listeners": t.get("listeners")
                })
        
        self.cache.set(cache_key, tracks)
        return tracks
