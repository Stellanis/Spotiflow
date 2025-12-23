from datetime import datetime
import sqlite3
import json
from ..core import get_connection

def get_playlists_with_stats():
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('''
            SELECT p.*, COUNT(ps.id) as song_count 
            FROM playlists p 
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id 
            GROUP BY p.id
            ORDER BY p.created_at DESC
        ''')
        rows = c.fetchall()
        
        playlists = []
        for row in rows:
            p = dict(row)
            # Fetch up to 4 images for the collage
            c.execute('''
                SELECT DISTINCT d.image_url 
                FROM playlist_songs ps 
                JOIN downloads d ON ps.song_query = d.query 
                WHERE ps.playlist_id = ? AND d.image_url IS NOT NULL AND d.image_url != ''
                ORDER BY ps.position ASC 
                LIMIT 4
            ''', (p['id'],))
            images = [r[0] for r in c.fetchall()]
            p['images'] = images
            playlists.append(p)
        return playlists

def create_playlist(name, description, p_type='manual', rules=None, color=None):
    with get_connection() as conn:
        c = conn.cursor()
        created_at = datetime.now()
        try:
            c.execute('INSERT INTO playlists (name, description, type, rules, color, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
                      (name, description, p_type, rules, color, created_at))
            playlist_id = c.lastrowid
            conn.commit()
            return {
                "id": playlist_id,
                "name": name,
                "description": description,
                "type": p_type,
                "rules": rules,
                "color": color,
                "created_at": str(created_at),
                "song_count": 0
            }
        except sqlite3.IntegrityError:
            return None # Duplicate

def get_playlist_by_id(playlist_id):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM playlists WHERE id = ?', (playlist_id,))
        row = c.fetchone()
        return dict(row) if row else None

def get_playlist_songs(playlist_id, playlist_type, rules_json=None):
    """
    Returns list of song dicts.
    Handles both Manual and Smart (rules-based) playlists.
    """
    with get_connection() as conn:
        c = conn.cursor()
        
        if playlist_type == 'smart' and rules_json:
            try:
                rules_data = json.loads(rules_json)
                match_type = rules_data.get('match_type', 'all') # 'all' (AND) or 'any' (OR)
                rules = rules_data.get('rules', [])
                
                if not rules:
                    return []
                
                query_parts = ["SELECT 0 as position, * FROM downloads WHERE status = 'completed'"]
                conditions = []
                params = []
                
                for rule in rules:
                    field = rule.get('field')
                    operator = rule.get('operator')
                    value = rule.get('value')
                    
                    clause = ""
                    if field in ['artist', 'album', 'title']:
                        if operator == 'contains':
                            clause = f"{field} LIKE ?"
                            params.append(f"%{value}%")
                        elif operator == 'is':
                            clause = f"{field} = ?"
                            params.append(value)
                        elif operator == 'is_not':
                            clause = f"{field} != ?"
                            params.append(value)
                    # Add more fields/ops as needed in future
                        
                    if clause:
                        conditions.append(clause)
                
                if conditions:
                    join_op = " AND " if match_type == 'all' else " OR "
                    query_parts.append(f"AND ({join_op.join(conditions)})")
                
                query_parts.append("ORDER BY created_at DESC")
                
                sql = " ".join(query_parts)
                c.execute(sql, params)
                return [dict(r) for r in c.fetchall()]
            except Exception as e:
                print(f"Error executing smart playlist strings: {e}")
                return []
        else:
            # Manual playlist
            c.execute('''
                SELECT ps.position, d.* 
                FROM playlist_songs ps
                JOIN downloads d ON ps.song_query = d.query
                WHERE ps.playlist_id = ?
                ORDER BY ps.position ASC
            ''', (playlist_id,))
            return [dict(r) for r in c.fetchall()]

def add_song_to_playlist(playlist_id, song_query):
    with get_connection() as conn:
        c = conn.cursor()
        # Verify playlist existence? (Caller checks usually, but FK handles integrity if strictly enforced. Sqlite defaults OFF for FK usually unless strict)
        
        # Get max position
        c.execute('SELECT MAX(position) FROM playlist_songs WHERE playlist_id = ?', (playlist_id,))
        row = c.fetchone()
        max_pos = row[0] if row and row[0] is not None else -1
        next_pos = max_pos + 1
        
        try:
            c.execute('''
                INSERT INTO playlist_songs (playlist_id, song_query, position, added_at)
                VALUES (?, ?, ?, ?)
            ''', (playlist_id, song_query, next_pos, datetime.now()))
            conn.commit()
            return next_pos
        except Exception:
            return None

