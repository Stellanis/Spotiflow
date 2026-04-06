from database.repositories.playback.playback_sessions import finish_playback_session, get_playback_session, update_playback_session
from services.playable_source_service import playable_source_service
from services.recommendation_index_service import recommendation_index_service


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
                self._broadcast_session(session, extra={"queue_change": {"action": "refilled", "track_keys": [], "count": refill_added}})

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
            self._broadcast_session(session, extra={"queue_change": {"action": "refilled", "track_keys": [], "count": refill_added}})
    return session


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
