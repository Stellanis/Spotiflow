from ...connection import get_connection
from .shared import now_iso


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
    now = now_iso()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
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
        event_id = cursor.lastrowid
        cursor.execute("SELECT * FROM playback_events WHERE id = ?", (event_id,))
        row = cursor.fetchone()
        conn.commit()
    return dict(row)


def list_playback_events(username=None, session_id=None, artist=None, title=None, limit=100):
    with get_connection() as conn:
        cursor = conn.cursor()
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
        cursor.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]


def get_playback_event_counts(username, artist, title, event_type=None, since_iso=None):
    with get_connection() as conn:
        cursor = conn.cursor()
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
        cursor.execute(sql, params)
        row = cursor.fetchone()
    return row[0] if row else 0
