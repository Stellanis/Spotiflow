from datetime import datetime, timezone

from database.repositories.playback.playback_sessions import (
    create_playback_session,
    finish_playback_session,
    get_active_playback_session,
    get_playback_session,
)
from services.recommendation_index_service import recommendation_index_service
from services.stream_resolver import build_track_key


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
