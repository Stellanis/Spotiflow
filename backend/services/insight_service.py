from collections import Counter, defaultdict
from datetime import datetime

from database import (
    get_all_scrobbles,
    get_downloads,
    get_ignored_items,
    get_scrobbles_in_range,
    get_sessions,
    get_setting,
    get_top_artists_from_db,
    get_top_tracks_from_db,
    replace_sessions,
)


class InsightService:
    def rebuild_sessions(self, user, gap_minutes=30):
        gap_minutes = int(get_setting("SESSION_GAP_MINUTES") or gap_minutes)
        scrobbles = get_all_scrobbles(user)
        if not scrobbles:
            replace_sessions(user, [])
            return []

        sessions = []
        current = [scrobbles[0]]
        gap_seconds = gap_minutes * 60

        for previous, item in zip(scrobbles, scrobbles[1:]):
            if item["timestamp"] - previous["timestamp"] <= gap_seconds:
                current.append(item)
            else:
                sessions.append(self._build_session(current))
                current = [item]
        if current:
            sessions.append(self._build_session(current))

        replace_sessions(user, sessions)
        return sessions

    def get_overview(self, user):
        sessions = get_sessions(user, limit=30) or self.rebuild_sessions(user)
        releases = []
        top_tracks = get_top_tracks_from_db(user, limit=10)
        active_session = sessions[0] if sessions else None
        longest = max(sessions, key=lambda item: item["duration_minutes"], default=None)
        best_discovery = max(sessions, key=lambda item: item["discovery_ratio"], default=None)
        return {
            "active_session": active_session,
            "longest_session": longest,
            "best_discovery_session": best_discovery,
            "top_tracks": top_tracks[:5],
            "session_count": len(sessions),
            "digest": self._build_digest(user, sessions),
            "releases": releases,
        }

    def get_album_journeys(self, user):
        scrobbles = get_all_scrobbles(user)
        by_album = defaultdict(list)
        for item in scrobbles:
            album = item.get("album") or "Unknown Album"
            by_album[(item["artist"], album)].append(item)

        revisited = []
        incomplete = []
        focused = []
        for (artist, album), rows in by_album.items():
            timestamps = sorted(row["timestamp"] for row in rows)
            playcount = len(rows)
            unique_tracks = len({row["title"] for row in rows})
            entry = {
                "artist": artist,
                "album": album,
                "playcount": playcount,
                "unique_tracks": unique_tracks,
                "first_heard_at": timestamps[0],
                "last_heard_at": timestamps[-1],
            }
            revisited.append(entry)
            if unique_tracks <= 2 and playcount >= 2:
                incomplete.append(entry)
            if unique_tracks >= 5:
                focused.append(entry)

        revisited.sort(key=lambda item: item["playcount"], reverse=True)
        incomplete.sort(key=lambda item: item["playcount"], reverse=True)
        focused.sort(key=lambda item: item["unique_tracks"], reverse=True)
        return {
            "most_revisited": revisited[:8],
            "abandoned_early": incomplete[:8],
            "front_to_back_candidates": focused[:8],
        }

    def get_time_capsule(self, user):
        scrobbles = get_all_scrobbles(user)
        by_year = defaultdict(list)
        by_month = defaultdict(list)
        now = datetime.now()
        current_month = now.month
        for item in scrobbles:
            dt = datetime.fromtimestamp(item["timestamp"])
            if dt.year == now.year:
                continue
            by_year[dt.year].append(item)
            if dt.month == current_month:
                by_month[dt.year].append(item)

        eras = []
        for year, items in sorted(by_year.items(), reverse=True):
            top_artists = Counter(row["artist"] for row in items).most_common(3)
            top_tracks = Counter((row["artist"], row["title"]) for row in items).most_common(3)
            eras.append(
                {
                    "year": year,
                    "top_artists": [{"artist": artist, "plays": plays} for artist, plays in top_artists],
                    "defining_tracks": [{"artist": artist, "title": title, "plays": plays} for (artist, title), plays in top_tracks],
                }
            )

        vanished = []
        current_top = {item["name"] for item in get_top_artists_from_db(user, limit=15, start_ts=int(datetime(now.year, 1, 1).timestamp()))}
        historical_top = Counter(row["artist"] for rows in by_year.values() for row in rows).most_common(30)
        for artist, plays in historical_top:
            if artist not in current_top:
                vanished.append({"artist": artist, "historical_plays": plays})

        return {
            "eras": eras[:6],
            "seasonal_memory": [{"year": year, "scrobble_count": len(items)} for year, items in sorted(by_month.items(), reverse=True)[:6]],
            "vanished_artists": vanished[:10],
        }

    def get_gaps(self, user):
        top_tracks = get_top_tracks_from_db(user, limit=40)
        downloads = get_downloads(page=1, limit=100000, status="completed")
        downloaded = {(item["artist"].lower(), item["title"].lower()) for item in downloads}
        ignored = {
            ((item.get("artist") or "").lower(), (item.get("title") or "").lower())
            for item in get_ignored_items(user, "gap_track")
        }

        missing_tracks = []
        for track in top_tracks:
            key = (track["artist"].lower(), track["title"].lower())
            if key not in downloaded and key not in ignored:
                missing_tracks.append(track)

        local_artists = Counter(item["artist"] for item in downloads if item.get("artist"))
        favorite_artists = get_top_artists_from_db(user, limit=15)
        weak_coverage = []
        for artist in favorite_artists:
            local_count = local_artists.get(artist["name"], 0)
            if local_count < 3:
                weak_coverage.append({"artist": artist["name"], "playcount": artist["playcount"], "local_tracks": local_count})

        local_albums = Counter((item["artist"], item["album"]) for item in downloads if item.get("album"))
        sparse_albums = [
            {"artist": artist, "album": album, "local_tracks": count}
            for (artist, album), count in local_albums.items()
            if count <= 2
        ]

        mismatches = []
        for track in missing_tracks[:10]:
            if "  " in (track["title"] or ""):
                mismatches.append(track)

        return {
            "missing_top_tracks": missing_tracks[:12],
            "weak_artist_coverage": weak_coverage[:10],
            "sparse_albums": sparse_albums[:10],
            "metadata_mismatches": mismatches[:10],
        }

    def _build_session(self, rows):
        started_at = rows[0]["timestamp"]
        finished_at = rows[-1]["timestamp"]
        artist_counts = Counter(row["artist"] for row in rows)
        album_counts = Counter((row["artist"], row.get("album") or "Unknown Album") for row in rows)
        repeated_tracks = Counter((row["artist"], row["title"]) for row in rows)
        unique_artists = len(artist_counts)
        scrobble_count = len(rows)
        dominant_artist = artist_counts.most_common(1)[0][0] if artist_counts else None
        dominant_genre = None
        duration_minutes = max(1, int((finished_at - started_at) / 60) + 1)
        discovery_ratio = round(unique_artists / scrobble_count, 2) if scrobble_count else 0
        repeat_ratio = round((sum(count for count in repeated_tracks.values() if count > 1)) / scrobble_count, 2) if scrobble_count else 0
        album_focused = album_counts and album_counts.most_common(1)[0][1] >= max(3, scrobble_count * 0.6)
        shuffle_heavy = unique_artists >= 4 and repeat_ratio < 0.25
        return {
            "started_at": started_at,
            "finished_at": finished_at,
            "scrobble_count": scrobble_count,
            "duration_minutes": duration_minutes,
            "dominant_artist": dominant_artist,
            "dominant_genre": dominant_genre,
            "discovery_ratio": discovery_ratio,
            "repeat_ratio": repeat_ratio,
            "album_focused": album_focused,
            "shuffle_heavy": shuffle_heavy,
            "summary": f"{dominant_artist} led a {duration_minutes}-minute session.",
        }

    def _build_digest(self, user, sessions):
        top_artists = get_top_artists_from_db(user, limit=5)
        recent = sessions[:3]
        return {
            "summary": f"{len(recent)} recent listening sessions and {len(top_artists)} strong artist trends.",
            "highlights": [
                f"{top_artists[0]['name']} is leading your rotation." if top_artists else "No artist leader yet.",
                f"Longest recent session lasted {max((s['duration_minutes'] for s in recent), default=0)} minutes.",
                "Use Gap Finder to close missing favorites in your local library.",
            ],
        }


insight_service = InsightService()
