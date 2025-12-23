import sqlite3
import os
from contextlib import contextmanager

# Adjust path: backend/database/core.py -> backend/data
# os.path.dirname(os.path.abspath(__file__)) is backend/database
# os.path.dirname(...) is backend
# os.path.join(..., "data") is backend/data
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_NAME = os.path.join(DATA_DIR, "downloads.db")

print(f"Database path: {os.path.abspath(DB_NAME)}")

def get_db_path():
    return DB_NAME

@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with get_connection() as conn:
        c = conn.cursor()
        
        # 1. Downloads Table
        c.execute('''
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
        ''')
        
        # Migration: Check if image_url column exists
        c.execute("PRAGMA table_info(downloads)")
        columns = [info[1] for info in c.fetchall()]
        if 'image_url' not in columns:
            print("Migrating database: adding image_url column")
            c.execute("ALTER TABLE downloads ADD COLUMN image_url TEXT")

        # 2. Settings Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')

        # Performance: Add index on created_at for fast pagination
        c.execute('CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at)')
            
        # 3. Playlists Tables
        c.execute('''
            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                description TEXT,
                type TEXT DEFAULT 'manual',
                rules TEXT,
                color TEXT,
                created_at TIMESTAMP
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS playlist_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER,
                song_query TEXT,
                position INTEGER,
                added_at TIMESTAMP,
                FOREIGN KEY(playlist_id) REFERENCES playlists(id),
                FOREIGN KEY(song_query) REFERENCES downloads(query)
            )
        ''')

        # 4. Concerts Table
        c.execute('''
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
        ''')

        # Migration: Check for new columns in playlists
        c.execute("PRAGMA table_info(playlists)")
        p_columns = [info[1] for info in c.fetchall()]
        if 'type' not in p_columns:
            print("Migrating database: adding type, rules, color columns to playlists")
            c.execute("ALTER TABLE playlists ADD COLUMN type TEXT DEFAULT 'manual'")
            c.execute("ALTER TABLE playlists ADD COLUMN rules TEXT")
            c.execute("ALTER TABLE playlists ADD COLUMN color TEXT")

        # Migration: Check for country/lat/lng in concerts
        c.execute("PRAGMA table_info(concerts)")
        c_columns = [info[1] for info in c.fetchall()]
        if 'country' not in c_columns:
             print("Migrating database: adding country column to concerts")
             c.execute("ALTER TABLE concerts ADD COLUMN country TEXT")

        if 'lat' not in c_columns:
             print("Migrating database: adding lat/lng columns to concerts")
             c.execute("ALTER TABLE concerts ADD COLUMN lat REAL")
             c.execute("ALTER TABLE concerts ADD COLUMN lng REAL")

        # 5. Favorite Artists Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS favorite_artists (
                artist TEXT PRIMARY KEY,
                created_at TIMESTAMP
            )
        ''')

        # 6. Concert Reminders Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS concert_reminders (
                concert_id TEXT PRIMARY KEY,
                remind_at TIMESTAMP,
                created_at TIMESTAMP
            )
        ''')
        
        # 7. Scrobbles Table
        c.execute('''
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
        ''')
        
        # Performance: Add index on user and timestamp
        c.execute('CREATE INDEX IF NOT EXISTS idx_scrobbles_user_ts ON scrobbles(user, timestamp DESC)')

        conn.commit()
