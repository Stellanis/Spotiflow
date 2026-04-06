import json
from datetime import datetime, timezone


UNSET = object()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def json_dump(value):
    if value is None:
        return None
    return json.dumps(value)


def parse_row(row):
    if not row:
        return None
    item = dict(row)
    for field in ("resolver_payload", "seed_payload", "queue_payload", "suspended_queue_payload"):
        if field in item and item[field]:
            try:
                item[field] = json.loads(item[field])
            except Exception:
                pass
    return item
