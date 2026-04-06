from database.repositories.playback.playback_sessions import get_playback_session
from services.websocket_manager import manager


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
