def create_playback_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS stream_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id INTEGER,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            album TEXT,
            source_name TEXT NOT NULL,
            source_url TEXT,
            playable_url TEXT,
            playback_type TEXT NOT NULL,
            resolver_payload TEXT,
            expires_at TEXT,
            last_verified_at TEXT,
            health_status TEXT DEFAULT 'healthy',
            failure_count INTEGER DEFAULT 0,
            last_error TEXT,
            promoted_to_download INTEGER DEFAULT 0,
            cache_key TEXT UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(track_id) REFERENCES tracks(id)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stream_sources_track_lookup ON stream_sources(artist, title, updated_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stream_sources_health ON stream_sources(health_status, updated_at DESC)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS radio_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            seed_type TEXT,
            seed_payload TEXT,
            current_index INTEGER DEFAULT 0,
            queue_payload TEXT,
            status TEXT DEFAULT 'active',
            started_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            finished_at TEXT
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_radio_sessions_username_status ON radio_sessions(username, status, updated_at DESC)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS playback_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            seed_type TEXT,
            seed_payload TEXT,
            current_index INTEGER DEFAULT 0,
            queue_payload TEXT,
            suspended_queue_payload TEXT,
            suspended_mode TEXT,
            started_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            finished_at TEXT
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_playback_sessions_username_status ON playback_sessions(username, status, updated_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_playback_sessions_mode_status ON playback_sessions(mode, status, updated_at DESC)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS playback_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            session_id INTEGER,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            album TEXT,
            playback_type TEXT NOT NULL,
            event_type TEXT NOT NULL,
            position_seconds REAL,
            source_name TEXT,
            source_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES playback_sessions(id)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_playback_events_user_track ON playback_events(username, artist, title, created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_playback_events_session ON playback_events(session_id, created_at DESC)")
