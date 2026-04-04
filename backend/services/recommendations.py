import time
from datetime import datetime, timezone
import logging
import os

from database import add_feedback, get_setting
from .lastfm import LastFMService
from .cache_manager import CacheManager
from .recommendation_index_service import recommendation_index_service

logger = logging.getLogger(__name__)


class RecommendationsService:
    def __init__(self):
        self.lastfm = LastFMService()
        self.cache = CacheManager(ttl=3600)

    def _get_user(self):
        return get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")

    def get_recommendations(self, limit: int = 20):
        user = self._get_user()
        if not user:
            logger.warning("No LASTFM_USER setting found.")
            return []
        return recommendation_index_service.build_recommendations(limit=limit)

    def add_feedback(self, artist: str, title: str, feedback_type: str):
        user = self._get_user()
        if not user:
            return False
        add_feedback(user, artist, title, feedback_type)
        return True

    def _get_forgotten_gems(self, user: str, limit: int = 6):
        from .analytics import AnalyticsService

        analytics = AnalyticsService(self.lastfm)
        return analytics.get_forgotten_gems(user)[:limit]

    def get_artist_radar(self, limit: int = 12):
        cache_key = f"radar_{self._get_user()}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        user = self._get_user()
        if not user:
            return []

        top_artists_req = self.lastfm.get_top_artists(user, period="1month", limit=8)
        if not top_artists_req:
            return []
        top_artist_names = set(a["name"] for a in top_artists_req)

        radar = {}
        for artist in top_artists_req:
            similar = self.lastfm.get_similar_artists(artist["name"], limit=6)
            for s in similar:
                name = s["name"]
                if name in top_artist_names or name in radar:
                    continue
                tags = self.lastfm.get_artist_tags(name)[:4]
                listeners = self.lastfm.get_artist_listeners(name)
                top_tracks = self.lastfm.get_artist_top_tracks(name, limit=3)
                radar[name] = {
                    "name": name,
                    "image": s["image"],
                    "tags": tags,
                    "listeners": listeners,
                    "match": s.get("match"),
                    "because": artist["name"],
                    "reason": f"Similar to {artist['name']}",
                    "source_type": "radar",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "top_tracks": [
                        {
                            "title": t["title"],
                            "listeners": int(t.get("listeners") or 0),
                        }
                        for t in top_tracks
                    ],
                }
                if len(radar) >= limit:
                    break
            if len(radar) >= limit:
                break

        result = list(radar.values())
        self.cache.set(cache_key, result)
        return result

    def get_mood_stations(self, limit_moods: int = 6, tracks_per_mood: int = 20):
        user = self._get_user()
        if not user:
            return []

        cache_key = f"moods_{user}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        from .analytics import AnalyticsService

        analytics = AnalyticsService(self.lastfm)
        genre_data = analytics.get_genre_breakdown(user, period="1month")
        top_tags = [g["name"] for g in genre_data[:limit_moods]]
        if not top_tags:
            top_tags = ["Pop", "Electronic", "Rock", "Indie", "Hip-Hop", "Chill"]

        stations = []
        for tag in top_tags:
            tracks = self._get_tag_top_tracks(tag, limit=tracks_per_mood)
            stations.append(
                {
                    "mood": tag,
                    "tracks": [
                        {
                            **track,
                            "reason": f"Built from your {tag} listening",
                            "source_type": "mood_tag",
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                        }
                        for track in tracks
                    ],
                }
            )

        self.cache.set(cache_key, stations)
        return stations

    def _get_tag_top_tracks(self, tag: str, limit: int = 20):
        cache_key = f"tag_tracks_{tag}_{limit}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            from .api_client import LastFMApiClient
            from .image_provider import ImageProvider

            client = LastFMApiClient()
            data = client.request(
                "GET",
                {
                    "method": "tag.gettoptracks",
                    "tag": tag,
                    "limit": limit,
                },
            )
            tracks = []
            if data and "tracks" in data and "track" in data["tracks"]:
                raw = data["tracks"]["track"]
                if isinstance(raw, dict):
                    raw = [raw]
                for t in raw:
                    artist_obj = t.get("artist", {})
                    artist = artist_obj.get("name") if isinstance(artist_obj, dict) else artist_obj
                    title = t.get("name")
                    lastfm_imgs = t.get("image", [])
                    img = ImageProvider().get_image(lastfm_imgs, artist, title)
                    if artist and title:
                        tracks.append(
                            {
                                "artist": artist,
                                "title": title,
                                "image": img,
                                "query": f"{artist} {title}",
                                "tags": [tag],
                            }
                        )
        except Exception as e:
            logger.error(f"Error fetching tag tracks for {tag}: {e}")
            tracks = []

        self.cache.set(cache_key, tracks)
        return tracks

    def get_history_this_week(self, years_back: int = 5):
        user = self._get_user()
        if not user:
            return []

        cache_key = f"history_week_{user}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        from datetime import datetime, timedelta
        from .api_client import LastFMApiClient

        client = LastFMApiClient()
        now = datetime.now()
        week_start = now - timedelta(days=now.weekday())
        week_end = week_start + timedelta(days=6)

        results = []
        for i in range(1, years_back + 1):
            year = now.year - i
            try:
                start = datetime(year, week_start.month, week_start.day, 0, 0, 0)
                end = datetime(year, week_end.month, week_end.day, 23, 59, 59)
            except ValueError:
                continue

            start_ts = int(start.timestamp())
            end_ts = int(end.timestamp())
            cache_key_year = f"history_week_{user}_{year}_{week_start.month}_{week_start.day}"
            year_cached = self.cache.get(cache_key_year)
            if year_cached:
                results.append(year_cached)
                continue

            data = client.request(
                "GET",
                {
                    "method": "user.getrecenttracks",
                    "user": user,
                    "from": start_ts,
                    "to": end_ts,
                    "limit": 200,
                },
            )

            tracks = []
            total = 0
            if data and "recenttracks" in data:
                rt = data["recenttracks"]
                total = int(rt.get("@attr", {}).get("total", 0))
                raw = rt.get("track", [])
                if isinstance(raw, dict):
                    raw = [raw]

                from collections import Counter

                counter = Counter()
                track_meta = {}
                for t in raw:
                    if "@attr" in t and t["@attr"].get("nowplaying"):
                        continue
                    artist = t.get("artist", {}).get("#text", "")
                    title = t.get("name", "")
                    img = t.get("image", [{}])[-1].get("#text", "")
                    if artist and title:
                        key = (artist, title)
                        counter[key] += 1
                        if key not in track_meta:
                            track_meta[key] = img

                for (artist, title), count in counter.most_common(5):
                    tracks.append(
                        {
                            "artist": artist,
                            "title": title,
                            "image": track_meta[(artist, title)],
                            "plays": count,
                            "reason": f"You played this during this week in {year}",
                            "source_type": "history",
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    )

            entry = {
                "year": year,
                "week_start": start.strftime("%Y-%m-%d"),
                "week_end": end.strftime("%Y-%m-%d"),
                "scrobble_count": total,
                "top_tracks": tracks[:5],
            }
            self.cache.set(cache_key_year, entry)
            results.append(entry)
            time.sleep(0.3)

        self.cache.set(cache_key, results)
        return results


recommendations_service = RecommendationsService()
