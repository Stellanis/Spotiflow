def create_playlists_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            description TEXT,
            type TEXT DEFAULT 'manual',
            rules TEXT,
            color TEXT,
            created_at TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS playlist_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER,
            song_query TEXT,
            position INTEGER,
            added_at TIMESTAMP,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id),
            FOREIGN KEY(song_query) REFERENCES downloads(query)
        )
        """
    )

    cursor.execute("PRAGMA table_info(playlists)")
    columns = [info[1] for info in cursor.fetchall()]
    if "type" not in columns:
        print("Migrating database: adding type, rules, color columns to playlists")
        cursor.execute("ALTER TABLE playlists ADD COLUMN type TEXT DEFAULT 'manual'")
        cursor.execute("ALTER TABLE playlists ADD COLUMN rules TEXT")
        cursor.execute("ALTER TABLE playlists ADD COLUMN color TEXT")
