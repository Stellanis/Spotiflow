def create_scrobbles_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS scrobbles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            artist TEXT,
            title TEXT,
            album TEXT,
            image_url TEXT,
            timestamp INTEGER,
            created_at TIMESTAMP,
            UNIQUE(user, timestamp)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_scrobbles_user_ts ON scrobbles(user, timestamp DESC)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS dismissed_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            dismissed_at INTEGER NOT NULL,
            UNIQUE(username, artist, title)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dismissed_username ON dismissed_recommendations(username)")
