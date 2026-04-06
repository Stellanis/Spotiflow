from database.repositories.playback.playback_sessions import get_playback_session, replace_queue_segment, update_playback_session
from database.repositories.playback.queue_ops import clear_upcoming_queue_items, insert_queue_items, remove_queue_item, reorder_queue_items


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
    self._broadcast_session(updated, extra={"queue_change": {"action": "removed", "track_keys": [track_key], "count": 1}})
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
