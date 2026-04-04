import json
from datetime import datetime, timezone

from ..core import get_connection


def _now():
    return datetime.now(timezone.utc).isoformat()


def upsert_artist(name, musicbrainz_id=None, genres=None, listeners=0, image_url=None, confidence=0.5):
    now = _now()
    genres_value = ",".join(genres) if isinstance(genres, list) else genres
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO artists (name, musicbrainz_id, genres, listeners, image_url, confidence, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                musicbrainz_id = COALESCE(excluded.musicbrainz_id, artists.musicbrainz_id),
                genres = COALESCE(excluded.genres, artists.genres),
                listeners = CASE WHEN excluded.listeners > artists.listeners THEN excluded.listeners ELSE artists.listeners END,
                image_url = COALESCE(excluded.image_url, artists.image_url),
                confidence = CASE WHEN excluded.confidence > artists.confidence THEN excluded.confidence ELSE artists.confidence END,
                updated_at = excluded.updated_at
            """,
            (name, musicbrainz_id, genres_value, listeners, image_url, confidence, now, now),
        )
        c.execute("SELECT id, name, musicbrainz_id, genres, listeners, image_url, confidence FROM artists WHERE name = ?", (name,))
        row = c.fetchone()
        conn.commit()
    return dict(row)


def upsert_album(artist_id, name, musicbrainz_id=None, release_year=None, album_type=None, cover_art_url=None, genres=None, confidence=0.5):
    now = _now()
    genres_value = ",".join(genres) if isinstance(genres, list) else genres
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO albums (artist_id, name, musicbrainz_id, release_year, album_type, cover_art_url, genres, confidence, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(artist_id, name) DO UPDATE SET
                musicbrainz_id = COALESCE(excluded.musicbrainz_id, albums.musicbrainz_id),
                release_year = COALESCE(excluded.release_year, albums.release_year),
                album_type = COALESCE(excluded.album_type, albums.album_type),
                cover_art_url = COALESCE(excluded.cover_art_url, albums.cover_art_url),
                genres = COALESCE(excluded.genres, albums.genres),
                confidence = CASE WHEN excluded.confidence > albums.confidence THEN excluded.confidence ELSE albums.confidence END,
                updated_at = excluded.updated_at
            """,
            (artist_id, name, musicbrainz_id, release_year, album_type, cover_art_url, genres_value, confidence, now, now),
        )
        c.execute("SELECT * FROM albums WHERE artist_id = ? AND name = ?", (artist_id, name))
        row = c.fetchone()
        conn.commit()
    return dict(row)


def upsert_track(artist_id, album_id, name, duration_seconds=None, preview_url=None, popularity=None, confidence=0.5):
    now = _now()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO tracks (artist_id, album_id, name, duration_seconds, preview_url, popularity, confidence, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(artist_id, album_id, name) DO UPDATE SET
                duration_seconds = COALESCE(excluded.duration_seconds, tracks.duration_seconds),
                preview_url = COALESCE(excluded.preview_url, tracks.preview_url),
                popularity = COALESCE(excluded.popularity, tracks.popularity),
                confidence = CASE WHEN excluded.confidence > tracks.confidence THEN excluded.confidence ELSE tracks.confidence END,
                updated_at = excluded.updated_at
            """,
            (artist_id, album_id, name, duration_seconds, preview_url, popularity, confidence, now, now),
        )
        c.execute("SELECT * FROM tracks WHERE artist_id = ? AND album_id IS ? AND name = ?", (artist_id, album_id, name))
        row = c.fetchone()
        conn.commit()
    return dict(row)


def upsert_artist_alias(artist_id, alias, source):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT OR IGNORE INTO artist_aliases (artist_id, alias, source, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (artist_id, alias, source, _now()),
        )
        conn.commit()


def upsert_album_alias(album_id, alias, source):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT OR IGNORE INTO album_aliases (album_id, alias, source, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (album_id, alias, source, _now()),
        )
        conn.commit()


def upsert_track_enrichment(track_id, source, payload):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO track_enrichment (track_id, source, payload, refreshed_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(track_id, source) DO UPDATE SET
                payload = excluded.payload,
                refreshed_at = excluded.refreshed_at
            """,
            (track_id, source, json.dumps(payload), _now()),
        )
        conn.commit()


def list_enriched_tracks(limit=50):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            SELECT
                t.id,
                t.name,
                t.duration_seconds,
                t.preview_url,
                t.popularity,
                t.confidence,
                a.name AS artist,
                al.name AS album,
                al.cover_art_url
            FROM tracks t
            JOIN artists a ON a.id = t.artist_id
            LEFT JOIN albums al ON al.id = t.album_id
            ORDER BY t.updated_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = c.fetchall()
    return [dict(row) for row in rows]


