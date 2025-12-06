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
        
    conn.commit()
    conn.close()

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

def get_downloads(page=1, limit=50, status=None, search_query=None):
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

def get_total_downloads_count(status=None, search_query=None):
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
        
    if conditions:
        query_parts.append("WHERE " + " AND ".join(conditions))
        
    sql = " ".join(query_parts)
    c.execute(sql, params)
        
    count = c.fetchone()[0]
    conn.close()
    return count

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
