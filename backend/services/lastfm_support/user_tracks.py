import time

from .mappers import ensure_list, extract_album_name, extract_artist_name


def get_recent_tracks(self, user: str, limit: int = 10, ignore_cache: bool = False):
    cache_key = f"recent_{user}_{limit}"

    if ignore_cache:
        self.cache.clear_with_prefix(f"recent_{user}_")
    else:
        cached = self.cache.get(cache_key)
        if cached:
            return cached

    data = self.client.request(
        "GET",
        {
            "method": "user.getrecenttracks",
            "user": user,
            "limit": limit,
        },
    )
    if not data:
        return []

    tracks = []
    for track in ensure_list(data.get("recenttracks", {}).get("track")):
        lastfm_images = track.get("image", [])
        artist_name = extract_artist_name(track.get("artist"))
        track_name = track.get("name")
        image_url = self.image_provider.get_image(lastfm_images, artist_name, track_name)
        artist = extract_artist_name(track.get("artist"))
        album = extract_album_name(track.get("album"))
        timestamp = track.get("date", {}).get("uts") if "date" in track else None
        if artist and track_name:
            tracks.append(
                {
                    "artist": artist,
                    "title": track_name,
                    "album": album,
                    "image": image_url,
                    "timestamp": timestamp,
                }
            )

    self.cache.set(cache_key, tracks)
    return tracks


def get_top_tracks(self, user: str, period: str = "overall", limit: int = 50, ignore_cache: bool = False):
    cache_key = f"top_{user}_{period}_{limit}"
    if not ignore_cache:
        cached = self.cache.get(cache_key)
        if cached:
            return cached

    data = self.client.request(
        "GET",
        {
            "method": "user.gettoptracks",
            "user": user,
            "period": period,
            "limit": limit,
        },
    )
    if not data:
        return []

    tracks = []
    for track in ensure_list(data.get("toptracks", {}).get("track")):
        lastfm_images = track.get("image", [])
        artist_name = extract_artist_name(track.get("artist"))
        track_name = track.get("name")
        image_url = self.image_provider.get_image(lastfm_images, artist_name, track_name)
        artist = extract_artist_name(track.get("artist"))
        playcount = track.get("playcount", 0)
        if artist and track_name:
            tracks.append(
                {
                    "artist": artist,
                    "title": track_name,
                    "image": image_url,
                    "playcount": int(playcount),
                    "rank": track.get("@attr", {}).get("rank"),
                }
            )

    self.cache.set(cache_key, tracks)
    return tracks


def get_cached_recent_tracks(self, user: str, period: str):
    now = int(time.time())
    days = {"7day": 7, "1month": 30, "3month": 90, "6month": 180, "12month": 365}.get(period, 30)
    start_ts = now - (days * 86400)

    cache_key = f"raw_recent_{user}_{period}"
    cached = self.cache.get(cache_key)
    if cached:
        return start_ts, cached

    all_tracks = []
    page = 1
    limit = 200
    while True:
        data = self.client.request(
            "GET",
            {
                "method": "user.getrecenttracks",
                "user": user,
                "limit": limit,
                "from": start_ts,
                "page": page,
            },
        )
        if not data or "recenttracks" not in data or "track" not in data["recenttracks"]:
            break

        tracks = ensure_list(data["recenttracks"]["track"])
        if not tracks:
            break

        for track in tracks:
            if "@attr" in track and track["@attr"].get("nowplaying") == "true":
                continue
            all_tracks.append(track)

        total_pages = int(data["recenttracks"].get("@attr", {}).get("totalPages", 1))
        if page >= total_pages or page >= 200:
            break
        page += 1
        time.sleep(0.2)

    self.cache.set(cache_key, all_tracks)
    return start_ts, all_tracks


def prefetch_track_infos(self, user: str, tracks: list):
    import concurrent.futures

    def fetch_one(track):
        try:
            artist = track.get("artist")
            title = track.get("title")
            if artist and title:
                self.get_track_info(user, artist, title)
        except Exception as exc:
            print(f"Error prefetching {track}: {exc}")

    print(f"Starting prefetch for {len(tracks)} tracks...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        executor.map(fetch_one, tracks)
    print("Prefetch complete.")


def refresh_stats_cache(self, user: str):
    print(f"Starting daily stats refresh for {user}...")
    for period in ["overall", "7day", "1month", "3month", "6month", "12month"]:
        print(f"Refreshing Top Tracks ({period})...")
        try:
            self.get_top_tracks(user, period=period, limit=50, ignore_cache=True)
            time.sleep(1)
        except Exception as exc:
            print(f"Error refreshing {period}: {exc}")
    print("Daily stats refresh complete.")