def remove_song_from_playlist(playlist_id, song_query):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_query = ?', (playlist_id, song_query))
        conn.commit()

def delete_playlist(playlist_id):
    with get_connection() as conn:
        c = conn.cursor()
        # Delete songs associations first
        c.execute('DELETE FROM playlist_songs WHERE playlist_id = ?', (playlist_id,))
        c.execute('DELETE FROM playlists WHERE id = ?', (playlist_id,))
        conn.commit()

def update_playlist_details(playlist_id, name, description):
    with get_connection() as conn:
        c = conn.cursor()
        try:
            c.execute('UPDATE playlists SET name = ?, description = ? WHERE id = ?', 
                      (name, description, playlist_id))
            conn.commit()
            return c.rowcount > 0
        except sqlite3.IntegrityError:
            return False

def reorder_playlist_songs(playlist_id, items):
    # items: list of {song_query, new_position}
    with get_connection() as conn:
        c = conn.cursor()
        try:
            for item in items:
                # We assume item is dict or object, caller handles extraction
                q = item['song_query'] if isinstance(item, dict) else item.song_query
                pos = item['new_position'] if isinstance(item, dict) else item.new_position
                c.execute('UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_query = ?',
                          (pos, playlist_id, q))
            conn.commit()
            return True
        except Exception:
            return False

def get_top_local_artists(limit=50):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT artist, COUNT(*) as cnt FROM downloads GROUP BY artist ORDER BY cnt DESC LIMIT ?', (limit,))
        return [r[0] for r in c.fetchall()]

def get_candidates_for_recommendation(artist_list, limit=50):
    if not artist_list: return []
    with get_connection() as conn:
        c = conn.cursor()
        placeholders = ','.join(['?'] * len(artist_list))
        sql = f'''
            SELECT * FROM downloads 
            WHERE status = 'completed' 
            AND artist IN ({placeholders})
            ORDER BY RANDOM() 
            LIMIT ?
        '''
        c.execute(sql, artist_list + [limit])
        return [dict(r) for r in c.fetchall()]

def find_local_song(artist: str, title: str):
    """
    Find a completed download matching artist and title.
    Tries exact match first, then case-insensitive.
    """
    with get_connection() as conn:
        c = conn.cursor()
        # Exact match
        query = f"{artist} - {title}"
        c.execute('SELECT query FROM downloads WHERE query = ? AND status = "completed"', (query,))
        row = c.fetchone()
        if row: return row[0]
        
        # Split Check
        c.execute('SELECT query FROM downloads WHERE artist = ? AND title = ? AND status = "completed"', (artist, title))
        row = c.fetchone()
        if row: return row[0]

        # Case insensitive
        c.execute('SELECT query FROM downloads WHERE artist LIKE ? AND title LIKE ? AND status = "completed"', (artist, title))
        row = c.fetchone()
        if row: return row[0]
        
        return None

def add_songs_to_playlist_batch(playlist_id, song_queries):
    """
    Adds multiple songs to a playlist efficiently.
    """
    if not song_queries: return 0
    
    with get_connection() as conn:
        c = conn.cursor()
        
        # Get current max position
        c.execute('SELECT MAX(position) FROM playlist_songs WHERE playlist_id = ?', (playlist_id,))
        row = c.fetchone()
        current_pos = row[0] if row and row[0] is not None else -1
        next_pos = current_pos + 1
        
        added_count = 0
        now = datetime.now()
        
        data = []
        for q in song_queries:
            data.append((playlist_id, q, next_pos + added_count, now))
            added_count += 1
            
        try:
            c.executemany('''
                INSERT INTO playlist_songs (playlist_id, song_query, position, added_at)
                VALUES (?, ?, ?, ?)
            ''', data)
            conn.commit()
            return added_count
        except Exception as e:
            print(f"Batch add error: {e}")
            return 0
