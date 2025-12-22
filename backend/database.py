import sqlite3
from datetime import datetime
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_NAME = os.path.join(DATA_DIR, "downloads.db")
print(f"Database path: {os.path.abspath(DB_NAME)}")

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
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
    
    # Migration: Check if image_url column exists, if not add it
    c.execute("PRAGMA table_info(downloads)")
    columns = [info[1] for info in c.fetchall()]
    if 'image_url' not in columns:
        print("Migrating database: adding image_url column")
        c.execute("ALTER TABLE downloads ADD COLUMN image_url TEXT")

    # Create settings table
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    # Performance: Add index on created_at for fast pagination
    c.execute('CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at)')
        
    # Create Playlists tables
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

    # Create Concerts table
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

    # Migration: Check for country in concerts
    c.execute("PRAGMA table_info(concerts)")
    c_columns = [info[1] for info in c.fetchall()]
    if 'country' not in c_columns:
         print("Migrating database: adding country column to concerts")
         c.execute("ALTER TABLE concerts ADD COLUMN country TEXT")

    # Create Favorite Artists table
    c.execute('''
        CREATE TABLE IF NOT EXISTS favorite_artists (
            artist TEXT PRIMARY KEY,
            created_at TIMESTAMP
        )
    ''')

    # Create Concert Reminders table
    c.execute('''
        CREATE TABLE IF NOT EXISTS concert_reminders (
            concert_id TEXT PRIMARY KEY,
            remind_at TIMESTAMP,
            created_at TIMESTAMP
        )
    ''')
    # Create Scrobbles table
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
    conn.close()

def add_scrobble(user, artist, title, album, image_url, timestamp):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO scrobbles (user, artist, title, album, image_url, timestamp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user, timestamp) DO UPDATE SET
                artist=excluded.artist,
                title=excluded.title,
                album=excluded.album,
                image_url=excluded.image_url
        ''', (user, artist, title, album, image_url, timestamp, datetime.now()))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adding scrobble: {e}")
        return False
    finally:
        conn.close()

def get_scrobbles_from_db(user, limit=50, offset=0):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM scrobbles WHERE user = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?', (user, limit, offset))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_latest_scrobble_timestamp(user):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT MAX(timestamp) FROM scrobbles WHERE user = ?', (user,))
    result = c.fetchone()
    conn.close()
    return result[0] if result and result[0] else 0

def get_total_scrobbles_count(user):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM scrobbles WHERE user = ?', (user,))
    result = c.fetchone()
    conn.close()
    return result[0] if result else 0

def get_scrobbles_in_range(user, start_ts, end_ts):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM scrobbles WHERE user = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC', (user, start_ts, end_ts))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_scrobbles(user):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()  # Removed server-side cursor for sqlite compatibility
    c.execute('SELECT * FROM scrobbles WHERE user = ? ORDER BY timestamp ASC', (user,))
    return c # Return cursor/iterator for streaming? SQLite in python usually fetches all. 
    # For large datasets (years), we might want to batch. 
    # But for now, let's just use `fetchall` for simplicity or let the service handle it.
    # Actually, for analytics, we often do aggregation in SQL.

def get_top_artists_from_db(user, limit=50, start_ts=0):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        SELECT artist, COUNT(*) as playcount 
        FROM scrobbles 
        WHERE user = ? AND timestamp >= ?
        GROUP BY artist 
        ORDER BY playcount DESC 
        LIMIT ?
    ''', (user, start_ts, limit))
    rows = c.fetchall()
    conn.close()
    return [{"name": row[0], "playcount": row[1]} for row in rows]

def get_top_tracks_from_db(user, limit=50, start_ts=0):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        SELECT artist, title, image_url, COUNT(*) as playcount 
        FROM scrobbles 
        WHERE user = ? AND timestamp >= ?
        GROUP BY artist, title
        ORDER BY playcount DESC 
        LIMIT ?
    ''', (user, start_ts, limit))
    rows = c.fetchall()
    conn.close()
    return [{"artist": row[0], "title": row[1], "image": row[2], "playcount": row[3]} for row in rows]


def add_download(query, artist, title, album, image_url=None, status="completed"):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO downloads (query, artist, title, album, image_url, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(query) DO UPDATE SET
                artist=excluded.artist,
                title=excluded.title,
                album=excluded.album,
                image_url=COALESCE(excluded.image_url, downloads.image_url),
                status=excluded.status,
                created_at=excluded.created_at
        ''', (query, artist, title, album, image_url, status, datetime.now()))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def is_downloaded(query):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT id FROM downloads WHERE query = ? AND status = "completed"', (query,))
    result = c.fetchone()
    conn.close()
    return result is not None

def get_download_info(query):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM downloads WHERE query = ? AND status = "completed"', (query,))
    result = c.fetchone()
    conn.close()
    return dict(result) if result else None

def get_download_status(query):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT status FROM downloads WHERE query = ?', (query,))
    result = c.fetchone()
    conn.close()
    return result[0] if result else None

