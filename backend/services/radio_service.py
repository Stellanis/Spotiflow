import logging
from datetime import datetime, timedelta, timezone

from database import (
    add_playback_event,
    create_radio_session,
    get_playback_event_counts,
    get_radio_session,
    get_setting,
    get_stream_source,
    list_playback_events,
    update_radio_session,
    upsert_stream_source,
)
from services.download_service import download_coordinator
from services.playable_source_service import playable_source_service
from services.recommendation_index_service import recommendation_index_service
from services.stream_resolver import build_track_key, stream_resolver
from services.websocket_manager import manager
from core import downloader_service

logger = logging.getLogger(__name__)


class RadioService:
    def __init__(self):
        self.batch_size = 15
        self.refill_threshold = 2
        self._playback_event_fields = {
            "session_id",
            "artist",
            "title",
            "album",
            "playback_type",
            "event_type",
            "position_seconds",
            "source_name",
            "source_url",
        }

    def start_session(self, username, seed_track, seed_type="recommendation", seed_context=None):
        queue = [self._normalize_track(seed_track)]
        queue.extend(
            recommendation_index_service.build_radio_candidates(seed_track, session_tracks=queue, limit=self.batch_size - 1)
        )
        session = create_radio_session(
            username=username,
            seed_type=seed_type,
            seed_payload=seed_context or seed_track,
            queue_payload=queue,
            status="active",
        )
        self._broadcast_session(session)
        return session

    def get_session(self, session_id):
        return get_radio_session(session_id)

    def next_track(self, session_id, reason="next"):
        session = get_radio_session(session_id)
        if not session:
            return None, None
        queue = session.get("queue_payload") or []
        next_index = min(session.get("current_index", 0) + 1, max(len(queue) - 1, 0))
        if len(queue) - next_index <= self.refill_threshold:
            queue = self._refill_queue(session, queue)
        session = update_radio_session(session_id, current_index=next_index, queue_payload=queue)
        self._broadcast_session(session)
        current_track = queue[next_index] if next_index < len(queue) else None
        return session, current_track

    def next_playable_track(self, session_id, reason="next"):
        session = get_radio_session(session_id)
        if not session:
            return None, None, None, []

        queue = list(session.get("queue_payload") or [])
        search_index = session.get("current_index", 0) + 1
        skipped_tracks = []

        while True:
            if len(queue) - search_index <= self.refill_threshold:
                previous_length = len(queue)
                queue = self._refill_queue(session, queue)
                if len(queue) != previous_length:
                    logger.info(
                        "radio_refill session_id=%s old_length=%s new_length=%s",
                        session_id,
                        previous_length,
                        len(queue),
                    )

            while search_index < len(queue):
                candidate = queue[search_index]
                playable = playable_source_service.resolve(
                    candidate["artist"],
                    candidate["title"],
                    album=candidate.get("album"),
                    preview_url=candidate.get("preview_url"),
                )
                if playable:
                    session = update_radio_session(session_id, current_index=search_index, queue_payload=queue)
                    self._broadcast_session(session)
                    logger.info(
                        "radio_next_playable session_id=%s index=%s skipped=%s playback_type=%s",
                        session_id,
                        search_index,
                        len(skipped_tracks),
                        playable.get("playback_type"),
                    )
                    return session, candidate, playable, skipped_tracks

                skipped_tracks.append(candidate)
                logger.warning(
                    "radio_skip_unplayable session_id=%s index=%s artist=%s title=%s",
                    session_id,
                    search_index,
                    candidate.get("artist"),
                    candidate.get("title"),
                )
                search_index += 1

            previous_length = len(queue)
            queue = self._refill_queue(session, queue)
            if len(queue) == previous_length:
                logger.warning(
                    "radio_no_playable_remaining session_id=%s skipped=%s",
                    session_id,
                    len(skipped_tracks),
                )
                return session, None, None, skipped_tracks

    def ensure_refill(self, session_id):
        session = get_radio_session(session_id)
        if not session:
            return None
        queue = session.get("queue_payload") or []
        if len(queue) - session.get("current_index", 0) <= self.refill_threshold:
            queue = self._refill_queue(session, queue)
            session = update_radio_session(session_id, queue_payload=queue)
            self._broadcast_session(session)
        return session

    def record_event(self, username, payload):
        event_payload = {
            key: value
            for key, value in payload.items()
            if key in self._playback_event_fields
        }
        event = add_playback_event(username=username, **event_payload)
        stream_health = None
        if payload.get("event_type") == "error" and payload.get("source_url"):
            stream_health = self._mark_source_failure(payload)
        promotion = self._maybe_promote(username, payload)
        self._broadcast_event(payload.get("session_id"), event, stream_health=stream_health, promotion=promotion)
        return event, promotion

    def verify_stream_sources(self):
        from database import list_recent_stream_sources

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

    def _normalize_track(self, track):
        normalized = dict(track)
        normalized["track_key"] = normalized.get("track_key") or build_track_key(
            normalized.get("artist"), normalized.get("title"), normalized.get("album")
        )
        return normalized

    def _refill_queue(self, session, queue):
        seed_track = queue[0] if queue else session.get("seed_payload") or {}
        refill = recommendation_index_service.build_radio_candidates(seed_track, session_tracks=queue, limit=self.batch_size)
        existing_keys = {item.get("track_key") for item in queue}
        for track in refill:
            if track.get("track_key") in existing_keys:
                continue
            queue.append(track)
        return queue

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
            if any((event.get("event_type") == "ended" and (event.get("position_seconds") or 0) >= 0.7 * (payload.get("duration_seconds") or 0)) for event in ended_events):
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
                "promotion_events": [
                    {
                        "artist": artist,
                        "title": title,
                        "status": result.get("status"),
                    }
                ],
            }
        )
        return result

    def _mark_source_failure(self, payload):
        stream_source_id = payload.get("stream_source_id")
        if stream_source_id:
            return playable_source_service.mark_failure(stream_source_id, payload.get("error_message") or "Playback error")
        return None

    def _broadcast_session(self, session):
        queue = session.get("queue_payload") or []
        current_index = session.get("current_index", 0)
        current_track = queue[current_index] if current_index < len(queue) else None
        manager.broadcast_sync(
            {
                "type": "playback.session",
                "session_id": session.get("id"),
                "queue_length": len(queue),
                "remaining_queue": max(len(queue) - current_index - 1, 0),
                "current_index": current_index,
                "current_track": current_track,
                "stream_health": self._build_stream_health_payload(track=current_track),
                "promotion_events": [],
            }
        )

    def _broadcast_event(self, session_id, event, stream_health=None, promotion=None):
        if not session_id and not promotion:
            return
        promotion_events = []
        if promotion:
            promotion_events.append(
                {
                    "artist": event.get("artist"),
                    "title": event.get("title"),
                    "status": promotion.get("status"),
                }
            )
        manager.broadcast_sync(
            {
                "type": "playback.session",
                "session_id": session_id,
                "event": event,
                "stream_health": stream_health or self._build_stream_health_payload(track=event),
                "promotion_events": promotion_events,
            }
        )

    def _build_stream_health_payload(self, stream_source_id=None, track=None):
        if stream_source_id:
            source = get_stream_source(stream_source_id)
            if not source:
                return None
            return stream_resolver.describe_source_health(source)
        if not track:
            return None
        if track.get("playback_type") == "local":
            return {"status": "local", "can_use_cached": True, "should_attempt_resolution": False}
        return stream_resolver.get_stream_source_health(track.get("artist"), track.get("title"), album=track.get("album"))


radio_service = RadioService()
