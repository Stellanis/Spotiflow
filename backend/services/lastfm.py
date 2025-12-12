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

    def _get_recent_tracks_cached(self, user: str, period: str):
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
        page = 1
        limit = 50
        
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
            
            if page >= total_pages or page >= 5:
                break
                
            page += 1
            time.sleep(0.2)
        
        self.cache.set(cache_key, all_tracks)
        return start_ts, all_tracks

    def get_chart_data(self, user: str, period: str = "1month", artist: str = None, track: str = None):
        start_ts, all_tracks = self._get_recent_tracks_cached(user, period)
        now = int(time.time())
        day_seconds = 86400
        
        filtered_tracks = []
        for t in all_tracks:
            if artist and t.get("artist", {}).get("#text").lower() != artist.lower():
                continue
            if track and t.get("name").lower() != track.lower():
                continue
            filtered_tracks.append(t)

        daily_counts = {}
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
        
        return [{"date": k, "count": v} for k, v in sorted(daily_counts.items())]

    def prefetch_track_infos(self, user: str, tracks: list):
        print(f"Starting prefetch for {len(tracks)} tracks...")
        for t in tracks:
            try:
                artist = t.get('artist')
                title = t.get('title')
                if artist and title:
                    self.get_track_info(user, artist, title)
                    time.sleep(0.2)
            except Exception as e:
                print(f"Error prefetching: {e}")
        print("Prefetch complete.")

    def refresh_stats_cache(self, user: str):
        print(f"Starting daily stats refresh for {user}...")
        periods = ['overall', '7day', '1month', '3month', '6month', '12month']
        
        for period in periods:
            print(f"Refreshing Top Tracks ({period})...")
            try:
                self.get_top_tracks(user, period=period, limit=50, ignore_cache=True)
                time.sleep(1)
            except Exception as e:
                print(f"Error refreshing {period}: {e}")
                
        print("Refreshing Activity Chart (1month)...")
        cache_key = f"raw_recent_{user}_1month"
        self.cache.delete(cache_key)
        self.get_chart_data(user, period="1month")
        print("Daily stats refresh complete.")

    def get_listening_clock_data(self, user: str, period: str = "1month"):
        start_ts, all_tracks = self._get_recent_tracks_cached(user, period)
        hour_counts = {h: 0 for h in range(24)}
        
        for t in all_tracks:
            if "date" in t:
                ts = int(t["date"]["uts"])
                dt = datetime.fromtimestamp(ts)
                hour_counts[dt.hour] += 1
                
        return [{"hour": h, "count": c} for h, c in hour_counts.items()]

    def get_genre_breakdown(self, user: str, period: str = "1month"):
        cache_key = f"genres_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        params = {
            "method": "user.gettopartists",
            "user": user,
            "period": period,
            "limit": 20
        }
        
        data = self.client.request("GET", params)
        if not data:
            return []
            
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
                tags = self._get_artist_tags(name)
                for tag in tags[:3]: 
                    tag_counts[tag] += playcount
        
        result = [{"name": tag, "value": count} for tag, count in tag_counts.most_common(15)]
        self.cache.set(cache_key, result)
        return result

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

    def _get_artist_tags(self, artist_name):
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

    def get_listening_streak(self, user: str):
        cache_key = f"streak_{user}" 
        cached = self.cache.get(cache_key)
        if cached:
             return cached

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
        self.cache.set(cache_key, result)
        return result

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

    def get_artist_diversity(self, user: str, period: str = "1month"):
        import math
        cache_key = f"diversity_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
            
        params = {
            "method": "user.gettopartists",
            "user": user,
            "period": period,
            "limit": 50 
        }
        
        data = self.client.request("GET", params)
        if not data: return {"score": 0, "label": "No Data"}

        artists = []
        if "topartists" in data and "artist" in data["topartists"]:
            artists = data["topartists"]["artist"]
            if isinstance(artists, dict): artists = [artists]
        
        if not artists: return {"score": 0, "label": "No Data"}

        playcounts = [int(a.get("playcount", 1)) for a in artists]
        total_plays = sum(playcounts)
        
        if total_plays == 0: return {"score": 0, "label": "No Data"}
        
        entropy = 0
        for count in playcounts:
            p = count / total_plays
            if p > 0:
                entropy -= p * math.log2(p)
        
        n = len(playcounts)
        max_entropy = math.log2(n) if n > 1 else 1
        normalized_score = (entropy / max_entropy) * 100 if max_entropy > 0 else 0
        
        if normalized_score >= 90: label = "Explorer"
        elif normalized_score >= 70: label = "Eclectic"
        elif normalized_score >= 50: label = "Balanced"
        elif normalized_score >= 30: label = "Focused"
        else: label = "Obsessive"
        
        result = {"score": round(normalized_score), "label": label}
        self.cache.set(cache_key, result)
        return result

    def get_mainstream_score(self, user: str, period: str = "1month"):
        import math
        cache_key = f"mainstream_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
            
        params = {
            "method": "user.gettopartists",
            "user": user,
            "period": period,
            "limit": 50 
        }
        
        data = self.client.request("GET", params)
        if not data: return {"score": 0, "label": "No Data"}

        artists = []
        if "topartists" in data and "artist" in data["topartists"]:
            artists = data["topartists"]["artist"]
            if isinstance(artists, dict): artists = [artists]
        
        if not artists: return {"score": 0, "label": "No Data"}

        top_10 = artists[:10]
        total_pop_score = 0
        total_weight = 0
        
        for a in top_10:
            name = a.get("name")
            user_playcount = int(a.get("playcount", 1))
            
            listeners = self.get_artist_listeners(name)
            
            if listeners > 0:
                log_pop = math.log10(listeners)
                max_log = 6.7
                score = (log_pop / max_log) * 100
                score = max(0, min(100, score))
            else:
                score = 0
                
            total_pop_score += score * user_playcount
            total_weight += user_playcount
            
        final_score = total_pop_score / total_weight if total_weight > 0 else 0
        
        if final_score >= 85: label = "Mainstream"
        elif final_score >= 70: label = "Popular"
        elif final_score >= 50: label = "Trendy"
        elif final_score >= 30: label = "Underground"
        else: label = "Obscure"
        
        result = {"score": round(final_score), "label": label}
        self.cache.set(cache_key, result)
        return result
