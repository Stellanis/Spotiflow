from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from services.lastfm import LastFMService
from services.downloader import DownloaderService
from database import init_db, get_downloads, is_downloaded, DB_NAME, get_setting, set_setting, get_all_settings, add_download, get_all_pending_downloads
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager
from datetime import datetime

import logging
from logging.handlers import RotatingFileHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler("app.log", maxBytes=1000000, backupCount=3),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()

lastfm_service = LastFMService()
downloader_service = DownloaderService()
scheduler = BackgroundScheduler()

def check_new_scrobbles():
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if not user:
        logger.warning("No LASTFM_USER configured for auto-download.")
        return

    limit = int(get_setting("SCROBBLE_LIMIT_COUNT") or 20)
    logger.info(f"Checking new scrobbles for {user} (limit: {limit})...")
    try:
        tracks = lastfm_service.get_recent_tracks(user, limit=limit)
        
        # Check auto-download setting
        auto_download = get_setting("AUTO_DOWNLOAD", "true").lower() == "true"
        
        for track in tracks:
            query = f"{track['artist']} - {track['title']}"
            logger.info(f"Processing: {query}")
            
            if auto_download:
                from database import get_download_status
                status = get_download_status(query)
                
                if status == 'pending':
                    logger.info(f"Skipping {query}, pending manual download.")
                    continue
                elif status == 'completed':
                    logger.info(f"Skipping {query}, already downloaded.")
                    continue
                    
                downloader_service.download_song(query, artist=track['artist'], title=track['title'], album=track['album'], image_url=track.get('image'))
            else:
                # If auto-download is disabled, add to DB as pending if not exists
                if not is_downloaded(query):
                    # Check if it exists at all (even pending) to avoid duplicates? 
                    # is_downloaded only checks for 'completed'.
                    # We should probably check if it exists in any status.
                    # But add_download handles unique constraint on query.
                    # So we can just try to add it.
                    from database import add_download
                    add_download(query, track['artist'], track['title'], track['album'], image_url=track.get('image'), status="pending")
                    logger.info(f"Added to library (pending): {query}")

    except Exception as e:
        logger.error(f"Error in background job: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"--- STARTUP: Database path is: {os.path.abspath(DB_NAME)} ---")
    init_db()
    # Run immediately on startup
    logger.info("Triggering initial scrobble check...")
    scheduler.add_job(check_new_scrobbles, 'date', run_date=datetime.now())
    # Schedule periodic checks
    interval = int(get_setting("SCROBBLE_UPDATE_INTERVAL") or 30)
    logger.info(f"Scheduling scrobble check every {interval} minutes.")
    scheduler.add_job(check_new_scrobbles, 'interval', minutes=interval, id='scrobble_check')
    scheduler.start()
    logger.info("Scheduler started.")
    yield
    # Shutdown
    scheduler.shutdown()

app = FastAPI(title="Spotify Downloader API", lifespan=lifespan)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DownloadRequest(BaseModel):
    query: str
    artist: str = None
    title: str = None
    album: str = None
    image: str = None

class SettingsRequest(BaseModel):
    lastfm_api_key: str = None
    lastfm_api_secret: str = None
    lastfm_user: str = None
    scrobble_update_interval: int = None
    scrobble_limit_count: int = None
    auto_download: bool = None
    tutorial_seen: bool = None

@app.get("/settings")
async def get_settings():
    settings = get_all_settings()
    
    # Mask secrets
    if "LASTFM_API_KEY" in settings and settings["LASTFM_API_KEY"]:
        key = settings["LASTFM_API_KEY"]
        if len(key) > 4:
            settings["LASTFM_API_KEY"] = key[:4] + "*" * (len(key) - 4)
            
    if "LASTFM_API_SECRET" in settings and settings["LASTFM_API_SECRET"]:
        secret = settings["LASTFM_API_SECRET"]
        if len(secret) > 4:
            settings["LASTFM_API_SECRET"] = secret[:4] + "*" * (len(secret) - 4)
            
    return settings

@app.post("/settings")
async def update_settings(settings: SettingsRequest):
    if settings.lastfm_api_key is not None:
        set_setting("LASTFM_API_KEY", settings.lastfm_api_key)
    if settings.lastfm_api_secret is not None:
        set_setting("LASTFM_API_SECRET", settings.lastfm_api_secret)
    if settings.lastfm_user is not None:
        set_setting("LASTFM_USER", settings.lastfm_user)
    
    if settings.scrobble_limit_count is not None:
        set_setting("SCROBBLE_LIMIT_COUNT", str(settings.scrobble_limit_count))

    if settings.auto_download is not None:
        set_setting("AUTO_DOWNLOAD", str(settings.auto_download).lower())

    if settings.tutorial_seen is not None:
        set_setting("TUTORIAL_SEEN", str(settings.tutorial_seen).lower())

    if settings.scrobble_update_interval is not None:
        old_interval = int(get_setting("SCROBBLE_UPDATE_INTERVAL") or 30)
        set_setting("SCROBBLE_UPDATE_INTERVAL", str(settings.scrobble_update_interval))
        
        if old_interval != settings.scrobble_update_interval:
            logger.info(f"Rescheduling scrobble check to every {settings.scrobble_update_interval} minutes.")
            try:
                scheduler.reschedule_job('scrobble_check', trigger='interval', minutes=settings.scrobble_update_interval)
            except Exception as e:
                logger.error(f"Failed to reschedule job: {e}")
                # If job doesn't exist (e.g. startup failed), try adding it
                scheduler.add_job(check_new_scrobbles, 'interval', minutes=settings.scrobble_update_interval, id='scrobble_check')

    return {"status": "updated"}

@app.post("/sync")
async def sync_scrobbles(background_tasks: BackgroundTasks):
    background_tasks.add_task(check_new_scrobbles)
    return {"status": "sync_started"}

@app.get("/")
async def root():
    return {"message": "Spotify Downloader API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/scrobbles/{user}")
async def get_scrobbles(user: str, limit: int = 10):
    try:
        tracks = lastfm_service.get_recent_tracks(user, limit)
        # Check if each track is already downloaded
        for track in tracks:
            query = f"{track['artist']} - {track['title']}"
            track['downloaded'] = is_downloaded(query)
        return tracks
    except Exception as e:
        import traceback
        logger.error(f"Error fetching scrobbles: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/downloads")
async def list_downloads(page: int = 1, limit: int = 50, status: str = None):
    from database import get_total_downloads_count
    items = get_downloads(page, limit, status)
    total = get_total_downloads_count(status)
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@app.post("/download")
async def download_song(request: DownloadRequest, background_tasks: BackgroundTasks):
    # Run download in background to not block the API
    background_tasks.add_task(downloader_service.download_song, request.query, request.artist, request.title, request.album, request.image)
    return {"status": "queued", "query": request.query}

@app.post("/download/all")
async def download_all_pending(background_tasks: BackgroundTasks):
    pending_tracks = get_all_pending_downloads()
    count = 0
    for track in pending_tracks:
        background_tasks.add_task(
            downloader_service.download_song, 
            track['query'], 
            track['artist'], 
            track['title'], 
            track['album'], 
            track['image_url']
        )
        count += 1
    return {"status": "queued", "count": count}

@app.get("/jobs")
async def get_jobs():
    active_downloads = downloader_service.get_active_downloads()
    
    # Get next run time for scrobble check
    next_run = None
    job = scheduler.get_job('scrobble_check')
    if job:
        next_run = job.next_run_time
        
    return {
        "active_downloads": active_downloads,
        "next_scrobble_check": next_run
    }
