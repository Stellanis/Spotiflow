from database.repositories.playback.playback_events import add_playback_event
from database.repositories.playback.stream_sources import list_recent_stream_sources, upsert_stream_source
from services.playable_source_service import playable_source_service
from services.recommendation_index_service import recommendation_index_service
from services.stream_resolver import stream_resolver


def record_event(self, username, payload):
    event_payload = {key: value for key, value in payload.items() if key in self._playback_event_fields}
    event = add_playback_event(username=username, **event_payload)
    stream_health = None
    if payload.get("event_type") == "error" and payload.get("source_url"):
        stream_health = self._mark_source_failure(payload)
    promotion = self._maybe_promote(username, payload)
    self._broadcast_event(payload.get("session_id"), event, stream_health=stream_health, promotion=promotion)
    return event, promotion


def verify_stream_sources(self):
    checked = 0
    degraded = 0
    for source in list_recent_stream_sources(hours=24, limit=200):
        checked += 1
        health = stream_resolver.describe_source_health(source)
        if health and health.get("is_expired"):
            upsert_stream_source(
                track_id=source.get("track_id"),
                artist=source["artist"],
                title=source["title"],
                album=source.get("album"),
                source_name=source["source_name"],
                source_url=source.get("source_url"),
                playable_url=None,
                playback_type=source["playback_type"],
                resolver_payload=source.get("resolver_payload"),
                expires_at=source.get("expires_at"),
                last_verified_at=source.get("last_verified_at"),
                health_status="expired",
                failure_count=source.get("failure_count", 0),
                last_error=source.get("last_error"),
                promoted_to_download=bool(source.get("promoted_to_download")),
                cache_key=source["cache_key"],
            )
            degraded += 1
        elif source.get("health_status") == "cooldown" and health and not health.get("is_in_cooldown"):
            upsert_stream_source(
                track_id=source.get("track_id"),
                artist=source["artist"],
                title=source["title"],
                album=source.get("album"),
                source_name=source["source_name"],
                source_url=source.get("source_url"),
                playable_url=None,
                playback_type=source["playback_type"],
                resolver_payload=source.get("resolver_payload"),
                expires_at=source.get("expires_at"),
                last_verified_at=source.get("last_verified_at"),
                health_status="degraded",
                failure_count=source.get("failure_count", 0),
                last_error=source.get("last_error"),
                promoted_to_download=bool(source.get("promoted_to_download")),
                cache_key=source["cache_key"],
            )
            degraded += 1
    return {"checked": checked, "updated": degraded}


def warm_recommendation_streamability(self):
    warmed = 0
    for item in recommendation_index_service.build_recommendations(limit=10):
        playable_source_service.get_playable_state(
            item["artist"], item["title"], album=item.get("album"), preview_url=item.get("preview_url")
        )
        warmed += 1
    return {"warmed": warmed}


def _mark_source_failure(self, payload):
    stream_source_id = payload.get("stream_source_id")
    if stream_source_id:
        return playable_source_service.mark_failure(stream_source_id, payload.get("error_message") or "Playback error")
    return None
