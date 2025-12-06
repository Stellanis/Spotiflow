from fastapi import APIRouter
from pydantic import BaseModel
from core import downloader_service, scheduler, logger
from database import get_downloads, get_total_downloads_count, get_all_pending_downloads


def sanitize_filename(name):
    if not name: return "Unknown"
    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " -_()"]).strip()

router = APIRouter(tags=["downloads"])

class DownloadRequest(BaseModel):
    query: str
    artist: str = None
    title: str = None
    album: str = None
    image: str = None

@router.get("/downloads")
async def list_downloads(page: int = 1, limit: int = 50, status: str = None, search: str = None):
    items = get_downloads(page, limit, status, search)
    
    # Inject audio_url
    for item in items:
        if item['status'] == 'completed':
            s_artist = sanitize_filename(item['artist'])
            s_album = sanitize_filename(item['album'])
            s_title = sanitize_filename(item['title'])
            item['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
        else:
            item['audio_url'] = None

    total = get_total_downloads_count(status, search)
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.post("/download")
async def download_song(request: DownloadRequest):
    # Queue the download
    downloader_service.queue_download(request.query, request.artist, request.title, request.album, request.image)
    return {"status": "queued", "query": request.query}

@router.post("/download/all")
async def download_all_pending():
    pending_tracks = get_all_pending_downloads()
    count = 0
    for track in pending_tracks:
        downloader_service.queue_download(
            track['query'], 
            track['artist'], 
            track['title'], 
            track['album'], 
            track['image_url']
        )
        count += 1
    return {"status": "queued", "count": count}

@router.get("/jobs")
async def get_jobs():
    active_downloads = downloader_service.get_active_downloads()
    
    # Get next run time for scrobble check
    next_run = None
    # Check if we can access the scheduler jobs
    if scheduler.running:
        job = scheduler.get_job('scrobble_check')
        if job:
            next_run = job.next_run_time
        
    return {
        "active_downloads": active_downloads,
        "next_scrobble_check": next_run
    }
