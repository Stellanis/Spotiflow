from .mappers import ensure_list


def get_track_info(self, user: str, artist: str, track: str):
    cache_key = f"info_{user}_{artist}_{track}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request(
        "GET",
        {
            "method": "track.getinfo",
            "user": user,
            "artist": artist,
            "track": track,
        },
    )
    if not data or "track" not in data:
        return None

    entry = data["track"]
    lastfm_images = entry.get("album", {}).get("image", []) if "album" in entry else entry.get("image", [])
    image_url = self.image_provider.get_image(lastfm_images, entry.get("artist", {}).get("name"), entry.get("name"))
    info = {
        "artist": entry.get("artist", {}).get("name"),
        "title": entry.get("name"),
        "album": entry.get("album", {}).get("title"),
        "userplaycount": entry.get("userplaycount", 0),
        "playcount": entry.get("playcount", 0),
        "listeners": entry.get("listeners", 0),
        "image": image_url,
        "tags": [tag["name"] for tag in ensure_list(entry.get("toptags", {}).get("tag"))] if "toptags" in entry else [],
        "wiki": entry.get("wiki", {}).get("summary"),
    }
    self.cache.set(cache_key, info)
    return info
