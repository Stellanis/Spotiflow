import json
from datetime import datetime, timezone

from ..core import get_connection


def _now():
    return datetime.now(timezone.utc).isoformat()


def create_job(job_type, area, status="queued", query=None, artist=None, title=None, album=None, payload=None):
    now = _now()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO jobs (
                job_type, area, status, query, artist, title, album, payload,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_type,
                area,
                status,
                query,
                artist,
                title,
                album,
                json.dumps(payload) if payload is not None else None,
                now,
                now,
            ),
        )
        job_id = c.lastrowid
        conn.commit()
    add_job_event(job_id, f"job.{status}", f"{job_type} job {status}", payload)
    return job_id


def add_job_event(job_id, event_type, message=None, payload=None):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO job_events (job_id, event_type, message, payload, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                job_id,
                event_type,
                message,
                json.dumps(payload) if payload is not None else None,
                _now(),
            ),
        )
        conn.commit()


def update_job(job_id, **fields):
    if not fields:
        return
    allowed = {
        "status",
        "error_message",
        "retry_count",
        "source_url",
        "match_confidence",
        "alternate_candidate_count",
        "started_at",
        "finished_at",
        "payload",
    }
    assignments = []
    params = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        assignments.append(f"{key} = ?")
        if key == "payload" and value is not None:
            params.append(json.dumps(value))
        else:
            params.append(value)
    assignments.append("updated_at = ?")
    params.append(_now())
    params.append(job_id)

    with get_connection() as conn:
        c = conn.cursor()
        c.execute(f"UPDATE jobs SET {', '.join(assignments)} WHERE id = ?", params)
        conn.commit()


def mark_job_running(job_id):
    update_job(job_id, status="running", started_at=_now())
    add_job_event(job_id, "job.running", "Job started")


def mark_job_succeeded(job_id, payload=None):
    update_job(job_id, status="succeeded", finished_at=_now(), payload=payload)
    add_job_event(job_id, "job.succeeded", "Job succeeded", payload)


def mark_job_failed(job_id, error_message, payload=None):
    update_job(job_id, status="failed", finished_at=_now(), error_message=error_message, payload=payload)
    add_job_event(job_id, "job.failed", error_message, payload)


def increment_job_retry(job_id):
    job = get_job(job_id)
    retry_count = (job or {}).get("retry_count", 0) + 1
    update_job(job_id, retry_count=retry_count)
    add_job_event(job_id, "job.retried", f"Retry count increased to {retry_count}")
    return retry_count


def get_job(job_id):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = c.fetchone()
    return _decode_job(row)


def find_active_job(job_type, query=None):
    with get_connection() as conn:
        c = conn.cursor()
        if query:
            c.execute(
                """
                SELECT * FROM jobs
                WHERE job_type = ? AND query = ? AND status IN ('queued', 'running')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (job_type, query),
            )
        else:
            c.execute(
                """
                SELECT * FROM jobs
                WHERE job_type = ? AND status IN ('queued', 'running')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (job_type,),
            )
        row = c.fetchone()
    return _decode_job(row)


def list_jobs(limit=50, status=None, job_type=None):
    sql = ["SELECT * FROM jobs"]
    conditions = []
    params = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if job_type:
        conditions.append("job_type = ?")
        params.append(job_type)
    if conditions:
        sql.append("WHERE " + " AND ".join(conditions))
    sql.append("ORDER BY created_at DESC LIMIT ?")
    params.append(limit)
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(" ".join(sql), params)
        rows = c.fetchall()
    return [_decode_job(row) for row in rows]


def get_job_events(job_id, limit=20):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            "SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at DESC LIMIT ?",
            (job_id, limit),
        )
        rows = c.fetchall()
    events = []
    for row in rows:
        item = dict(row)
        if item.get("payload"):
            try:
                item["payload"] = json.loads(item["payload"])
            except json.JSONDecodeError:
                pass
        events.append(item)
    return events


def get_job_summary():
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            """
            SELECT
                SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded
            FROM jobs
            WHERE created_at >= datetime('now', '-30 day')
            """
        )
        row = c.fetchone()
    row = dict(row) if row else {}
    return {key: row.get(key) or 0 for key in ("queued", "running", "failed", "succeeded")}


def _decode_job(row):
    if not row:
        return None
    item = dict(row)
    if item.get("payload"):
        try:
            item["payload"] = json.loads(item["payload"])
        except json.JSONDecodeError:
            pass
    return item
