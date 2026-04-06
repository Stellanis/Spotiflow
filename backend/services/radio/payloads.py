from database.repositories.playback.stream_sources import get_stream_source
from services.stream_resolver import stream_resolver


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
