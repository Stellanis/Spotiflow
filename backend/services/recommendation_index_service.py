from collections import defaultdict
from datetime import datetime, timedelta
import logging
import os

from database import (
    get_downloads,
    get_feedback_map,
    get_dismissed_tracks,
    get_setting,
    get_top_artists_from_db,
    get_top_tracks_from_db,
    list_enriched_tracks,
    list_releases,
    get_stream_failure_counts,
)
from services.lastfm import LastFMService
from services.playable_source_service import playable_source_service
from services.stream_resolver import build_track_key

logger = logging.getLogger(__name__)


class RecommendationIndexService:
    def __init__(self):
        self.lastfm = LastFMService()

    def get_user(self):
        return get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")

    def build_recommendations(self, limit=24):
        user = self.get_user()
        if not user:
            return []

        downloaded = self._get_downloaded_map()
        dismissed = get_dismissed_tracks(user)
        feedback = get_feedback_map(user)
        recent_top_artists = self._recent_top_artists(user)
        recent_top_tracks = self._recent_top_tracks(user)

        candidates = {}
        for item in self._candidate_pool(recent_top_artists, recent_top_tracks):
            key = (item["artist"].lower(), item["title"].lower())
            if key in dismissed or key in downloaded["tracks"]:
                continue
            if "dismissed" in feedback.get(key, set()) or "not_my_taste" in feedback.get(key, set()):
                continue
            scored = self._score_candidate(item, key, recent_top_artists, feedback, downloaded)
            if not scored:
                continue
            existing = candidates.get(key)
            if not existing or scored["score"] > existing["score"]:
                candidates[key] = scored

        result = list(candidates.values())
        result.sort(key=lambda item: item["score"], reverse=True)
        return result[:limit]

    def build_radio_candidates(self, seed_track, session_tracks=None, limit=15):
        session_tracks = session_tracks or []
        excluded_keys = {
            ((item.get("artist") or "").lower(), (item.get("title") or "").lower()) for item in session_tracks
        }
        recs = self.build_recommendations(limit=limit * 3)
        same_artist_budget = defaultdict(int)
        seed_artist = (seed_track.get("artist") or "").lower()
        final = []
        for item in recs:
            key = (item["artist"].lower(), item["title"].lower())
            if key in excluded_keys:
                continue
            artist_key = item["artist"].lower()
            if same_artist_budget[artist_key] >= 2:
                continue
            if len(final) < 4 and artist_key == seed_artist:
                item["score"] += 10
            same_artist_budget[artist_key] += 1
            final.append(item)
            if len(final) >= limit:
                break
        return final

    def _recent_top_artists(self, user):
        top_from_db = get_top_artists_from_db(user, limit=10, start_ts=self._recent_start_ts(30))
        if top_from_db:
            return top_from_db
        return self.lastfm.get_top_artists(user, period="1month", limit=10)

    def _recent_top_tracks(self, user):
        top_from_db = get_top_tracks_from_db(user, limit=10, start_ts=self._recent_start_ts(30))
        if top_from_db:
            return top_from_db
        return self.lastfm.get_top_tracks(user, period="1month", limit=10)

    def _candidate_pool(self, recent_top_artists, recent_top_tracks):
        pool = []
        for artist in recent_top_artists[:10]:
            source_artist = artist["name"]
            similar = self.lastfm.get_similar_artists(source_artist, limit=5)
            for similar_artist in similar:
                tags = self.lastfm.get_artist_tags(similar_artist["name"])[:3]
                top_tracks = self.lastfm.get_artist_top_tracks(similar_artist["name"], limit=3)
                for track in top_tracks:
                    pool.append(
                        {
                            "artist": similar_artist["name"],
                            "title": track["title"],
                            "album": None,
                            "image": similar_artist.get("image"),
                            "listeners": int(track.get("listeners") or 0),
                            "tags": tags,
                            "reason": f"Because you love {source_artist}",
                            "base_similarity_score": 45,
                            "source_type": "similar_artist",
                        }
                    )

        for track in recent_top_tracks[:6]:
            pool.append(
                {
                    "artist": track["artist"],
                    "title": track["title"],
                    "album": None,
                    "image": track.get("image"),
                    "listeners": 0,
                    "tags": ["Recent Favorite"],
                    "reason": "Based on your recent listening",
                    "base_similarity_score": 35,
                    "source_type": "top_track_memory",
                }
            )

        for enriched in list_enriched_tracks(limit=60):
            pool.append(
                {
                    "artist": enriched["artist"],
                    "title": enriched["name"],
                    "album": enriched.get("album"),
                    "image": enriched.get("cover_art_url"),
                    "listeners": int(enriched.get("popularity") or 0),
                    "tags": ["Enriched Library"],
                    "reason": "Adjacent to your known library",
                    "base_similarity_score": 30,
                    "source_type": "enriched_library",
                    "preview_url": enriched.get("preview_url"),
                    "canonical_track_id": enriched.get("id"),
                    "duration_seconds": enriched.get("duration_seconds"),
                }
            )

        for release in list_releases(limit=20):
            pool.append(
                {
                    "artist": release["artist"],
                    "title": release["title"],
                    "album": None,
                    "image": release.get("image_url"),
                    "listeners": 0,
                    "tags": [release.get("release_type") or "Release"],
                    "reason": "A recent release from your orbit",
                    "base_similarity_score": 40,
                    "source_type": "release_radar",
                }
            )

        return pool

    def _score_candidate(self, item, key, recent_top_artists, feedback, downloaded):
        score = float(item.get("base_similarity_score", 0))
        recent_artist_names = {artist["name"].lower(): artist.get("playcount", 1) for artist in recent_top_artists}
        artist_key = item["artist"].lower()

        if artist_key in recent_artist_names:
            score += min(20, recent_artist_names[artist_key])
        if item.get("tags"):
            score += min(6, len(item["tags"]) * 2)
        if key not in downloaded["tracks"]:
            score += 8
        if artist_key in downloaded["artists"]:
            score += 6

        actions = feedback.get(key, set())
        if "liked" in actions:
            score += 18
        if "saved_for_later" in actions:
            score += 12
        if "already_know" in actions:
            score -= 10
        if "not_my_taste" in actions:
            score -= 25

        failure_penalty = get_stream_failure_counts(item["artist"], item["title"])
        score -= failure_penalty * 6

        playable_state, is_streamable = playable_source_service.get_playable_state(
            item["artist"],
            item["title"],
            album=item.get("album"),
            preview_url=item.get("preview_url"),
        )
        item["track_key"] = build_track_key(item["artist"], item["title"], item.get("album"))
        item["playable_state"] = playable_state
        item["is_streamable"] = is_streamable
        item["recommended_because"] = item.get("reason")
        item["available_actions"] = ["download", "add_to_playlist", "dismiss", "save"]
        if is_streamable:
            item["available_actions"].insert(1, "play")
        item["generated_at"] = datetime.now().astimezone().isoformat()
        item["score"] = round(score, 2)
        return item

    def _get_downloaded_map(self):
        rows = get_downloads(page=1, limit=100000, status="completed")
        downloaded = set()
        artists = set()
        for row in rows:
            key = ((row.get("artist") or "").lower(), (row.get("title") or "").lower())
            downloaded.add(key)
            artists.add((row.get("artist") or "").lower())
        return {"tracks": downloaded, "artists": artists}

    def _recent_start_ts(self, days):
        cutoff = datetime.utcnow() - timedelta(days=days)
        return int(cutoff.timestamp())


recommendation_index_service = RecommendationIndexService()
