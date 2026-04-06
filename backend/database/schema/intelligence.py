def create_intelligence_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            musicbrainz_id TEXT,
            spotify_id TEXT,
            lastfm_url TEXT,
            genres TEXT,
            listeners INTEGER DEFAULT 0,
            popularity INTEGER,
            image_url TEXT,
            confidence REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artist_id INTEGER,
            name TEXT NOT NULL,
            musicbrainz_id TEXT,
            spotify_id TEXT,
            release_year INTEGER,
            album_type TEXT,
            cover_art_url TEXT,
            genres TEXT,
            confidence REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(artist_id, name),
            FOREIGN KEY(artist_id) REFERENCES artists(id)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id, name)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artist_id INTEGER,
            album_id INTEGER,
            name TEXT NOT NULL,
            musicbrainz_id TEXT,
            spotify_id TEXT,
            duration_seconds INTEGER,
            preview_url TEXT,
            popularity INTEGER,
            confidence REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(artist_id, album_id, name),
            FOREIGN KEY(artist_id) REFERENCES artists(id),
            FOREIGN KEY(album_id) REFERENCES albums(id)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_artist_album ON tracks(artist_id, album_id, name)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS artist_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artist_id INTEGER NOT NULL,
            alias TEXT NOT NULL UNIQUE,
            source TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(artist_id) REFERENCES artists(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS album_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            album_id INTEGER NOT NULL,
            alias TEXT NOT NULL,
            source TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(album_id, alias),
            FOREIGN KEY(album_id) REFERENCES albums(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS track_enrichment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id INTEGER NOT NULL,
            source TEXT NOT NULL,
            payload TEXT,
            refreshed_at TEXT NOT NULL,
            UNIQUE(track_id, source),
            FOREIGN KEY(track_id) REFERENCES tracks(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS listening_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            finished_at INTEGER NOT NULL,
            scrobble_count INTEGER NOT NULL,
            duration_minutes INTEGER NOT NULL,
            dominant_artist TEXT,
            dominant_genre TEXT,
            discovery_ratio REAL DEFAULT 0,
            repeat_ratio REAL DEFAULT 0,
            album_focused INTEGER DEFAULT 0,
            shuffle_heavy INTEGER DEFAULT 0,
            summary TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(username, started_at, finished_at)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_username_time ON listening_sessions(username, started_at DESC)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS recommendation_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            feedback_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(username, artist, title, feedback_type)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_feedback_username_type ON recommendation_feedback(username, feedback_type)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS ignored_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            item_type TEXT NOT NULL,
            artist TEXT,
            title TEXT,
            album TEXT,
            reason TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_ignored_items_unique ON ignored_items(username, item_type, ifnull(artist, ''), ifnull(title, ''), ifnull(album, ''))"
    )
