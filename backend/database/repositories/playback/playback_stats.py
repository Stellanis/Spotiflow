from datetime import datetime, timedelta, timezone

from ...connection import get_connection


def get_streaming_dashboard_stats(hours=24):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM playback_sessions WHERE mode = 'radio' AND status IN ('active', 'paused')")
        active_radio_sessions = cursor.fetchone()[0]

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_recent,
                SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) AS healthy_recent,
                SUM(CASE WHEN health_status = 'degraded' THEN 1 ELSE 0 END) AS degraded_recent
            FROM stream_sources
            WHERE updated_at >= ?
            """,
            (cutoff,),
        )
        stream_row = cursor.fetchone()
        total_recent = stream_row["total_recent"] or 0
        healthy_recent = stream_row["healthy_recent"] or 0
        degraded_recent = stream_row["degraded_recent"] or 0

        cursor.execute("SELECT COUNT(*) FROM stream_sources WHERE promoted_to_download = 1")
        promoted_downloads = cursor.fetchone()[0]

    resolve_success_rate = round((healthy_recent / total_recent) * 100, 2) if total_recent else None
    return {
        "active_radio_sessions": active_radio_sessions,
        "recent_stream_resolutions": total_recent,
        "healthy_recent_streams": healthy_recent,
        "degraded_recent_streams": degraded_recent,
        "resolve_success_rate": resolve_success_rate,
        "promoted_downloads": promoted_downloads,
    }