def replace_sessions(username, sessions):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM listening_sessions WHERE username = ?", (username,))
        c.executemany(
            """
            INSERT INTO listening_sessions (
                username, started_at, finished_at, scrobble_count, duration_minutes,
                dominant_artist, dominant_genre, discovery_ratio, repeat_ratio,
                album_focused, shuffle_heavy, summary, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    username,
                    session["started_at"],
                    session["finished_at"],
                    session["scrobble_count"],
                    session["duration_minutes"],
                    session.get("dominant_artist"),
                    session.get("dominant_genre"),
                    session.get("discovery_ratio", 0),
                    session.get("repeat_ratio", 0),
                    1 if session.get("album_focused") else 0,
                    1 if session.get("shuffle_heavy") else 0,
                    session.get("summary"),
                    _now(),
                )
                for session in sessions
            ],
        )
        conn.commit()


def get_sessions(username, limit=50):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            "SELECT * FROM listening_sessions WHERE username = ? ORDER BY started_at DESC LIMIT ?",
            (username, limit),
        )
        rows = c.fetchall()
    return [dict(row) for row in rows]


def add_feedback(username, artist, title, feedback_type):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT OR IGNORE INTO recommendation_feedback (username, artist, title, feedback_type, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (username, artist, title, feedback_type, _now()),
        )
        conn.commit()


def get_feedback_map(username):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            "SELECT artist, title, feedback_type FROM recommendation_feedback WHERE username = ?",
            (username,),
        )
        rows = c.fetchall()
    feedback = {}
    for row in rows:
        key = ((row["artist"] or "").lower(), (row["title"] or "").lower())
        feedback.setdefault(key, set()).add(row["feedback_type"])
    return feedback


def ignore_item(username, item_type, artist=None, title=None, album=None, reason=None):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT OR IGNORE INTO ignored_items (username, item_type, artist, title, album, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (username, item_type, artist, title, album, reason, _now()),
        )
        conn.commit()


def get_ignored_items(username, item_type=None):
    with get_connection() as conn:
        c = conn.cursor()
        if item_type:
            c.execute("SELECT * FROM ignored_items WHERE username = ? AND item_type = ?", (username, item_type))
        else:
            c.execute("SELECT * FROM ignored_items WHERE username = ?", (username,))
        rows = c.fetchall()
    return [dict(row) for row in rows]


def upsert_release_watch_artist(artist, source, weight=1):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO release_watch_artists (artist, source, weight, last_seen_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(artist) DO UPDATE SET
                source = excluded.source,
                weight = CASE WHEN excluded.weight > release_watch_artists.weight THEN excluded.weight ELSE release_watch_artists.weight END,
                last_seen_at = excluded.last_seen_at
            """,
            (artist, source, weight, _now()),
        )
        conn.commit()


def list_release_watch_artists(limit=100):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM release_watch_artists ORDER BY weight DESC, artist ASC LIMIT ?", (limit,))
        rows = c.fetchall()
    return [dict(row) for row in rows]


def upsert_artist_release(artist, title, release_date, release_type, source, url=None, image_url=None):
    now = _now()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT OR IGNORE INTO artist_releases (
                artist, title, release_date, release_type, source, url, image_url, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (artist, title, release_date, release_type, source, url, image_url, now, now),
        )
        c.execute(
            """
            UPDATE artist_releases
            SET
                release_type = COALESCE(?, release_type),
                url = COALESCE(?, url),
                image_url = COALESCE(?, image_url),
                updated_at = ?
            WHERE artist = ? AND title = ? AND ifnull(release_date, '') = ifnull(?, '') AND source = ?
            """,
            (release_type, url, image_url, now, artist, title, release_date, source),
        )
        conn.commit()


def list_releases(limit=100, include_ignored=False):
    sql = "SELECT * FROM artist_releases"
    params = []
    if not include_ignored:
        sql += " WHERE ignored = 0"
    sql += " ORDER BY release_date DESC, updated_at DESC LIMIT ?"
    params.append(limit)
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(sql, params)
        rows = c.fetchall()
    return [dict(row) for row in rows]


def mark_release_state(release_id, field, value):
    if field not in {"listened", "downloaded", "added_to_playlist", "ignored"}:
        return
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(f"UPDATE artist_releases SET {field} = ?, updated_at = ? WHERE id = ?", (value, _now(), release_id))
        conn.commit()


def set_feature_refresh_state(feature_key):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO feature_refresh_state (feature_key, refreshed_at)
            VALUES (?, ?)
            ON CONFLICT(feature_key) DO UPDATE SET refreshed_at = excluded.refreshed_at
            """,
            (feature_key, _now()),
        )
        conn.commit()


def get_feature_refresh_state(feature_key):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT refreshed_at FROM feature_refresh_state WHERE feature_key = ?", (feature_key,))
        row = c.fetchone()
    return row["refreshed_at"] if row else None
