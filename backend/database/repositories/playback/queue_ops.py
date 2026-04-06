from .playback_sessions import get_playback_session, update_playback_session


def insert_queue_items(session_id, index, items):
    session = get_playback_session(session_id)
    if not session:
        return None
    queue = list(session.get("queue_payload") or [])
    queue[index:index] = items
    return update_playback_session(session_id, queue_payload=queue)


def remove_queue_item(session_id, track_key):
    session = get_playback_session(session_id)
    if not session:
        return None
    queue = list(session.get("queue_payload") or [])
    filtered = [item for item in queue if item.get("track_key") != track_key]
    if len(filtered) == len(queue):
        return session
    current_index = min(session.get("current_index", 0), max(len(filtered) - 1, 0))
    return update_playback_session(session_id, queue_payload=filtered, current_index=current_index)


def reorder_queue_items(session_id, ordered_track_keys):
    session = get_playback_session(session_id)
    if not session:
        return None
    queue = list(session.get("queue_payload") or [])
    current_index = session.get("current_index", 0)
    current_item = queue[: current_index + 1]
    upcoming = queue[current_index + 1 :]
    upcoming_by_key = {item.get("track_key"): item for item in upcoming}
    reordered = [upcoming_by_key[key] for key in ordered_track_keys]
    return update_playback_session(session_id, queue_payload=current_item + reordered)


def clear_upcoming_queue_items(session_id):
    session = get_playback_session(session_id)
    if not session:
        return None
    queue = list(session.get("queue_payload") or [])
    current_index = session.get("current_index", 0)
    return update_playback_session(session_id, queue_payload=queue[: current_index + 1])
