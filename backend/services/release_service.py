from datetime import datetime, timedelta

from core import lastfm_service
from database import (
    create_job,
    get_favorite_artists,
    get_downloads,
    get_setting,
    get_top_artists_from_db,
    list_release_watch_artists,
    list_releases,
    mark_job_failed,
    mark_job_running,
    mark_job_succeeded,
    set_feature_refresh_state,
    upsert_artist_release,
    upsert_release_watch_artist,
)
from services.external_client import ExternalAPIClient


class ReleaseService:
    def __init__(self):
        self.musicbrainz = ExternalAPIClient(
            "musicbrainz",
            base_url="https://musicbrainz.org/ws/2/",
            timeout=10,
            retries=2,
            min_interval=1.1,
        )

    def refresh(self):
        user = get_setting("LASTFM_USER")
        job_id = create_job("release_refresh", "releases", "queued", payload={"user": user})
        mark_job_running(job_id)
        try:
            watched = self._build_watchlist(user)
            count = 0
            for artist in watched:
                releases = self._fetch_artist_releases(artist["artist"])
                for release in releases:
                    upsert_artist_release(
                        artist["artist"],
                        release["title"],
                        release.get("release_date"),
                        release.get("release_type"),
                        release.get("source", "MusicBrainz"),
                        url=release.get("url"),
                        image_url=release.get("image_url"),
                    )
                    count += 1
            set_feature_refresh_state("releases")
            mark_job_succeeded(job_id, {"releases_found": count, "watched_artists": len(watched)})
            return {"status": "succeeded", "job_id": job_id, "releases_found": count}
        except Exception as exc:
            mark_job_failed(job_id, str(exc))
            return {"status": "failed", "job_id": job_id, "error": str(exc)}

    def get_releases(self, limit=60):
        releases = list_releases(limit=limit)
        downloads = get_downloads(page=1, limit=100000, status="completed")
        downloaded_artists = {str(item.get("artist") or "").lower() for item in downloads}
        for item in releases:
            if item.get("artist", "").lower() in downloaded_artists:
                item["downloaded"] = 1
        return releases

    def update_release_state(self, release_id, field, value):
        from database import mark_release_state

        mark_release_state(release_id, field, value)
        return {"status": "updated", "release_id": release_id, "field": field, "value": value}

    def _build_watchlist(self, user):
        seen = set()
        watchlist = []
        favorites = get_favorite_artists()
        for artist in favorites:
            if artist not in seen:
                seen.add(artist)
                watchlist.append({"artist": artist, "source": "favorite", "weight": 100})
                upsert_release_watch_artist(artist, "favorite", 100)
        for item in get_top_artists_from_db(user, limit=20):
            artist = item["name"]
            if artist not in seen:
                seen.add(artist)
                watchlist.append({"artist": artist, "source": "scrobbles", "weight": item["playcount"]})
                upsert_release_watch_artist(artist, "scrobbles", int(item["playcount"]))
        existing = list_release_watch_artists(limit=40)
        return existing or watchlist

    def _fetch_artist_releases(self, artist_name):
        try:
            artist_data = self.musicbrainz.request_json(
                "GET",
                "artist/",
                params={"query": artist_name, "fmt": "json", "limit": 1},
                headers={"User-Agent": "Spotiflow/1.0 (personal project)"},
            )
        except Exception:
            return []
        artists = artist_data.get("artists", []) if artist_data else []
        if not artists:
            return []
        artist = artists[0]
        try:
            releases_data = self.musicbrainz.request_json(
                "GET",
                "release-group",
                params={
                    "artist": artist["id"],
                    "fmt": "json",
                    "limit": 10,
                    "type": "album|ep|single",
                },
                headers={"User-Agent": "Spotiflow/1.0 (personal project)"},
            )
        except Exception:
            return []

        recent_cutoff = (datetime.utcnow() - timedelta(days=365)).date().isoformat()
        results = []
        for item in releases_data.get("release-groups", []) if releases_data else []:
            date = item.get("first-release-date")
            if not date or date < recent_cutoff:
                continue
            image_url = lastfm_service.get_artist_image(artist_name)
            results.append(
                {
                    "title": item.get("title"),
                    "release_date": date,
                    "release_type": item.get("primary-type"),
                    "source": "MusicBrainz",
                    "url": f"https://musicbrainz.org/release-group/{item.get('id')}",
                    "image_url": image_url,
                }
            )
        return results


release_service = ReleaseService()
