from datetime import datetime

from .mappers import ensure_list


def get_on_this_day(self, user: str):
    now = datetime.now()
    history = []
    for i in range(1, 6):
        year = now.year - i
        start_date = datetime(year, now.month, now.day, 0, 0, 0)
        end_date = datetime(year, now.month, now.day, 23, 59, 59)
        cache_key = f"otd_{user}_{year}_{now.month}_{now.day}"
        cached = self.cache.get(cache_key)
        if cached:
            history.append(cached)
            continue

        data = self.client.request(
            "GET",
            {
                "method": "user.getrecenttracks",
                "user": user,
                "from": int(start_date.timestamp()),
                "to": int(end_date.timestamp()),
                "limit": 5,
            },
        )
        if not data:
            continue

        tracks = []
        for track in ensure_list(data.get("recenttracks", {}).get("track")):
            if "@attr" in track and track["@attr"].get("nowplaying"):
                continue
            tracks.append(
                {
                    "artist": track.get("artist", {}).get("#text"),
                    "title": track.get("name"),
                    "image": track.get("image", [{}])[-1].get("#text"),
                    "year": year,
                }
            )

        entry = {
            "year": year,
            "date": start_date.strftime("%Y-%m-%d"),
            "track_count": int(data.get("recenttracks", {}).get("@attr", {}).get("total", 0)),
            "top_tracks": tracks[:3],
        }
        self.cache.set(cache_key, entry)
        history.append(entry)
    return history
