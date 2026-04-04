import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime

# Adjust path: backend/database/core.py -> backend/data
# os.path.dirname(os.path.abspath(__file__)) is backend/database
# os.path.dirname(...) is backend
# os.path.join(..., "data") is backend/data
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_NAME = os.path.join(DATA_DIR, "downloads.db")

print(f"Database path: {os.path.abspath(DB_NAME)}")

def get_db_path():
    try:
        import database
        return getattr(database, "DB_NAME", DB_NAME)
    except Exception:
        return DB_NAME

@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    db_path = get_db_path()
    data_dir = os.path.dirname(db_path)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

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

        # Track download matching diagnostics and confidence.
        c.execute("PRAGMA table_info(downloads)")
        download_columns = [info[1] for info in c.fetchall()]
        if 'source_url' not in download_columns:
            c.execute("ALTER TABLE downloads ADD COLUMN source_url TEXT")
        if 'match_confidence' not in download_columns:
            c.execute("ALTER TABLE downloads ADD COLUMN match_confidence REAL")
        if 'alternate_candidate_count' not in download_columns:
            c.execute("ALTER TABLE downloads ADD COLUMN alternate_candidate_count INTEGER DEFAULT 0")
        if 'last_error' not in download_columns:
            c.execute("ALTER TABLE downloads ADD COLUMN last_error TEXT")
        
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

        # 8. Dismissed Recommendations Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS dismissed_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                artist TEXT NOT NULL,
                title TEXT NOT NULL,
                dismissed_at INTEGER NOT NULL,
                UNIQUE(username, artist, title)
            )
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_dismissed_username ON dismissed_recommendations(username)')

        # 9. Durable Jobs
        c.execute('''
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_type TEXT NOT NULL,
                area TEXT NOT NULL,
                status TEXT NOT NULL,
                query TEXT,
                artist TEXT,
                title TEXT,
                album TEXT,
                payload TEXT,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                source_url TEXT,
                match_confidence REAL,
                alternate_candidate_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT
            )
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, job_type, created_at DESC)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_jobs_query ON jobs(query)')

        c.execute('''
            CREATE TABLE IF NOT EXISTS job_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                message TEXT,
                payload TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(id)
            )
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id, created_at DESC)')

        # 10. Canonical music intelligence
        c.execute('''
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
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)')

        c.execute('''
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
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id, name)')

        c.execute('''
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
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_tracks_artist_album ON tracks(artist_id, album_id, name)')

        c.execute('''
            CREATE TABLE IF NOT EXISTS artist_aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artist_id INTEGER NOT NULL,
                alias TEXT NOT NULL UNIQUE,
                source TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(artist_id) REFERENCES artists(id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS album_aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id INTEGER NOT NULL,
                alias TEXT NOT NULL,
                source TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(album_id, alias),
                FOREIGN KEY(album_id) REFERENCES albums(id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS track_enrichment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                payload TEXT,
                refreshed_at TEXT NOT NULL,
                UNIQUE(track_id, source),
                FOREIGN KEY(track_id) REFERENCES tracks(id)
            )
        ''')

        c.execute('''
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
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_sessions_username_time ON listening_sessions(username, started_at DESC)')

        # 11. Recommendation feedback and ignore state
        c.execute('''
            CREATE TABLE IF NOT EXISTS recommendation_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                artist TEXT NOT NULL,
                title TEXT NOT NULL,
                feedback_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(username, artist, title, feedback_type)
            )
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_feedback_username_type ON recommendation_feedback(username, feedback_type)')

        c.execute('''
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
        ''')
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_ignored_items_unique ON ignored_items(username, item_type, ifnull(artist, ''), ifnull(title, ''), ifnull(album, ''))")

        # 12. Release tracking
        c.execute('''
            CREATE TABLE IF NOT EXISTS release_watch_artists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artist TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL,
                weight INTEGER DEFAULT 1,
                last_seen_at TEXT NOT NULL
            )
        ''')

        c.execute('''
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
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_artist_releases_artist ON artist_releases(artist, release_date DESC)')
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_releases_unique ON artist_releases(artist, title, ifnull(release_date, ''), source)")

        # 13. Feature refresh tracking
        c.execute('''
            CREATE TABLE IF NOT EXISTS feature_refresh_state (
                feature_key TEXT PRIMARY KEY,
                refreshed_at TEXT NOT NULL
            )
        ''')

        conn.commit()
