import logging
import os
from datetime import datetime, timedelta, timezone

try:
    import yt_dlp
except ModuleNotFoundError:
    yt_dlp = None

from database import (
    find_download_by_track,
    find_recent_stream_source,
    upsert_stream_source,
)
from utils import sanitize_filename

logger = logging.getLogger(__name__)


def build_track_key(artist, title, album=None):
    return "|".join(
        [
            (artist or "").strip().lower(),
            (title or "").strip().lower(),
            (album or "").strip().lower(),
        ]
    )


def build_local_audio_url(download_row):
    artist = sanitize_filename(download_row.get("artist"))
    album = sanitize_filename(download_row.get("album"))
    title = sanitize_filename(download_row.get("title"))
    return f"/api/audio/{artist}/{album}/{title}.mp3"


class StreamResolver:
    def __init__(self):
        self.failed_source_cooldown_hours = 6
        self.metadata_ttl_hours = 24
        self.default_playable_ttl_minutes = 30

    def find_local_source(self, artist, title, album=None):
        download = find_download_by_track(artist, title, album=album)
        if not download:
            return None
        return {
            "playback_type": "local",
            "audio_url": build_local_audio_url(download),
            "expires_at": None,
            "source_name": "local_library",
            "source_url": download.get("source_url"),
            "headers_required": False,
            "duration_seconds": None,
            "cache_key": build_track_key(artist, title, album),
            "can_download": False,
            "is_promotable": False,
            "stream_source_id": None,
        }

    def get_cached_stream_source(self, artist, title, album=None):
        cached = find_recent_stream_source(artist, title, album=album)
        if not cached:
            return None
        if cached.get("health_status") == "degraded":
            return None
        expires_at = self._parse_iso(cached.get("expires_at"))
        if expires_at and expires_at <= datetime.now(timezone.utc):
            return None
        return cached

    def resolve_remote_stream(self, artist, title, album=None, preview_url=None):
        cache_key = build_track_key(artist, title, album)
        if yt_dlp is None:
            logger.warning("yt_dlp is not installed; remote stream resolution disabled.")
            return self._preview_result(preview_url, cache_key)

        search_query = f"{artist} - {title}"
        if album:
            search_query = f"{search_query} {album}"

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "default_search": "ytsearch3",
            "noplaylist": True,
            "extract_flat": False,
            "format": "bestaudio/best",
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(search_query, download=False)
        except Exception as exc:
            logger.warning("Stream resolution failed for %s: %s", search_query, exc)
            return self._preview_result(preview_url, cache_key)

        candidates = info.get("entries") if isinstance(info, dict) and info.get("entries") else [info]
        best = self._pick_best_candidate(candidates, artist, title)
        if not best:
            return self._preview_result(preview_url, cache_key)

        playable_url = best.get("url")
        source_url = best.get("webpage_url") or best.get("original_url")
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.default_playable_ttl_minutes)
        source_name = best.get("extractor_key") or best.get("extractor") or "yt_dlp"
        playback_type = "remote_stream"
        if not playable_url:
            return self._preview_result(preview_url, cache_key)

        row = upsert_stream_source(
            artist=artist,
            title=title,
            album=album,
            source_name=source_name,
            source_url=source_url,
            playable_url=playable_url,
            playback_type=playback_type,
            resolver_payload={
                "id": best.get("id"),
                "title": best.get("title"),
                "extractor": best.get("extractor"),
                "duration": best.get("duration"),
            },
            expires_at=expires_at.isoformat(),
            last_verified_at=datetime.now(timezone.utc).isoformat(),
            health_status="healthy",
            failure_count=0,
            last_error=None,
            promoted_to_download=False,
            cache_key=cache_key,
        )

        return {
            "playback_type": playback_type,
            "audio_url": playable_url,
            "expires_at": row.get("expires_at"),
            "source_name": source_name,
            "source_url": source_url,
            "headers_required": False,
            "duration_seconds": best.get("duration"),
            "cache_key": cache_key,
            "can_download": True,
            "is_promotable": True,
            "stream_source_id": row.get("id"),
        }

    def _preview_result(self, preview_url, cache_key):
        if not preview_url:
            return None
        return {
            "playback_type": "preview",
            "audio_url": preview_url,
            "expires_at": None,
            "source_name": "preview",
            "source_url": None,
            "headers_required": False,
            "duration_seconds": None,
            "cache_key": cache_key,
            "can_download": True,
            "is_promotable": False,
            "stream_source_id": None,
        }

    def _pick_best_candidate(self, candidates, artist, title):
        best = None
        best_score = -1
        target = f"{artist} {title}".lower()
        for candidate in candidates or []:
            candidate_title = (candidate.get("title") or "").lower()
            webpage_url = (candidate.get("webpage_url") or candidate.get("original_url") or "").lower()
            score = 0
            if artist.lower() in candidate_title:
                score += 2
            if title.lower() in candidate_title:
                score += 3
            if "audio" in candidate.get("format", ""):
                score += 1
            if "music" in webpage_url or "watch" in webpage_url:
                score += 1
            if target in candidate_title:
                score += 3
            if score > best_score:
                best = candidate
                best_score = score
        return best if best_score >= 3 else None

    def _parse_iso(self, value):
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None


stream_resolver = StreamResolver()