def get_downloads(page=1, limit=50, status=None, search_query=None, artist=None, album=None):
    offset = (page - 1) * limit
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    query_parts = ["SELECT * FROM downloads"]
    params = []
    conditions = []
    
    if status:
        conditions.append("status = ?")
        params.append(status)
        
    if search_query:
        search_term = f"%{search_query}%"
        conditions.append("(title LIKE ? OR artist LIKE ? OR album LIKE ?)")
        params.extend([search_term, search_term, search_term])


    if artist:
        conditions.append("artist = ?")
        params.append(artist)

    if album:
        conditions.append("album = ?")
        params.append(album)
        
    if conditions:
        query_parts.append("WHERE " + " AND ".join(conditions))
        
    query_parts.append("ORDER BY created_at DESC LIMIT ? OFFSET ?")
    params.extend([limit, offset])
    
    sql = " ".join(query_parts)
    c.execute(sql, params)
        
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_pending_downloads():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM downloads WHERE status = "pending"')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_total_downloads_count(status=None, search_query=None, artist=None, album=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    query_parts = ["SELECT COUNT(*) FROM downloads"]
    params = []
    conditions = []
    
    if status:
        conditions.append("status = ?")
        params.append(status)
        
    if search_query:
        search_term = f"%{search_query}%"
        conditions.append("(title LIKE ? OR artist LIKE ? OR album LIKE ?)")
        params.extend([search_term, search_term, search_term])

    if artist:
        conditions.append("artist = ?")
        params.append(artist)

    if album:
        conditions.append("album = ?")
        params.append(album)
        
    if conditions:
        query_parts.append("WHERE " + " AND ".join(conditions))
        
    sql = " ".join(query_parts)
    c.execute(sql, params)
        
    count = c.fetchone()[0]
    conn.close()
    return count

def get_all_artists():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Try fetching from scrobbles table first for play counts for better relevance
    try:
        c.execute('SELECT artist, COUNT(*) as count FROM scrobbles GROUP BY artist ORDER BY count DESC')
        rows = c.fetchall()
        if rows:
            return [row[0] for row in rows if row[0]]
    except Exception:
        pass
        
    # Fallback to downloads table
    c.execute('SELECT DISTINCT artist FROM downloads WHERE status = "completed" ORDER BY artist')
    rows = c.fetchall()
    conn.close()
    return [row[0] for row in rows if row[0]]

def get_all_albums(artist=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if artist:
        c.execute('SELECT DISTINCT album FROM downloads WHERE status = "completed" AND artist = ? ORDER BY album', (artist,))
    else:
        c.execute('SELECT DISTINCT album FROM downloads WHERE status = "completed" ORDER BY album')
    rows = c.fetchall()
    conn.close()
    return [row[0] for row in rows if row[0]]

def get_setting(key, default=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT value FROM settings WHERE key = ?', (key,))
    result = c.fetchone()
    conn.close()
    return result[0] if result else default

def set_setting(key, value):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
    conn.commit()
    conn.close()

def get_all_settings():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT key, value FROM settings')
    rows = c.fetchall()
    conn.close()
    return {row[0]: row[1] for row in rows}

def add_concert(concert_id, artist, title, date, time, venue, city, country, url, image_url, source):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO concerts (id, artist, title, date, time, venue, city, country, url, image_url, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                artist=excluded.artist,
                title=excluded.title,
                date=excluded.date,
                time=excluded.time,
                venue=excluded.venue,
                city=excluded.city,
                country=excluded.country,
                url=excluded.url,
                image_url=excluded.image_url,
                source=excluded.source,
                created_at=excluded.created_at
        ''', (concert_id, artist, title, date, time, venue, city, country, url, image_url, source, datetime.now()))
        conn.commit()
    except Exception as e:
        print(f"Error adding concert: {e}")
    finally:
        conn.close()

def get_cached_concerts(city=None):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    query = "SELECT * FROM concerts"
    params = []
    
    if city:
        query += " WHERE city LIKE ?"
        params.append(f"%{city}%")
        
    query += " ORDER BY date ASC"
    
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_concerts(city=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if city:
        c.execute("DELETE FROM concerts WHERE city LIKE ?", (f"%{city}%",))
    else:
        c.execute("DELETE FROM concerts")
    conn.commit()
    conn.close()

def add_favorite_artist(artist):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('INSERT OR IGNORE INTO favorite_artists (artist, created_at) VALUES (?, ?)', (artist, datetime.now()))
        conn.commit()
        return True
    finally:
        conn.close()

def remove_favorite_artist(artist):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('DELETE FROM favorite_artists WHERE artist = ?', (artist,))
        conn.commit()
        return True
    finally:
        conn.close()

def get_favorite_artists():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Ensure table exists (for existing dbs running this code before restart)
    # Actually init_db runs on startup.
    try:
        c.execute('SELECT artist FROM favorite_artists ORDER BY artist')
        rows = c.fetchall()
        return [row[0] for row in rows]
    except:
        return []
    finally:
        conn.close()

def add_reminder(concert_id, remind_at=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('INSERT OR REPLACE INTO concert_reminders (concert_id, remind_at, created_at) VALUES (?, ?, ?)', (concert_id, remind_at, datetime.now()))
        conn.commit()
        return True
    finally:
        conn.close()

def remove_reminder(concert_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('DELETE FROM concert_reminders WHERE concert_id = ?', (concert_id,))
        conn.commit()
        return True
    finally:
        conn.close()

def get_reminders():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('SELECT concert_id FROM concert_reminders')
        rows = c.fetchall()
        return [row[0] for row in rows]
    except:
        return []
    finally:
        conn.close()


def is_reminder_set(concert_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('SELECT 1 FROM concert_reminders WHERE concert_id = ?', (concert_id,))
        result = c.fetchone()
        return result is not None
    finally:
        conn.close()

def delete_past_concerts(current_date):
    """
    Delete concerts where date is strictly less than current_date (YYYY-MM-DD).
    """
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        # Date is stored as TEXT YYYY-MM-DD, so string comparison works
        c.execute('DELETE FROM concerts WHERE date < ?', (current_date,))
        deleted_count = c.rowcount
        conn.commit()
        if deleted_count > 0:
            print(f"Deleted {deleted_count} past concerts from database.")
    except Exception as e:
        print(f"Error deleting past concerts: {e}")
    finally:
        conn.close()

