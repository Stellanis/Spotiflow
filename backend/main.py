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
                    
                downloader_service.queue_download(query, artist=track['artist'], title=track['title'], album=track['album'], image_url=track.get('image'))
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
    # Startup handled by @app.on_event("startup") for synchronous scheduler start? 
    # Actually, the original code used lifespan for everything. Let's keep using lifespan.
    # But I see I might have replaced "lifespan" with "start_scheduler" in the replacement content?
    # Wait, the tool requires me to match target content.
    # The original was:
    # @asynccontextmanager
    # async def lifespan(app: FastAPI):
    #     # Startup
    #     logger.info(f"--- STARTUP: Database path is: {os.path.abspath(DB_NAME)} ---")
    #     init_db()
    #     # Run immediately on startup
    
    # Let's rewrite it correctly inside the lifespan function.

    # Startup
    logger.info(f"--- STARTUP: Database path is: {os.path.abspath(DB_NAME)} ---")
    init_db()
    
    # Helper to refresh stats
    def refresh_daily_stats():
        user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
        if user:
            lastfm_service.refresh_stats_cache(user)
        else:
            logger.warning("Daily refresh skipped: No user configured.")

    # Run immediately on startup
    logger.info("Triggering initial scrobble check...")
    scheduler.add_job(check_new_scrobbles, 'date', run_date=datetime.now())
    # Schedule periodic checks
    interval = int(get_setting("SCROBBLE_UPDATE_INTERVAL") or 30)
    logger.info(f"Scheduling scrobble check every {interval} minutes.")
    scheduler.add_job(check_new_scrobbles, 'interval', minutes=interval, id='scrobble_check')
    
    # Schedule Daily Stats Refresh at 2:00 AM
    logger.info("Scheduling daily stats refresh at 2:00 AM.")
    scheduler.add_job(refresh_daily_stats, 'cron', hour=2, minute=0, id='daily_stats_refresh')
    
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
    
    env_user = os.getenv("LASTFM_USER")

    # Merge with env vars if not in DB or empty
    if (not settings.get("LASTFM_USER")) and env_user:
        settings["LASTFM_USER"] = env_user
        
    if (not settings.get("LASTFM_API_KEY")) and os.getenv("LASTFM_API_KEY"):
        settings["LASTFM_API_KEY"] = os.getenv("LASTFM_API_KEY")
    if (not settings.get("LASTFM_API_SECRET")) and os.getenv("LASTFM_API_SECRET"):
        settings["LASTFM_API_SECRET"] = os.getenv("LASTFM_API_SECRET")
    
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
def get_scrobbles(user: str, limit: int = 10):
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

from fastapi import BackgroundTasks

@app.get("/stats/top-tracks/{user}")
def get_top_tracks(user: str, background_tasks: BackgroundTasks, period: str = "overall", limit: int = 50):
    try:
        tracks = lastfm_service.get_top_tracks(user, period, limit)
        
        # Determine strict limit for prefetching to avoid hammering API
        # Only prefetch top 20 or so
        prefetch_limit = 20
        tracks_to_prefetch = tracks[:prefetch_limit]
        
        background_tasks.add_task(lastfm_service.prefetch_track_infos, user, tracks_to_prefetch)
        
        return tracks
    except Exception as e:
        logger.error(f"Error fetching top tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/track")
def get_track_info(user: str, artist: str, track: str):
    try:
        info = lastfm_service.get_track_info(user, artist, track)
        if not info:
             raise HTTPException(status_code=404, detail="Track not found")
        return info
    except Exception as e:
        logger.error(f"Error fetching track info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        logger.error(f"Error fetching track info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/chart")
def get_chart_data(user: str, period: str = "1month", artist: str = None, track: str = None):
    try:
        data = lastfm_service.get_chart_data(user, period, artist, track)
        return data
    except Exception as e:
        logger.error(f"Error fetching chart data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/listening-clock/{user}")
def get_listening_clock(user: str, period: str = "1month"):
    try:
        data = lastfm_service.get_listening_clock_data(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching listening clock data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/genre-breakdown/{user}")
def get_genre_breakdown(user: str, period: str = "1month"):
    try:
        data = lastfm_service.get_genre_breakdown(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching genre breakdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/on-this-day/{user}")
def get_on_this_day(user: str):
    try:
        data = lastfm_service.get_on_this_day(user)
        return data
    except Exception as e:
        logger.error(f"Error fetching on this day data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/streak/{user}")
def get_streak(user: str):
    try:
        data = lastfm_service.get_listening_streak(user)
        return data
    except Exception as e:
        logger.error(f"Error fetching streak data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/diversity/{user}")
def get_diversity(user: str, period: str = "1month"):
    try:
        data = lastfm_service.get_artist_diversity(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching diversity score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/mainstream/{user}")
def get_mainstream(user: str, period: str = "1month"):
    try:
        data = lastfm_service.get_mainstream_score(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching mainstream score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/top-artists/{user}")
def get_top_artists(user: str, period: str = "1month", limit: int = 10):
    try:
        return lastfm_service.get_top_artists(user, period, limit)
    except Exception as e:
        logger.error(f"Error getting top artists: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/downloads")
async def list_downloads(page: int = 1, limit: int = 50, status: str = None, search: str = None):
    from database import get_total_downloads_count
    items = get_downloads(page, limit, status, search)
    total = get_total_downloads_count(status, search)
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@app.post("/download")
async def download_song(request: DownloadRequest):
    # Queue the download
    downloader_service.queue_download(request.query, request.artist, request.title, request.album, request.image)
    return {"status": "queued", "query": request.query}

@app.post("/download/all")
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
