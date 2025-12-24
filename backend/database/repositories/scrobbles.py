from datetime import datetime
import sqlite3
from ..core import get_connection

def add_scrobble(user, artist, title, album, image_url, timestamp):
    with get_connection() as conn:
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

def get_scrobbles_from_db(user, limit=50, offset=0):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM scrobbles WHERE user = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?', (user, limit, offset))
        rows = c.fetchall()
        return [dict(row) for row in rows]

def get_latest_scrobble_timestamp(user):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT MAX(timestamp) FROM scrobbles WHERE user = ?', (user,))
        result = c.fetchone()
        return result[0] if result and result[0] else 0

def get_total_scrobbles_count(user):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT COUNT(*) FROM scrobbles WHERE user = ?', (user,))
        result = c.fetchone()
        return result[0] if result else 0

def get_scrobbles_in_range(user, start_ts, end_ts):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM scrobbles WHERE user = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC', (user, start_ts, end_ts))
        rows = c.fetchall()
        return [dict(row) for row in rows]

def get_all_scrobbles(user):
    # Streaming/Cursor usage needs manual connection management or yielding
    # But since original returned a cursor from a closed connection context (wait, original code closed connection? No.)
    # Original:
    # def get_all_scrobbles(user):
    #     conn = sqlite3.connect(DB_NAME)
    #     c = conn.cursor()
    #     c.execute(...)
    #     return c 
    # This leaves connection open and dangles it? That was a bug in original code probably.
    # Actually explicit .close() wasn't called on return.
    
    # New implementation: Return all rows (fetchall) to be safe, or use a generator
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM scrobbles WHERE user = ? ORDER BY timestamp ASC', (user,))
        rows = c.fetchall()
        return [dict(row) for row in rows]

def get_top_artists_from_db(user, limit=50, start_ts=0):
    with get_connection() as conn:
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
        return [{"name": row[0], "playcount": row[1]} for row in rows]

def get_top_tracks_from_db(user, limit=50, start_ts=0):
    with get_connection() as conn:
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
        return [{"artist": row[0], "title": row[1], "image": row[2], "playcount": row[3]} for row in rows]

def get_artist_top_tracks_from_db(user, artist, limit=10):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('''
            SELECT title, image_url, COUNT(*) as playcount 
            FROM scrobbles 
            WHERE user = ? AND artist LIKE ?
            GROUP BY title
            ORDER BY playcount DESC 
            LIMIT ?
        ''', (user, artist, limit))
        rows = c.fetchall()
        return [{"title": row[0], "image": row[1], "playcount": row[2]} for row in rows]
