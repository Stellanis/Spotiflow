def create_concerts_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS concerts (
            id TEXT PRIMARY KEY,
            artist TEXT,
            title TEXT,
            date TEXT,
            time TEXT,
            venue TEXT,
            city TEXT,
            country TEXT,
            url TEXT,
            image_url TEXT,
            source TEXT,
            lat REAL,
            lng REAL,
            created_at TIMESTAMP
        )
        """
    )

    cursor.execute("PRAGMA table_info(concerts)")
    columns = [info[1] for info in cursor.fetchall()]
    if "country" not in columns:
        print("Migrating database: adding country column to concerts")
        cursor.execute("ALTER TABLE concerts ADD COLUMN country TEXT")
    if "lat" not in columns:
        print("Migrating database: adding lat/lng columns to concerts")
        cursor.execute("ALTER TABLE concerts ADD COLUMN lat REAL")
        cursor.execute("ALTER TABLE concerts ADD COLUMN lng REAL")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS favorite_artists (
            artist TEXT PRIMARY KEY,
            created_at TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS concert_reminders (
            concert_id TEXT PRIMARY KEY,
            remind_at TIMESTAMP,
            created_at TIMESTAMP
        )
        """
    )
