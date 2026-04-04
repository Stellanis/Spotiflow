import random
import time
from datetime import datetime, timezone
from database import add_feedback, get_downloads, get_feedback_map, get_setting, get_dismissed_tracks, list_releases
from .lastfm import LastFMService
from .cache_manager import CacheManager
import logging
import os

logger = logging.getLogger(__name__)


class RecommendationsService:
    def __init__(self):
        self.lastfm = LastFMService()
        self.cache = CacheManager(ttl=3600)  # 1-hour cache for recommendations

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    def _get_user(self):
        return get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")

    def _get_downloaded_set(self):
        all_downloads = get_downloads(page=1, limit=100000)
        downloaded = set()
        for d in all_downloads:
            a = (d["artist"] or "").lower()
            t = (d["title"] or "").lower()
            downloaded.add((a, t))
        return downloaded

    def _get_dismissed_set(self, user: str):
        try:
            return get_dismissed_tracks(user)
        except Exception:
            return set()

    def _get_feedback_map(self, user: str):
        try:
            return get_feedback_map(user)
        except Exception:
            return {}

    def _enrich_track(self, track: dict, source_type: str):
        enriched = dict(track)
        enriched["source_type"] = source_type
        enriched["generated_at"] = datetime.now(timezone.utc).isoformat()
        actions = ["download", "add_to_playlist", "dismiss", "save"]
        if enriched.get("audio_url"):
            actions.insert(1, "play")
        enriched["available_actions"] = actions
        return enriched

    # ------------------------------------------------------------------ #
    # For You – enriched recommendations
    # ------------------------------------------------------------------ #

    def get_recommendations(self, limit: int = 20):
        user = self._get_user()
        if not user:
            logger.warning("No LASTFM_USER setting found.")
            return []

        # Top artists (1-month window → fresh signal)
        top_artists_req = self.lastfm.get_top_artists(user, period="1month", limit=10)
        if not top_artists_req:
            return []
        top_artist_names = [a["name"] for a in top_artists_req]

        # Build similar-artist pool with source artist for "reason" field
        similar_pool = []  # list of (similar_name, similar_image, source_artist)
        for artist in top_artist_names:
            similar = self.lastfm.get_similar_artists(artist, limit=5)
            for s in similar:
                if s["name"] not in top_artist_names:
                    similar_pool.append((s["name"], s["image"], artist))

        # Fetch top tracks for similar artists
        candidates = []
        for artist_name, image_url, source_artist in similar_pool:
            tags = self.lastfm.get_artist_tags(artist_name)[:3]
            top_tracks = self.lastfm.get_artist_top_tracks(artist_name, limit=3)
            for t in top_tracks:
                candidates.append({
                    "artist": artist_name,
                    "title": t["title"],
                    "image": image_url,
                    "query": f"{artist_name} {t['title']}",
                    "reason": f"Because you love {source_artist}",
                    "tags": tags,
                    "listeners": int(t.get("listeners") or 0),
                    "score": 40,
                })

        for gem in self._get_forgotten_gems(user, limit=6):
            candidates.append(
                {
                    "artist": gem["artist"],
                    "title": gem["title"],
                    "image": gem.get("image"),
                    "query": f"{gem['artist']} {gem['title']}",
                    "reason": "A forgotten gem from your own history",
                    "tags": ["Library Memory"],
                    "listeners": 0,
                    "source_type": "forgotten_gem",
                    "score": 55 + int(gem.get("playcount", 0)),
                }
            )

        for release in list_releases(limit=12):
            candidates.append(
                {
                    "artist": release["artist"],
                    "title": release["title"],
                    "image": release.get("image_url"),
                    "query": f"{release['artist']} {release['title']}",
                    "reason": "A recent release from someone worth watching",
                    "tags": [release.get("release_type") or "Release Radar"],
                    "listeners": 0,
                    "source_type": "release_radar",
                    "score": 65,
                }
            )

        random.shuffle(candidates)

        # Filter already downloaded & dismissed
        downloaded_set = self._get_downloaded_set()
        dismissed_set = self._get_dismissed_set(user)
        feedback_map = self._get_feedback_map(user)
        seen = set()
        result = []
        for c in candidates:
            key = (c["artist"].lower(), c["title"].lower())
            if key in downloaded_set or key in dismissed_set or key in seen:
                continue
            if "dismissed" in feedback_map.get(key, set()) or "not_my_taste" in feedback_map.get(key, set()):
                continue
            if "saved_for_later" in feedback_map.get(key, set()):
                c["score"] = c.get("score", 0) + 15
            if "liked" in feedback_map.get(key, set()):
                c["score"] = c.get("score", 0) + 20
            seen.add(key)
            result.append(self._enrich_track(c, c.get("source_type", "similar_artist")))

        result.sort(key=lambda item: item.get("score", 0), reverse=True)
        result = result[:limit]

        return result

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

    # ------------------------------------------------------------------ #
    # Artist Radar
    # ------------------------------------------------------------------ #

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

        radar = {}  # name → data, deduplicate
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

    # ------------------------------------------------------------------ #
    # Mood Stations
    # ------------------------------------------------------------------ #

    def get_mood_stations(self, limit_moods: int = 6, tracks_per_mood: int = 20):
        user = self._get_user()
        if not user:
            return []

        cache_key = f"moods_{user}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Top tags from genre breakdown
        from .analytics import AnalyticsService
        analytics = AnalyticsService(self.lastfm)
        genre_data = analytics.get_genre_breakdown(user, period="1month")

        # Take top N tags
        top_tags = [g["name"] for g in genre_data[:limit_moods]]
        if not top_tags:
            top_tags = ["Pop", "Electronic", "Rock", "Indie", "Hip-Hop", "Chill"]

        downloaded_set = self._get_downloaded_set()
        dismissed_set = self._get_dismissed_set(user)

        stations = []
        for tag in top_tags:
            tracks = self._get_tag_top_tracks(tag, limit=tracks_per_mood)
            filtered = []
            seen = set()
            for t in tracks:
                key = (t["artist"].lower(), t["title"].lower())
                if key not in downloaded_set and key not in dismissed_set and key not in seen:
                    seen.add(key)
                    filtered.append(self._enrich_track({
                        **t,
                        "reason": f"Built from your {tag} listening",
                    }, "mood_tag"))
            stations.append({"mood": tag, "tracks": filtered})

        self.cache.set(cache_key, stations)
        return stations

    def _get_tag_top_tracks(self, tag: str, limit: int = 20):
        cache_key = f"tag_tracks_{tag}_{limit}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            from .api_client import LastFMApiClient
            client = LastFMApiClient()
            data = client.request("GET", {
                "method": "tag.gettoptracks",
                "tag": tag,
                "limit": limit,
            })
            tracks = []
            if data and "tracks" in data and "track" in data["tracks"]:
                raw = data["tracks"]["track"]
                if isinstance(raw, dict):
                    raw = [raw]
                for t in raw:
                    artist_obj = t.get("artist", {})
                    artist = artist_obj.get("name") if isinstance(artist_obj, dict) else artist_obj
                    title = t.get("name")
                    # Use image provider for artwork
                    lastfm_imgs = t.get("image", [])
                    from .image_provider import ImageProvider
                    img = ImageProvider().get_image(lastfm_imgs, artist, title)
                    if artist and title:
                        tracks.append({
                            "artist": artist,
                            "title": title,
                            "image": img,
                            "query": f"{artist} {title}",
                            "tags": [tag],
                        })
        except Exception as e:
            logger.error(f"Error fetching tag tracks for {tag}: {e}")
            tracks = []

        self.cache.set(cache_key, tracks)
        return tracks

    # ------------------------------------------------------------------ #
    # This Week in History
    # ------------------------------------------------------------------ #

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
        # Current week: Monday → Sunday
        week_start = now - timedelta(days=now.weekday())
        week_end = week_start + timedelta(days=6)

        results = []
        for i in range(1, years_back + 1):
            year = now.year - i
            try:
                start = datetime(year, week_start.month, week_start.day, 0, 0, 0)
                end = datetime(year, week_end.month, week_end.day, 23, 59, 59)
            except ValueError:
                # Edge case: Feb 29 in non-leap year etc.
                continue

            start_ts = int(start.timestamp())
            end_ts = int(end.timestamp())

            cache_key_year = f"history_week_{user}_{year}_{week_start.month}_{week_start.day}"
            year_cached = self.cache.get(cache_key_year)
            if year_cached:
                results.append(year_cached)
                continue

            data = client.request("GET", {
                "method": "user.getrecenttracks",
                "user": user,
                "from": start_ts,
                "to": end_ts,
                "limit": 200,
            })

            tracks = []
            total = 0
            if data and "recenttracks" in data:
                rt = data["recenttracks"]
                total = int(rt.get("@attr", {}).get("total", 0))
                raw = rt.get("track", [])
                if isinstance(raw, dict):
                    raw = [raw]

                # Build top track aggregation (artist+title counts)
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
                    tracks.append(self._enrich_track({
                        "artist": artist,
                        "title": title,
                        "image": track_meta[(artist, title)],
                        "plays": count,
                        "reason": f"You played this during this week in {year}",
                    }, "history"))

            entry = {
                "year": year,
                "week_start": start.strftime("%Y-%m-%d"),
                "week_end": end.strftime("%Y-%m-%d"),
                "scrobble_count": total,
                "top_tracks": tracks[:5],
            }
            self.cache.set(cache_key_year, entry)
            results.append(entry)
            time.sleep(0.3)  # Polite API calls

        self.cache.set(cache_key, results)
        return results


recommendations_service = RecommendationsService()
