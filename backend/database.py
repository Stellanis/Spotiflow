import sqlite3
from datetime import datetime
import os

DATA_DIR = "data"
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
        
    conn.commit()
    conn.close()

def add_download(query, artist, title, album, image_url=None, status="completed"):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO downloads (query, artist, title, album, image_url, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
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

def get_downloads():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM downloads ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]
