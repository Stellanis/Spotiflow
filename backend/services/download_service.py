from database import (
    add_download,
    create_job,
    find_active_job,
    increment_job_retry,
    mark_job_failed,
    mark_job_running,
    mark_job_succeeded,
)


class DownloadCoordinator:
    def queue(self, downloader, query, artist=None, title=None, album=None, image_url=None):
        existing = find_active_job("download", query=query)
        if existing:
            return {"status": "skipped", "message": "Already in queue", "job_id": existing["id"]}

        add_download(query, artist or "Unknown Artist", title or query, album or "Unknown Album", image_url=image_url, status="pending")
        job_id = create_job(
            "download",
            "library",
            "queued",
            query=query,
            artist=artist,
            title=title,
            album=album,
            payload={"image_url": image_url},
        )
        downloader.enqueue_job(
            {
                "job_id": job_id,
                "query": query,
                "artist": artist,
                "title": title,
                "album": album,
                "image_url": image_url,
                "status": "queued",
            }
        )
        return {"status": "queued", "query": query, "job_id": job_id}

    def mark_running(self, job_id):
        mark_job_running(job_id)

    def mark_success(self, job_id, payload=None):
        mark_job_succeeded(job_id, payload)

    def mark_failed(self, job_id, error_message, payload=None, retry=False):
        if retry:
            increment_job_retry(job_id)
        mark_job_failed(job_id, error_message, payload)


download_coordinator = DownloadCoordinator()
