import os

from core import downloader_service, lastfm_service, logger
from database import add_download, create_job, get_download_status, get_setting, mark_job_failed, mark_job_running, mark_job_succeeded
from services.download_service import download_coordinator


class SyncService:
    def run_sync(self):
        user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
        job_id = create_job("sync", "library", "queued", payload={"user": user})
        mark_job_running(job_id)
        if not user:
            mark_job_failed(job_id, "No LASTFM_USER configured")
            logger.warning("No LASTFM_USER configured for auto-download.")
            return {"status": "failed", "job_id": job_id}

        try:
            synced_count = lastfm_service.sync_scrobbles_to_db(user)
            limit = int(get_setting("SCROBBLE_LIMIT_COUNT") or 20)
            auto_download = get_setting("AUTO_DOWNLOAD", "true").lower() == "true"
            tracks = lastfm_service.get_recent_tracks(user, limit=limit, ignore_cache=True)
            queued = 0
            for track in tracks:
                query = f"{track['artist']} - {track['title']}"
                status = get_download_status(query)
                if auto_download:
                    if status in {"completed"}:
                        continue
                    result = download_coordinator.queue(
                        downloader_service,
                        query,
                        artist=track["artist"],
                        title=track["title"],
                        album=track["album"],
                        image_url=track.get("image"),
                    )
                    if result["status"] == "queued":
                        queued += 1
                elif status is None:
                    add_download(query, track["artist"], track["title"], track["album"], image_url=track.get("image"), status="pending")

            mark_job_succeeded(job_id, {"synced_scrobbles": synced_count, "queued_downloads": queued})
            return {"status": "succeeded", "job_id": job_id, "synced_scrobbles": synced_count, "queued_downloads": queued}
        except Exception as exc:
            logger.error(f"Error in background sync job: {exc}")
            mark_job_failed(job_id, str(exc))
            return {"status": "failed", "job_id": job_id}


sync_service = SyncService()
