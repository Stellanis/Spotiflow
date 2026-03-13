import time
from ..core import get_connection


def dismiss_track(username: str, artist: str, title: str) -> None:
    """Persist a dismissed recommendation so it won't reappear."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO dismissed_recommendations (username, artist, title, dismissed_at)
            VALUES (?, ?, ?, ?)
            """,
            (username, artist.lower(), title.lower(), int(time.time()))
        )
        conn.commit()


def get_dismissed_tracks(username: str) -> set:
    """Return a set of (artist_lower, title_lower) tuples for the user."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT artist, title FROM dismissed_recommendations WHERE username = ?",
            (username,)
        ).fetchall()
    return {(row["artist"], row["title"]) for row in rows}
