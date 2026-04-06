def ensure_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def extract_artist_name(value):
    if isinstance(value, dict):
        return value.get("#text") or value.get("name")
    return value


def extract_album_name(value):
    if isinstance(value, dict):
        return value.get("#text") or value.get("title")
    return value
