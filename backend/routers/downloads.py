from fastapi import APIRouter
from pydantic import BaseModel
from core import downloader_service, scheduler, logger
from database import get_downloads, get_total_downloads_count, get_all_pending_downloads


from utils import sanitize_filename

router = APIRouter(tags=["downloads"])

class DownloadRequest(BaseModel):
    query: str
    artist: str = None
    title: str = None
    album: str = None
    image: str = None

@router.get("/downloads")
async def list_downloads(page: int = 1, limit: int = 50, status: str = None, search: str = None, artist: str = None, album: str = None):
    items = get_downloads(page, limit, status, search, artist, album)
    
    # Inject audio_url
    for item in items:
        if item['status'] == 'completed':
            s_artist = sanitize_filename(item['artist'])
            s_album = sanitize_filename(item['album'])
            s_title = sanitize_filename(item['title'])
            item['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
        else:
            item['audio_url'] = None

    total = get_total_downloads_count(status, search, artist, album)
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

import time

class SimpleCache:
    def __init__(self, ttl=60):
        self.ttl = ttl
        self._cache = {}
        self._timestamps = {}

    def get(self, key):
        if key in self._cache:
            if time.time() - self._timestamps[key] < self.ttl:
                return self._cache[key]
        return None

    def set(self, key, value):
        self._cache[key] = value
        self._timestamps[key] = time.time()

filters_cache = SimpleCache(ttl=60)

@router.get("/filters")
def get_filters(artist: str = None):
    cache_key = f"filters_{artist}"
    cached = filters_cache.get(cache_key)
    if cached:
        return cached

    from database import get_all_artists, get_all_albums
    data = {
        "artists": get_all_artists(),
        "albums": get_all_albums(artist)
    }
    filters_cache.set(cache_key, data)
    return data

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
