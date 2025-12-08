from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db, DB_NAME, get_setting
from core import scheduler, logger, downloader_service
from tasks import check_new_scrobbles, refresh_daily_stats
from routers import scrobbles, stats, downloads, settings, websockets, concerts
from services.concerts import ConcertService
from services.websocket_manager import manager
from datetime import datetime
import os
import asyncio

async def broadcast_status():
    """Poller that broadcasts active downloads to all connected clients."""
    while True:
        try:
            active_downloads = downloader_service.get_active_downloads()
            # Always broadcast current state, let frontend decide if it needs to re-render
            # Efficient enough for local tool
            if active_downloads or manager.active_connections:
                 await manager.broadcast({"active_downloads": active_downloads})
        except Exception as e:
            logger.error(f"Error in broadcast loop: {e}")
        
        await asyncio.sleep(0.5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"--- STARTUP: Database path is: {os.path.abspath(DB_NAME)} ---")
    init_db()
    
    # Run immediately on startup
    logger.info("Triggering initial scrobble check...")
    if not scheduler.get_job('initial_check'):
         scheduler.add_job(check_new_scrobbles, 'date', run_date=datetime.now(), id='initial_check')
    
    # Schedule periodic checks
    interval = int(get_setting("SCROBBLE_UPDATE_INTERVAL") or 30)
    logger.info(f"Scheduling scrobble check every {interval} minutes.")
    if not scheduler.get_job('scrobble_check'):
        scheduler.add_job(check_new_scrobbles, 'interval', minutes=interval, id='scrobble_check')
    
    # Schedule Daily Stats Refresh at 2:00 AM
    logger.info("Scheduling daily stats refresh at 2:00 AM.")
    if not scheduler.get_job('daily_stats_refresh'):
        scheduler.add_job(refresh_daily_stats, 'cron', hour=2, minute=0, id='daily_stats_refresh')
    
    # 3. Schedule Daily Concert Sync
    city = get_setting('concerts_city')
    if city:
        concert_service = ConcertService()
        scheduler.add_job(
            concert_service.sync_concerts, 
            'cron', 
            hour=3, 
            minute=0,
            args=[city],
            id='concert_sync_daily'
        )
    
    scheduler.start()
    logger.info("Scheduler started.")

    # Start WebSocket broadcaster
    broadcast_task = asyncio.create_task(broadcast_status())

    yield
    # Shutdown
    broadcast_task.cancel()
    try:
        await broadcast_task
    except asyncio.CancelledError:
        pass
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

# Include routers
app.include_router(scrobbles.router)
app.include_router(stats.router)
app.include_router(downloads.router)
app.include_router(settings.router)
app.include_router(websockets.router)
app.include_router(concerts.router)
from routers import playlists
app.include_router(playlists.router)

# Mount downloads directory to serve audio files
# Ensure directory exists first
os.makedirs("downloads", exist_ok=True)
# Mounted at "/audio" because Vite proxy strips the "/api" prefix
# Request: /api/audio/... -> Proxy: /audio/... -> Backend: /audio/...
app.mount("/audio", StaticFiles(directory="downloads"), name="audio")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "Spotify Downloader API is running"}
