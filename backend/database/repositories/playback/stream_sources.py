from datetime import datetime, timedelta, timezone

from ...connection import get_connection
from .shared import json_dump, now_iso, parse_row


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
    now = now_iso()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
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
                json_dump(resolver_payload),
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
        cursor.execute("SELECT * FROM stream_sources WHERE cache_key = ?", (cache_key,))
        row = cursor.fetchone()
        conn.commit()
    return parse_row(row)


def get_stream_source(stream_source_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stream_sources WHERE id = ?", (stream_source_id,))
        return parse_row(cursor.fetchone())


def get_stream_source_by_cache_key(cache_key):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stream_sources WHERE cache_key = ?", (cache_key,))
        return parse_row(cursor.fetchone())


def find_recent_stream_source(artist, title, album=None, healthy_only=False):
    with get_connection() as conn:
        cursor = conn.cursor()
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
        cursor.execute(sql, params)
        return parse_row(cursor.fetchone())


def mark_stream_source_failure(stream_source_id, error_message, health_status="degraded"):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE stream_sources
            SET
                failure_count = failure_count + 1,
                health_status = ?,
                last_error = ?,
                playable_url = CASE WHEN ? = 'cooldown' THEN NULL ELSE playable_url END,
                updated_at = ?
            WHERE id = ?
            """,
            (health_status, error_message, health_status, now_iso(), stream_source_id),
        )
        conn.commit()


def mark_stream_source_verified(stream_source_id, playable_url=None, expires_at=None, health_status="healthy"):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE stream_sources
            SET
                playable_url = COALESCE(?, playable_url),
                expires_at = COALESCE(?, expires_at),
                last_verified_at = ?,
                health_status = ?,
                failure_count = 0,
                last_error = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (playable_url, expires_at, now_iso(), health_status, now_iso(), stream_source_id),
        )
        conn.commit()


def list_recent_stream_sources(hours=24, limit=100):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM stream_sources
            WHERE updated_at >= ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (cutoff, limit),
        )
        return [parse_row(row) for row in cursor.fetchall()]


def get_stream_failure_counts(artist, title):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT COALESCE(SUM(failure_count), 0)
            FROM stream_sources
            WHERE lower(artist) = lower(?) AND lower(title) = lower(?)
            """,
            (artist, title),
        )
        row = cursor.fetchone()
    return row[0] if row else 0
