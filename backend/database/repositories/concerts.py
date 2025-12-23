from datetime import datetime
from ..core import get_connection

def add_concert(concert_id, artist, title, date, time, venue, city, country, url, image_url, source, lat=None, lng=None):
    with get_connection() as conn:
        c = conn.cursor()
        try:
            c.execute('''
                INSERT INTO concerts (id, artist, title, date, time, venue, city, country, url, image_url, source, lat, lng, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    lat=excluded.lat,
                    lng=excluded.lng,
                    created_at=excluded.created_at
            ''', (concert_id, artist, title, date, time, venue, city, country, url, image_url, source, lat, lng, datetime.now()))
            conn.commit()
        except Exception as e:
            print(f"Error adding concert: {e}")

def get_cached_concerts(city=None):
    with get_connection() as conn:
        c = conn.cursor()
        
        query = "SELECT * FROM concerts"
        params = []
        
        if city:
            query += " WHERE city LIKE ?"
            params.append(f"%{city}%")
            
        query += " ORDER BY date ASC"
        
        c.execute(query, params)
        rows = c.fetchall()
        return [dict(row) for row in rows]

def clear_concerts(city=None):
    with get_connection() as conn:
        c = conn.cursor()
        if city:
            c.execute("DELETE FROM concerts WHERE city LIKE ?", (f"%{city}%",))
        else:
            c.execute("DELETE FROM concerts")
        conn.commit()

def add_favorite_artist(artist):
    with get_connection() as conn:
        c = conn.cursor()
        # INSERT OR IGNORE avoids error
        c.execute('INSERT OR IGNORE INTO favorite_artists (artist, created_at) VALUES (?, ?)', (artist, datetime.now()))
        conn.commit()
        return True

def remove_favorite_artist(artist):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('DELETE FROM favorite_artists WHERE artist = ?', (artist,))
        conn.commit()
        return True

def get_favorite_artists():
    try:
        with get_connection() as conn:
            c = conn.cursor()
            c.execute('SELECT artist FROM favorite_artists ORDER BY artist')
            rows = c.fetchall()
            return [row[0] for row in rows]
    except:
        return []

def add_reminder(concert_id, remind_at=None):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO concert_reminders (concert_id, remind_at, created_at) VALUES (?, ?, ?)', (concert_id, remind_at, datetime.now()))
        conn.commit()
        return True

def remove_reminder(concert_id):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('DELETE FROM concert_reminders WHERE concert_id = ?', (concert_id,))
        conn.commit()
        return True

def get_reminders():
    try:
        with get_connection() as conn:
            c = conn.cursor()
            c.execute('SELECT concert_id FROM concert_reminders')
            rows = c.fetchall()
            return [row[0] for row in rows]
    except:
        return []

def is_reminder_set(concert_id):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT 1 FROM concert_reminders WHERE concert_id = ?', (concert_id,))
        result = c.fetchone()
        return result is not None

def delete_past_concerts(current_date):
    """
    Delete concerts where date is strictly less than current_date (YYYY-MM-DD).
    """
    with get_connection() as conn:
        c = conn.cursor()
        try:
            c.execute('DELETE FROM concerts WHERE date < ?', (current_date,))
            deleted_count = c.rowcount
            conn.commit()
            if deleted_count > 0:
                print(f"Deleted {deleted_count} past concerts from database.")
        except Exception as e:
            print(f"Error deleting past concerts: {e}")
