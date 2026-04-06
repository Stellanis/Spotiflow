def create_jobs_schema(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_type TEXT NOT NULL,
            area TEXT NOT NULL,
            status TEXT NOT NULL,
            query TEXT,
            artist TEXT,
            title TEXT,
            album TEXT,
            payload TEXT,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            source_url TEXT,
            match_confidence REAL,
            alternate_candidate_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, job_type, created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_query ON jobs(query)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS job_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT,
            payload TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(job_id) REFERENCES jobs(id)
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id, created_at DESC)")
