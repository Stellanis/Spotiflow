import os

from .connection import get_connection, get_db_path
from .schema import SCHEMA_BUILDERS


def init_db():
    db_path = get_db_path()
    data_dir = os.path.dirname(db_path)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

    with get_connection() as conn:
        cursor = conn.cursor()
        for builder in SCHEMA_BUILDERS:
            builder(cursor)
        conn.commit()
