import logging
from datetime import datetime, timedelta, timezone

from database import (
    add_playback_event,
    clear_upcoming_queue_items,
    create_playback_session,
    finish_playback_session,
    get_active_playback_session,
    get_playback_event_counts,
    get_playback_session,
    get_setting,
    get_stream_source,
    insert_queue_items,
    list_playback_events,
    remove_queue_item,
    replace_queue_segment,
    reorder_queue_items,
    update_playback_session,
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
        return self.start_radio_session(username, seed_track, seed_type=seed_type, seed_context=seed_context)

    def start_manual_session(self, username, track, queue_items, start_index=0, replace_active=True):
        if replace_active:
            self._finish_existing_sessions(username)
        queue = [self._normalize_track(item, "manual") for item in (queue_items or [])]
        session = create_playback_session(
            username=username,
            mode="manual",
            status="active",
            seed_type="manual",
            seed_payload=track or (queue[start_index] if queue else None),
            current_index=max(0, min(start_index, max(len(queue) - 1, 0))),
            queue_payload=queue,
        )
        self._broadcast_session(session, extra={"event": {"type": "start_manual"}})
        return session

    def replace_with_manual_session(self, username, track, queue_items, start_index=0):
        return self.start_manual_session(username, track, queue_items, start_index=start_index, replace_active=True)

    def start_radio_session(self, username, seed_track, seed_type="recommendation", seed_context=None, replace_active=True):
        if replace_active:
            self._finish_existing_sessions(username)
        normalized_seed = self._normalize_track(seed_track, "radio")
        queue = [normalized_seed]
        queue.extend(
            self._normalize_track(item, "radio")
            for item in recommendation_index_service.build_radio_candidates(
                normalized_seed,
                session_tracks=queue,
                limit=self.batch_size - 1,
            )
        )
        session = create_playback_session(
            username=username,
            mode="radio",
            status="active",
            seed_type=seed_type,
            seed_payload=seed_context or seed_track,
            current_index=0,
            queue_payload=queue,
        )
        self._broadcast_session(session, extra={"event": {"type": "start_radio"}})
        return session

    def get_session(self, session_id):
        return get_playback_session(session_id)

    def get_or_create_active_session(self, username, preferred_mode="manual"):
        session = get_active_playback_session(username)
        if session:
            return session
        if preferred_mode == "radio":
            raise ValueError("Cannot create radio session without a seed")
        return None

    def insert_manual_items(self, session_id, items, placement="end"):
        session = get_playback_session(session_id)
        if not session:
            return None

        normalized_items = [self._normalize_track(item, "manual") for item in items or []]
        if not normalized_items:
            return session

        queue = list(session.get("queue_payload") or [])
        current_index = session.get("current_index", 0)
        insert_at = current_index + 1 if placement == "next" else len(queue)

        # Collapse exact contiguous duplicates added by the same action.
        deduped = []
        for item in normalized_items:
            if deduped and deduped[-1].get("track_key") == item.get("track_key"):
                continue
            deduped.append(item)
        normalized_items = deduped

        suspended_queue = session.get("suspended_queue_payload")
        suspended_mode = session.get("suspended_mode")
        if session.get("mode") == "radio" and not suspended_queue:
            suspended_queue = queue[current_index + 1 :]
            suspended_mode = "radio" if suspended_queue else None
            queue = queue[: current_index + 1]
        updated = insert_queue_items(session_id, insert_at, normalized_items)
        if suspended_queue is not None:
            updated = update_playback_session(
                session_id,
                queue_payload=updated.get("queue_payload"),
                suspended_queue_payload=suspended_queue,
                suspended_mode=suspended_mode,
            )
        self._broadcast_session(
            updated,
            extra={
                "queue_change": {
                    "action": "added_next" if placement == "next" else "added_end",
                    "track_keys": [item.get("track_key") for item in normalized_items],
                    "count": len(normalized_items),
                }
            },
        )
        return updated

    def remove_item(self, session_id, track_key):
        session = get_playback_session(session_id)
        if not session:
            return None
        queue = list(session.get("queue_payload") or [])
        current_index = session.get("current_index", 0)
        current_track = queue[current_index] if current_index < len(queue) else None
        if current_track and current_track.get("track_key") == track_key:
            raise ValueError("Current item must be skipped, not removed")
        updated = remove_queue_item(session_id, track_key)
        self._broadcast_session(
            updated,
            extra={"queue_change": {"action": "removed", "track_keys": [track_key], "count": 1}},
        )
        return updated

    def reorder_items(self, session_id, ordered_track_keys):
        session = get_playback_session(session_id)
        if not session:
            return None
        queue = list(session.get("queue_payload") or [])
        current_index = session.get("current_index", 0)
        upcoming = queue[current_index + 1 :]
        upcoming_keys = [item.get("track_key") for item in upcoming]
        if sorted(upcoming_keys) != sorted(ordered_track_keys):
            raise ValueError("ordered_track_keys must match the upcoming queue exactly")
        updated = reorder_queue_items(session_id, ordered_track_keys)
        self._broadcast_session(
            updated,
            extra={"queue_change": {"action": "reordered", "track_keys": ordered_track_keys, "count": len(ordered_track_keys)}},
        )
        return updated

    def clear_upcoming(self, session_id):
        updated = clear_upcoming_queue_items(session_id)
        if updated and updated.get("suspended_mode") == "radio":
            updated = update_playback_session(session_id, suspended_queue_payload=None, suspended_mode=None)
        self._broadcast_session(updated, extra={"queue_change": {"action": "cleared", "track_keys": [], "count": 0}})
        return updated

    def resume_suspended_queue_if_needed(self, session):
        if not session:
            return None
        queue = list(session.get("queue_payload") or [])
        current_index = session.get("current_index", 0)
        suspended = list(session.get("suspended_queue_payload") or [])
        if current_index < len(queue) - 1 or not suspended:
            return session
        updated = replace_queue_segment(
            session["id"],
            queue_payload=queue + suspended,
            current_index=current_index,
            suspended_queue_payload=None,
            suspended_mode=None,
        )
        self._broadcast_session(
            updated,
            extra={
                "queue_change": {
                    "action": "resumed_radio",
                    "track_keys": [item.get("track_key") for item in suspended],
                    "count": len(suspended),
                }
            },
        )
        return updated

    def next_track(self, session_id, reason="next"):
        return self.next_playable_track(session_id, reason=reason)

    def next_playable_track(self, session_id, reason="next"):
        session = get_playback_session(session_id)
        if not session or session.get("status") == "finished":
            return None, None, None, []

        session = self.resume_suspended_queue_if_needed(session)
        queue = list(session.get("queue_payload") or [])
        search_index = session.get("current_index", 0) + 1
        skipped_tracks = []

        while True:
            if session.get("mode") == "radio" and len(queue) - search_index <= self.refill_threshold:
                session, queue, refill_added = self._refill_radio_queue(session, queue)
                if refill_added:
                    self._broadcast_session(
                        session,
                        extra={"queue_change": {"action": "refilled", "track_keys": [], "count": refill_added}},
                    )

            if search_index >= len(queue):
                if session.get("suspended_mode") == "radio" and session.get("suspended_queue_payload"):
                    session = self.resume_suspended_queue_if_needed(session)
                    queue = list(session.get("queue_payload") or [])
                    continue
                finished = finish_playback_session(session_id)
                self._broadcast_session(finished, extra={"event": {"type": "finished"}})
                return finished, None, None, skipped_tracks

            candidate = queue[search_index]
            playable = playable_source_service.resolve(
                candidate["artist"],
                candidate["title"],
                album=candidate.get("album"),
                preview_url=candidate.get("preview_url"),
            )
            if playable:
                session = update_playback_session(session_id, current_index=search_index, queue_payload=queue)
                session = self.resume_suspended_queue_if_needed(session)
                self._broadcast_session(session)
                return session, candidate, playable, skipped_tracks

            skipped_tracks.append(candidate)
            search_index += 1

    def ensure_refill(self, session_id):
        session = get_playback_session(session_id)
        if not session or session.get("mode") != "radio":
            return session
        queue = list(session.get("queue_payload") or [])
        if len(queue) - session.get("current_index", 0) <= self.refill_threshold:
            session, _, refill_added = self._refill_radio_queue(session, queue)
            if refill_added:
                self._broadcast_session(
                    session,
                    extra={"queue_change": {"action": "refilled", "track_keys": [], "count": refill_added}},
                )
        return session

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

    def _finish_existing_sessions(self, username):
        existing = get_active_playback_session(username)
        while existing:
            finish_playback_session(existing["id"])
            existing = get_active_playback_session(username)

    def _normalize_track(self, track, queue_source):
        normalized = dict(track)
        normalized["track_key"] = normalized.get("track_key") or build_track_key(
            normalized.get("artist"), normalized.get("title"), normalized.get("album")
        )
        normalized["image"] = normalized.get("image") or normalized.get("image_url")
        normalized["queue_source"] = queue_source
        normalized["seed_type"] = normalized.get("seed_type")
        normalized["seed_context"] = normalized.get("seed_context")
        normalized["added_at"] = normalized.get("added_at") or datetime.now(timezone.utc).isoformat()
        return normalized

    def _refill_radio_queue(self, session, queue):
        if session.get("mode") != "radio":
            return session, queue, 0
        seed_track = queue[0] if queue else session.get("seed_payload") or {}
        refill = recommendation_index_service.build_radio_candidates(seed_track, session_tracks=queue, limit=self.batch_size)
        existing_keys = {item.get("track_key") for item in queue}
        added = 0
        for track in refill:
            normalized = self._normalize_track(track, "radio")
            if normalized.get("track_key") in existing_keys:
                continue
            queue.append(normalized)
            existing_keys.add(normalized.get("track_key"))
            added += 1
        if added:
            session = update_playback_session(session["id"], queue_payload=queue)
        return session, queue, added

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
                (event.get("event_type") == "ended" and (event.get("position_seconds") or 0) >= 0.7 * (payload.get("duration_seconds") or 0))
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

    def _mark_source_failure(self, payload):
        stream_source_id = payload.get("stream_source_id")
        if stream_source_id:
            return playable_source_service.mark_failure(stream_source_id, payload.get("error_message") or "Playback error")
        return None

    def _build_response_payload(self, session):
        queue = session.get("queue_payload") or []
        current_index = session.get("current_index", 0)
        current_track = queue[current_index] if 0 <= current_index < len(queue) else None
        stream_health = None
        if current_track:
            stream_health = self._build_stream_health_payload(track=current_track)
        return {
            "session_id": session.get("id"),
            "mode": session.get("mode"),
            "status": session.get("status"),
            "current_index": current_index,
            "current_track": current_track,
            "queue": queue,
            "queue_summary": self._build_queue_summary(queue, current_index),
            "suspended_queue_summary": {
                "mode": session.get("suspended_mode"),
                "total": len(session.get("suspended_queue_payload") or []),
            }
            if session.get("suspended_queue_payload")
            else None,
            "stream_health": stream_health,
            "promotion_events": [],
        }

    def _broadcast_session(self, session, extra=None):
        if not session:
            return
        payload = self._build_response_payload(session)
        if extra:
            payload.update(extra)
        manager.broadcast_sync({"type": "playback.session", **payload})

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
        payload = {"type": "playback.session", "session_id": session_id, "event": event, "promotion_events": promotion_events}
        if session_id:
            session = get_playback_session(session_id)
            if session:
                payload.update(self._build_response_payload(session))
        payload["stream_health"] = stream_health or self._build_stream_health_payload(track=event)
        manager.broadcast_sync(payload)

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

    def _build_queue_summary(self, queue, current_index):
        upcoming = queue[current_index + 1 :] if current_index >= 0 else queue
        return {
            "total": len(queue),
            "remaining": max(len(queue) - current_index - 1, 0),
            "manual_upcoming": sum(1 for item in upcoming if item.get("queue_source") == "manual"),
            "radio_upcoming": sum(1 for item in upcoming if item.get("queue_source") == "radio"),
        }


radio_service = RadioService()
