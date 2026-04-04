import json
from datetime import datetime, timedelta, timezone

from ..core import get_connection


def _now():
    return datetime.now(timezone.utc).isoformat()


def _json_dump(value):
    if value is None:
        return None
    return json.dumps(value)


def _parse_row(row):
    if not row:
        return None
    item = dict(row)
    for field in ("resolver_payload", "seed_payload", "queue_payload"):
        if field in item and item[field]:
            try:
                item[field] = json.loads(item[field])
            except Exception:
                pass
    return item


def upsert_stream_source(
    *,
    track_id=None,
    artist,
    title,
    album=None,
    source_name,
    source_url=None,
    playable_url=None,
    playback_type,
    resolver_payload=None,
    expires_at=None,
    last_verified_at=None,
    health_status="healthy",
    failure_count=0,
    last_error=None,
    promoted_to_download=False,
    cache_key=None,
):
    now = _now()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO stream_sources (
                track_id, artist, title, album, source_name, source_url, playable_url, playback_type,
                resolver_payload, expires_at, last_verified_at, health_status, failure_count,
                last_error, promoted_to_download, cache_key, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                track_id = COALESCE(excluded.track_id, stream_sources.track_id),
                source_name = excluded.source_name,
                source_url = COALESCE(excluded.source_url, stream_sources.source_url),
                playable_url = COALESCE(excluded.playable_url, stream_sources.playable_url),
                playback_type = excluded.playback_type,
                resolver_payload = COALESCE(excluded.resolver_payload, stream_sources.resolver_payload),
                expires_at = COALESCE(excluded.expires_at, stream_sources.expires_at),
                last_verified_at = COALESCE(excluded.last_verified_at, stream_sources.last_verified_at),
                health_status = excluded.health_status,
                failure_count = excluded.failure_count,
                last_error = excluded.last_error,
                promoted_to_download = excluded.promoted_to_download,
                updated_at = excluded.updated_at
            """,
            (
                track_id,
                artist,
                title,
                album,
                source_name,
                source_url,
                playable_url,
                playback_type,
                _json_dump(resolver_payload),
                expires_at,
                last_verified_at,
                health_status,
                failure_count,
                last_error,
                1 if promoted_to_download else 0,
                cache_key,
                now,
                now,
            ),
        )
        c.execute("SELECT * FROM stream_sources WHERE cache_key = ?", (cache_key,))
        row = c.fetchone()
        conn.commit()
    return _parse_row(row)


def get_stream_source(stream_source_id):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM stream_sources WHERE id = ?", (stream_source_id,))
        return _parse_row(c.fetchone())


def get_stream_source_by_cache_key(cache_key):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM stream_sources WHERE cache_key = ?", (cache_key,))
        return _parse_row(c.fetchone())


def find_recent_stream_source(artist, title, album=None, healthy_only=False):
    with get_connection() as conn:
        c = conn.cursor()
        sql = """
            SELECT * FROM stream_sources
            WHERE lower(artist) = lower(?) AND lower(title) = lower(?)
        """
        params = [artist, title]
        if album:
            sql += " AND lower(ifnull(album, '')) = lower(?)"
            params.append(album)
        if healthy_only:
            sql += " AND health_status != 'degraded'"
        sql += " ORDER BY updated_at DESC LIMIT 1"
        c.execute(sql, params)
        return _parse_row(c.fetchone())


def mark_stream_source_failure(stream_source_id, error_message, health_status="degraded"):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            UPDATE stream_sources
            SET
                failure_count = failure_count + 1,
                health_status = ?,
                last_error = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (health_status, error_message, _now(), stream_source_id),
        )
        conn.commit()


def mark_stream_source_verified(stream_source_id, playable_url=None, expires_at=None, health_status="healthy"):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            UPDATE stream_sources
            SET
                playable_url = COALESCE(?, playable_url),
                expires_at = COALESCE(?, expires_at),
                last_verified_at = ?,
                health_status = ?,
                last_error = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (playable_url, expires_at, _now(), health_status, _now(), stream_source_id),
        )
        conn.commit()


def list_recent_stream_sources(hours=24, limit=100):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            SELECT * FROM stream_sources
            WHERE updated_at >= ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (cutoff, limit),
        )
        return [_parse_row(row) for row in c.fetchall()]


def create_radio_session(username, seed_type, seed_payload, queue_payload, status="active"):
    now = _now()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO radio_sessions (
                username, seed_type, seed_payload, current_index, queue_payload, status, started_at, updated_at
            )
            VALUES (?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (username, seed_type, _json_dump(seed_payload), _json_dump(queue_payload), status, now, now),
        )
        session_id = c.lastrowid
        c.execute("SELECT * FROM radio_sessions WHERE id = ?", (session_id,))
        row = c.fetchone()
        conn.commit()
    return _parse_row(row)


def get_radio_session(session_id):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM radio_sessions WHERE id = ?", (session_id,))
        return _parse_row(c.fetchone())


def update_radio_session(session_id, *, current_index=None, queue_payload=None, status=None, finished_at=None):
    updates = []
    params = []
    if current_index is not None:
        updates.append("current_index = ?")
        params.append(current_index)
    if queue_payload is not None:
        updates.append("queue_payload = ?")
        params.append(_json_dump(queue_payload))
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if finished_at is not None:
        updates.append("finished_at = ?")
        params.append(finished_at)
    updates.append("updated_at = ?")
    params.append(_now())
    params.append(session_id)
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(f"UPDATE radio_sessions SET {', '.join(updates)} WHERE id = ?", params)
        c.execute("SELECT * FROM radio_sessions WHERE id = ?", (session_id,))
        row = c.fetchone()
        conn.commit()
    return _parse_row(row)


def list_active_radio_sessions(limit=50):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            "SELECT * FROM radio_sessions WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        )
        return [_parse_row(row) for row in c.fetchall()]


def add_playback_event(
    *,
    username,
    artist,
    title,
    album=None,
    playback_type,
    event_type,
    session_id=None,
    position_seconds=None,
    source_name=None,
    source_url=None,
):
    now = _now()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO playback_events (
                username, session_id, artist, title, album, playback_type, event_type,
                position_seconds, source_name, source_url, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                session_id,
                artist,
                title,
                album,
                playback_type,
                event_type,
                position_seconds,
                source_name,
                source_url,
                now,
            ),
        )
        event_id = c.lastrowid
        c.execute("SELECT * FROM playback_events WHERE id = ?", (event_id,))
        row = c.fetchone()
        conn.commit()
    return dict(row)


def list_playback_events(username=None, session_id=None, artist=None, title=None, limit=100):
    with get_connection() as conn:
        c = conn.cursor()
        sql = "SELECT * FROM playback_events WHERE 1=1"
        params = []
        if username:
            sql += " AND username = ?"
            params.append(username)
        if session_id:
            sql += " AND session_id = ?"
            params.append(session_id)
        if artist:
            sql += " AND lower(artist) = lower(?)"
            params.append(artist)
        if title:
            sql += " AND lower(title) = lower(?)"
            params.append(title)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        c.execute(sql, params)
        return [dict(row) for row in c.fetchall()]


def get_playback_event_counts(username, artist, title, event_type=None, since_iso=None):
    with get_connection() as conn:
        c = conn.cursor()
        sql = """
            SELECT COUNT(*) FROM playback_events
            WHERE username = ? AND lower(artist) = lower(?) AND lower(title) = lower(?)
        """
        params = [username, artist, title]
        if event_type:
            sql += " AND event_type = ?"
            params.append(event_type)
        if since_iso:
            sql += " AND created_at >= ?"
            params.append(since_iso)
        c.execute(sql, params)
        row = c.fetchone()
    return row[0] if row else 0


def get_stream_failure_counts(artist, title):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            SELECT COALESCE(SUM(failure_count), 0)
            FROM stream_sources
            WHERE lower(artist) = lower(?) AND lower(title) = lower(?)
            """,
            (artist, title),
        )
        row = c.fetchone()
    return row[0] if row else 0
