import time

from database.repositories.scrobbles import add_scrobbles_batch, get_latest_scrobble_timestamp

from .mappers import ensure_list


def sync_scrobbles_to_db(self, user: str):
    last_ts = get_latest_scrobble_timestamp(user)
    start_ts = last_ts + 1 if last_ts > 0 else 0

    print(f"Syncing scrobbles for {user} starting from {start_ts}...")
    page = 1
    limit = 200
    new_scrobbles_count = 0

    while True:
        data = self.client.request(
            "GET",
            {
                "method": "user.getrecenttracks",
                "user": user,
                "limit": limit,
                "page": page,
                "from": start_ts,
            },
        )
        if not data or "recenttracks" not in data or "track" not in data["recenttracks"]:
            break

        tracks = ensure_list(data["recenttracks"]["track"])
        if not tracks:
            break

        valid_tracks = [track for track in tracks if not ("@attr" in track and track["@attr"].get("nowplaying") == "true")]
        if not valid_tracks and page == 1:
            break

        batch_data = []
        for track in valid_tracks:
            if "date" not in track:
                continue
            batch_data.append(
                (
                    user,
                    track.get("artist", {}).get("#text"),
                    track.get("name"),
                    track.get("album", {}).get("#text"),
                    track.get("image", [{}])[-1].get("#text"),
                    int(track["date"]["uts"]),
                )
            )

        if batch_data:
            add_scrobbles_batch(batch_data)
            new_scrobbles_count += len(batch_data)

        total_pages = int(data["recenttracks"].get("@attr", {}).get("totalPages", 1))
        if page >= total_pages or page >= 200:
            break
        page += 1
        time.sleep(0.5)

    print(f"Sync complete. Added {new_scrobbles_count} new scrobbles.")
    return new_scrobbles_count
