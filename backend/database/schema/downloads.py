def create_downloads_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT UNIQUE,
            artist TEXT,
            title TEXT,
            album TEXT,
            image_url TEXT,
            status TEXT,
            created_at TIMESTAMP
        )
        """
    )

    cursor.execute("PRAGMA table_info(downloads)")
    download_columns = [info[1] for info in cursor.fetchall()]
    if "source_url" not in download_columns:
        cursor.execute("ALTER TABLE downloads ADD COLUMN source_url TEXT")
    if "match_confidence" not in download_columns:
        cursor.execute("ALTER TABLE downloads ADD COLUMN match_confidence REAL")
    if "alternate_candidate_count" not in download_columns:
        cursor.execute("ALTER TABLE downloads ADD COLUMN alternate_candidate_count INTEGER DEFAULT 0")
    if "last_error" not in download_columns:
        cursor.execute("ALTER TABLE downloads ADD COLUMN last_error TEXT")

    cursor.execute("PRAGMA table_info(downloads)")
    columns = [info[1] for info in cursor.fetchall()]
    if "image_url" not in columns:
        print("Migrating database: adding image_url column")
        cursor.execute("ALTER TABLE downloads ADD COLUMN image_url TEXT")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at)")
