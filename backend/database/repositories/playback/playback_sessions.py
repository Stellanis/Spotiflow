from ...connection import get_connection
from .shared import UNSET, json_dump, now_iso, parse_row


def create_playback_session(
    *,
    username,
    mode,
    status="active",
    seed_type=None,
    seed_payload=None,
    current_index=0,
    queue_payload=None,
    suspended_queue_payload=None,
    suspended_mode=None,
    started_at=None,
    finished_at=None,
):
    now = now_iso()
    started_at = started_at or now
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO playback_sessions (
                username, mode, status, seed_type, seed_payload, current_index, queue_payload,
                suspended_queue_payload, suspended_mode, started_at, updated_at, finished_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                mode,
                status,
                seed_type,
                json_dump(seed_payload),
                current_index,
                json_dump(queue_payload or []),
                json_dump(suspended_queue_payload),
                suspended_mode,
                started_at,
                now,
                finished_at,
            ),
        )
        session_id = cursor.lastrowid
        cursor.execute("SELECT * FROM playback_sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        conn.commit()
    return parse_row(row)


def get_playback_session(session_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM playback_sessions WHERE id = ?", (session_id,))
        return parse_row(cursor.fetchone())


def get_active_playback_session(username):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM playback_sessions
            WHERE username = ? AND status IN ('active', 'paused')
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (username,),
        )
        return parse_row(cursor.fetchone())


def update_playback_session(
    session_id,
    *,
    mode=UNSET,
    status=UNSET,
    seed_type=UNSET,
    seed_payload=UNSET,
    current_index=UNSET,
    queue_payload=UNSET,
    suspended_queue_payload=UNSET,
    suspended_mode=UNSET,
    finished_at=UNSET,
):
    updates = []
    params = []
    if mode is not UNSET:
        updates.append("mode = ?")
        params.append(mode)
    if status is not UNSET:
        updates.append("status = ?")
        params.append(status)
    if seed_type is not UNSET:
        updates.append("seed_type = ?")
        params.append(seed_type)
    if seed_payload is not UNSET:
        updates.append("seed_payload = ?")
        params.append(json_dump(seed_payload))
    if current_index is not UNSET:
        updates.append("current_index = ?")
        params.append(current_index)
    if queue_payload is not UNSET:
        updates.append("queue_payload = ?")
        params.append(json_dump(queue_payload))
    if suspended_queue_payload is not UNSET:
        updates.append("suspended_queue_payload = ?")
        params.append(json_dump(suspended_queue_payload))
    if suspended_mode is not UNSET:
        updates.append("suspended_mode = ?")
        params.append(suspended_mode)
    if finished_at is not UNSET:
        updates.append("finished_at = ?")
        params.append(finished_at)
    updates.append("updated_at = ?")
    params.append(now_iso())
    params.append(session_id)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE playback_sessions SET {', '.join(updates)} WHERE id = ?", params)
        cursor.execute("SELECT * FROM playback_sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        conn.commit()
    return parse_row(row)


def finish_playback_session(session_id, finished_at=None):
    return update_playback_session(session_id, status="finished", finished_at=finished_at or now_iso())


def replace_queue_segment(
    session_id,
    *,
    queue_payload,
    current_index=None,
    suspended_queue_payload=None,
    suspended_mode=None,
):
    return update_playback_session(
        session_id,
        queue_payload=queue_payload,
        current_index=current_index,
        suspended_queue_payload=suspended_queue_payload,
        suspended_mode=suspended_mode,
    )


def list_active_playback_sessions(limit=50):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM playback_sessions WHERE status IN ('active', 'paused') ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        )
        return [parse_row(row) for row in cursor.fetchall()]


def create_radio_session(username, seed_type, seed_payload, queue_payload, status="active"):
    return create_playback_session(
        username=username,
        mode="radio",
        status=status,
        seed_type=seed_type,
        seed_payload=seed_payload,
        current_index=0,
        queue_payload=queue_payload,
    )


def get_radio_session(session_id):
    session = get_playback_session(session_id)
    if session and session.get("mode") == "radio":
        return session
    return session


def update_radio_session(session_id, *, current_index=None, queue_payload=None, status=None, finished_at=None):
    return update_playback_session(
        session_id,
        current_index=current_index,
        queue_payload=queue_payload,
        status=status,
        finished_at=finished_at,
    )


def list_active_radio_sessions(limit=50):
    return [session for session in list_active_playback_sessions(limit=limit) if session.get("mode") == "radio"]
