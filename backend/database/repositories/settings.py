from ..core import get_connection

def get_setting(key, default=None):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT value FROM settings WHERE key = ?', (key,))
        result = c.fetchone()
        return result[0] if result else default

def set_setting(key, value):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
        conn.commit()

def get_all_settings():
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT key, value FROM settings')
        rows = c.fetchall()
        return {row[0]: row[1] for row in rows}
