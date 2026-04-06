def create_releases_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS release_watch_artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artist TEXT NOT NULL UNIQUE,
            source TEXT NOT NULL,
            weight INTEGER DEFAULT 1,
            last_seen_at TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS artist_releases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            release_date TEXT,
            release_type TEXT,
            source TEXT NOT NULL,
            url TEXT,
            image_url TEXT,
            listened INTEGER DEFAULT 0,
            downloaded INTEGER DEFAULT 0,
            added_to_playlist INTEGER DEFAULT 0,
            ignored INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_artist_releases_artist ON artist_releases(artist, release_date DESC)")
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_releases_unique ON artist_releases(artist, title, ifnull(release_date, ''), source)"
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS feature_refresh_state (
            feature_key TEXT PRIMARY KEY,
            refreshed_at TEXT NOT NULL
        )
        """
    )
