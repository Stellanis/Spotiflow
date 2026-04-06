import os
import sqlite3
from contextlib import contextmanager


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
