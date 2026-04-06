from datetime import datetime, timedelta, timezone

from core import downloader_service
from database.repositories.playback.playback_events import get_playback_event_counts, list_playback_events
from database.repositories.playback.stream_sources import get_stream_source, upsert_stream_source
from database.repositories.settings import get_setting
from services.download_service import download_coordinator
from services.websocket_manager import manager


def _maybe_promote(self, username, payload):
    if (get_setting("AUTO_PROMOTE_STREAMED_TRACKS", "true") or "true").lower() != "true":
        return None
    playback_type = payload.get("playback_type")
    if playback_type not in {"remote_stream", "preview"}:
        return None

    artist = payload["artist"]
    title = payload["title"]
    album = payload.get("album")
    if payload.get("event_type") == "like":
        return self._queue_download_promotion(artist, title, album, payload)

    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    starts = get_playback_event_counts(username, artist, title, event_type="start", since_iso=since)
    if starts >= 2:
        return self._queue_download_promotion(artist, title, album, payload)

    if payload.get("event_type") == "replay":
        ended_events = list_playback_events(username=username, artist=artist, title=title, limit=20)
        if any(
            event.get("event_type") == "ended"
            and (event.get("position_seconds") or 0) >= 0.7 * (payload.get("duration_seconds") or 0)
            for event in ended_events
        ):
            return self._queue_download_promotion(artist, title, album, payload)
    return None


def _queue_download_promotion(self, artist, title, album, payload):
    query = f"{artist} - {title}"
    result = download_coordinator.queue(
        downloader_service,
        query=query,
        artist=artist,
        title=title,
        album=album,
        image_url=payload.get("image"),
    )
    stream_source_id = payload.get("stream_source_id")
    if stream_source_id:
        source = get_stream_source(stream_source_id)
        if source:
            upsert_stream_source(
                track_id=source.get("track_id"),
                artist=source["artist"],
                title=source["title"],
                album=source.get("album"),
                source_name=source["source_name"],
                source_url=source.get("source_url"),
                playable_url=source.get("playable_url"),
                playback_type=source["playback_type"],
                resolver_payload=source.get("resolver_payload"),
                expires_at=source.get("expires_at"),
                last_verified_at=source.get("last_verified_at"),
                health_status=source.get("health_status", "healthy"),
                failure_count=source.get("failure_count", 0),
                last_error=source.get("last_error"),
                promoted_to_download=True,
                cache_key=source["cache_key"],
            )
    manager.broadcast_sync(
        {
            "type": "playback.session",
            "promotion_events": [{"artist": artist, "title": title, "status": result.get("status")}],
        }
    )
    return result
