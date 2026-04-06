from .mappers import ensure_list


def get_artist_listeners(self, artist_name):
    cache_key = f"artist_listeners_{artist_name}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request("GET", {"method": "artist.getinfo", "artist": artist_name})
    if data and "artist" in data:
        listeners = int(data["artist"].get("stats", {}).get("listeners", 0))
        self.cache.set(cache_key, listeners)
        return listeners
    return 0


def get_artist_tags(self, artist_name):
    cache_key = f"artist_tags_{artist_name}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request("GET", {"method": "artist.gettoptags", "artist": artist_name})
    tags = []
    for tag in ensure_list(data.get("toptags", {}).get("tag") if data else []):
        tag_name = tag.get("name", "").lower()
        if tag_name not in ["seen live", "seen", "concerts", "fip"]:
            tags.append(tag_name.title())
    self.cache.set(cache_key, tags)
    return tags


def get_artist_image(self, artist_name):
    cache_key = f"artist_image_{artist_name}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request("GET", {"method": "artist.getinfo", "artist": artist_name})
    image_url = None
    if data and "artist" in data:
        image_url = self.image_provider.get_image(data["artist"].get("image", []), artist_name, None)
    self.cache.set(cache_key, image_url)
    return image_url


def get_top_artists(self, user: str, period: str = "1month", limit: int = 10):
    cache_key = f"top_artists_{user}_{period}_{limit}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request(
        "GET",
        {
            "method": "user.gettopartists",
            "user": user,
            "period": period,
            "limit": limit,
        },
    )
    if not data:
        return []

    artists = [
        {
            "name": artist.get("name"),
            "playcount": int(artist.get("playcount", 0)),
            "url": artist.get("url"),
        }
        for artist in ensure_list(data.get("topartists", {}).get("artist"))
    ]
    self.cache.set(cache_key, artists)
    return artists


def get_artist_top_albums(self, artist: str, limit: int = 5):
    cache_key = f"artist_albums_{artist}_{limit}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request("GET", {"method": "artist.gettopalbums", "artist": artist, "limit": limit})
    albums = []
    for album in ensure_list(data.get("topalbums", {}).get("album") if data else []):
        album_name = album.get("name")
        final_image = self.image_provider.get_image(album.get("image", []), artist, album_name)
        albums.append({"name": album_name, "playcount": album.get("playcount"), "image": final_image})
    self.cache.set(cache_key, albums)
    return albums


def get_similar_artists(self, artist: str, limit: int = 5):
    cache_key = f"similar_artists_{artist}_{limit}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request("GET", {"method": "artist.getsimilar", "artist": artist, "limit": limit})
    artists = []
    for item in ensure_list(data.get("similarartists", {}).get("artist") if data else []):
        artist_name = item.get("name")
        final_image = self.image_provider.get_image(item.get("image", []), artist_name, None)
        artists.append({"name": artist_name, "match": item.get("match"), "image": final_image})
    self.cache.set(cache_key, artists)
    return artists


def get_artist_info(self, artist: str, username: str = None):
    cache_key = f"artist_info_{artist}_{username}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    params = {"method": "artist.getinfo", "artist": artist}
    if username:
        params["user"] = username
    data = self.client.request("GET", params)
    if data and "artist" in data:
        self.cache.set(cache_key, data["artist"])
        return data["artist"]
    return None


def get_artist_top_tracks(self, artist: str, limit: int = 10):
    cache_key = f"artist_top_tracks_{artist}_{limit}"
    cached = self.cache.get(cache_key)
    if cached:
        return cached

    data = self.client.request("GET", {"method": "artist.gettoptracks", "artist": artist, "limit": limit})
    tracks = [
        {"title": track.get("name"), "playcount": track.get("playcount"), "listeners": track.get("listeners")}
        for track in ensure_list(data.get("toptracks", {}).get("track") if data else [])
    ]
    self.cache.set(cache_key, tracks)
    return tracks
