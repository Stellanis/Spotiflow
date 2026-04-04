from collections import defaultdict
from datetime import datetime

from core import lastfm_service
from database import (
    create_job,
    get_all_scrobbles,
    get_feature_refresh_state,
    get_setting,
    list_enriched_tracks,
    mark_job_failed,
    mark_job_running,
    mark_job_succeeded,
    set_feature_refresh_state,
    upsert_album,
    upsert_album_alias,
    upsert_artist,
    upsert_artist_alias,
    upsert_track,
    upsert_track_enrichment,
)
from services.external_client import ExternalAPIClient


class EnrichmentService:
    def __init__(self):
        self.musicbrainz = ExternalAPIClient(
            "musicbrainz",
            base_url="https://musicbrainz.org/ws/2/",
            timeout=10,
            retries=2,
            min_interval=1.1,
        )

    def enrich_library(self, force=False):
        user = get_setting("LASTFM_USER")
        job_id = create_job("enrichment", "insights", "queued", payload={"user": user, "force": force})
        mark_job_running(job_id)
        try:
            if not user:
                mark_job_failed(job_id, "No LASTFM_USER configured")
                return {"status": "failed", "job_id": job_id}

            if not force and get_feature_refresh_state("enrichment"):
                existing = list_enriched_tracks(limit=12)
                mark_job_succeeded(job_id, {"tracks_enriched": len(existing), "skipped": True})
                return {"status": "succeeded", "job_id": job_id, "tracks_enriched": len(existing), "skipped": True}

            scrobbles = get_all_scrobbles(user)
            grouped = defaultdict(list)
            for row in scrobbles:
                artist = row.get("artist")
                title = row.get("title")
                if artist and title:
                    grouped[(artist, row.get("album") or "Unknown Album", title)].append(row)

            enriched = 0
            for (artist_name, album_name, track_name), rows in grouped.items():
                artist_tags = lastfm_service.get_artist_tags(artist_name)[:5]
                listeners = lastfm_service.get_artist_listeners(artist_name)
                artist_image = lastfm_service.get_artist_image(artist_name)
                mb_artist = self._search_musicbrainz_artist(artist_name)
                artist = upsert_artist(
                    artist_name,
                    musicbrainz_id=mb_artist.get("id") if mb_artist else None,
                    genres=artist_tags,
                    listeners=listeners,
                    image_url=artist_image,
                    confidence=0.9 if mb_artist else 0.55,
                )
                if mb_artist and mb_artist.get("name", "").lower() != artist_name.lower():
                    upsert_artist_alias(artist["id"], artist_name, "scrobble")

                album = upsert_album(
                    artist["id"],
                    album_name,
                    release_year=self._extract_year(rows),
                    cover_art_url=rows[0].get("image_url"),
                    genres=artist_tags[:3],
                    confidence=0.55,
                )
                upsert_album_alias(album["id"], album_name, "scrobble")

                track = upsert_track(
                    artist["id"],
                    album["id"],
                    track_name,
                    confidence=0.5,
                )
                upsert_track_enrichment(
                    track["id"],
                    "lastfm",
                    {
                        "playcount": len(rows),
                        "artist_tags": artist_tags,
                        "listeners": listeners,
                    },
                )
                enriched += 1

            set_feature_refresh_state("enrichment")
            mark_job_succeeded(job_id, {"tracks_enriched": enriched})
            return {"status": "succeeded", "job_id": job_id, "tracks_enriched": enriched}
        except Exception as exc:
            mark_job_failed(job_id, str(exc))
            return {"status": "failed", "job_id": job_id, "error": str(exc)}

    def _search_musicbrainz_artist(self, artist_name):
        try:
            data = self.musicbrainz.request_json(
                "GET",
                "artist/",
                params={"query": artist_name, "fmt": "json", "limit": 1},
                headers={"User-Agent": "Spotiflow/1.0 (personal project)"},
            )
        except Exception:
            return None
        artists = data.get("artists", []) if data else []
        return artists[0] if artists else None

    def _extract_year(self, rows):
        for row in rows:
            timestamp = row.get("timestamp")
            if timestamp:
                try:
                    return datetime.utcfromtimestamp(int(timestamp)).year
                except Exception:
                    return None
        return None


enrichment_service = EnrichmentService()
