from datetime import datetime
import sqlite3
from ..core import get_connection

def add_download(query, artist, title, album, image_url=None, status="completed"):
    with get_connection() as conn:
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

def is_downloaded(query):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT id FROM downloads WHERE query = ? AND status = "completed"', (query,))
        result = c.fetchone()
        return result is not None

def get_downloads_batch(queries):
    """
    Efficiently check status for multiple queries in one go.
    Returns a dictionary {query: download_info_dict} for found items.
    """
    if not queries:
        return {}
        
    with get_connection() as conn:
        c = conn.cursor()
        
        # SQLite has a limit on variables, but 50-100 is fine.
        placeholders = ','.join(['?'] * len(queries))
        sql = f"SELECT * FROM downloads WHERE query IN ({placeholders}) AND status = 'completed'"
        
        try:
            c.execute(sql, queries)
            rows = c.fetchall()
            return {row['query']: dict(row) for row in rows}
        except Exception as e:
            print(f"Error in batch download check: {e}")
            return {}

def get_download_info(query):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM downloads WHERE query = ? AND status = "completed"', (query,))
        result = c.fetchone()
        return dict(result) if result else None

def get_download_status(query):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT status FROM downloads WHERE query = ?', (query,))
        result = c.fetchone()
        return result[0] if result else None

def get_downloads(page=1, limit=50, status=None, search_query=None, artist=None, album=None):
    offset = (page - 1) * limit
    with get_connection() as conn:
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
        return [dict(row) for row in rows]

def get_all_pending_downloads():
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM downloads WHERE status = "pending"')
        rows = c.fetchall()
        return [dict(row) for row in rows]

def get_total_downloads_count(status=None, search_query=None, artist=None, album=None):
    with get_connection() as conn:
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
        return count

def get_all_artists():
    with get_connection() as conn:
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
        return [row[0] for row in rows if row[0]]

def get_all_artists_with_counts():
    """
    Returns a dictionary {artist_name: play_count}
    """
    scores = {}
    with get_connection() as conn:
        c = conn.cursor()
        
        # 1. From Scrobbles
        try:
            c.execute('SELECT artist, COUNT(*) as count FROM scrobbles GROUP BY artist')
            rows = c.fetchall()
            for row in rows:
                if row[0]:
                    scores[row[0]] = row[1]
        except Exception:
            pass
            
        # 2. From Downloads (Fallback - give them score of 1 if not present)
        try:
            c.execute('SELECT DISTINCT artist FROM downloads WHERE status = "completed"')
            rows = c.fetchall()
            for row in rows:
                artist = row[0]
                if artist and artist not in scores:
                    scores[artist] = 1 # Minimum score for existing artists
        except Exception:
            pass
            
        return scores

def get_all_albums(artist=None):
    with get_connection() as conn:
        c = conn.cursor()
        if artist:
            c.execute('SELECT DISTINCT album FROM downloads WHERE status = "completed" AND artist = ? ORDER BY album', (artist,))
        else:
            c.execute('SELECT DISTINCT album FROM downloads WHERE status = "completed" ORDER BY album')
        rows = c.fetchall()
        return [row[0] for row in rows if row[0]]
