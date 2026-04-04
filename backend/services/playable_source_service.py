import logging
from database import get_stream_source, mark_stream_source_failure, mark_stream_source_verified
from services.stream_resolver import build_track_key, stream_resolver

logger = logging.getLogger(__name__)


class PlayableSourceService:
    def resolve(self, artist, title, album=None, preview_url=None):
        local = stream_resolver.find_local_source(artist, title, album=album)
        if local:
            return local

        cached = stream_resolver.get_cached_stream_source(artist, title, album=album)
        if cached:
            return {
                "playback_type": cached.get("playback_type"),
                "audio_url": cached.get("playable_url"),
                "expires_at": cached.get("expires_at"),
                "source_name": cached.get("source_name"),
                "source_url": cached.get("source_url"),
                "headers_required": False,
                "duration_seconds": (cached.get("resolver_payload") or {}).get("duration"),
                "cache_key": cached.get("cache_key"),
                "can_download": True,
                "is_promotable": not bool(cached.get("promoted_to_download")),
                "stream_source_id": cached.get("id"),
            }

        source_health = stream_resolver.get_stream_source_health(artist, title, album=album)
        if source_health and not source_health.get("should_attempt_resolution"):
            logger.info(
                "stream_resolution_cooldown artist=%s title=%s stream_source_id=%s cooldown_until=%s",
                artist,
                title,
                source_health.get("stream_source_id"),
                source_health.get("cooldown_until"),
            )
            return stream_resolver._preview_result(preview_url, build_track_key(artist, title, album))

        if not self.is_streaming_enabled() and preview_url:
            return stream_resolver._preview_result(preview_url, build_track_key(artist, title, album))
        if not self.is_streaming_enabled():
            return None
        return stream_resolver.resolve_remote_stream(artist, title, album=album, preview_url=preview_url)

    def get_playable_state(self, artist, title, album=None, preview_url=None):
        local = stream_resolver.find_local_source(artist, title, album=album)
        if local:
            return "local", True
        cached = stream_resolver.get_cached_stream_source(artist, title, album=album)
        if cached:
            return "cached_stream", True
        source_health = stream_resolver.get_stream_source_health(artist, title, album=album)
        if source_health and not source_health.get("should_attempt_resolution"):
            return "cooldown", bool(preview_url)
        if preview_url:
            return "resolvable", True
        if self.is_streaming_enabled():
            return "resolvable", True
        return "unavailable", False

    def mark_failure(self, stream_source_id, error_message):
        if not stream_source_id:
            return None
        source = get_stream_source(stream_source_id)
        if not source:
            return None
        next_failure_count = int(source.get("failure_count") or 0) + 1
        health_status = "cooldown" if next_failure_count >= stream_resolver.failure_threshold else "degraded"
        mark_stream_source_failure(stream_source_id, error_message, health_status=health_status)
        updated_source = get_stream_source(stream_source_id)
        return stream_resolver.describe_source_health(updated_source)

    def mark_success(self, stream_source_id, playable_url=None, expires_at=None):
        if stream_source_id:
            mark_stream_source_verified(stream_source_id, playable_url=playable_url, expires_at=expires_at)

    def get_stream_health(self, artist, title, album=None):
        return stream_resolver.get_stream_source_health(artist, title, album=album)

    def refresh_proxy_url(self, stream_source_id):
        source = get_stream_source(stream_source_id)
        if not source:
            return None
        playable = self.resolve(source["artist"], source["title"], source.get("album"))
        if not playable:
            return None
        return playable["audio_url"]

    def is_streaming_enabled(self):
        from database import get_setting

        return (get_setting("REALTIME_STREAMING_ENABLED", "true") or "true").lower() == "true"


playable_source_service = PlayableSourceService()
