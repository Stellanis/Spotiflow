from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from services.lastfm import LastFMService
from services.downloader import DownloaderService
from database import init_db, get_downloads, DB_NAME
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager

load_dotenv()

lastfm_service = LastFMService()
downloader_service = DownloaderService()
scheduler = BackgroundScheduler()

def check_new_scrobbles():
    user = os.getenv("LASTFM_USER")
    if not user:
        print("No LASTFM_USER configured for auto-download.")
        return

    print(f"Checking new scrobbles for {user}...")
    try:
        tracks = lastfm_service.get_recent_tracks(user, limit=20)
        for track in tracks:
            query = f"{track['artist']} - {track['title']}"
            print(f"Processing: {query}")
            downloader_service.download_song(query, artist=track['artist'], title=track['title'], album=track['album'])
    except Exception as e:
        print(f"Error in background job: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"--- STARTUP: Database path is: {os.path.abspath(DB_NAME)} ---")
    init_db()
    # Run immediately on startup
    print("Triggering initial scrobble check...")
    scheduler.add_job(check_new_scrobbles, 'date', run_date=datetime.now())
    # Schedule periodic checks
    scheduler.add_job(check_new_scrobbles, 'interval', minutes=30)
    scheduler.start()
    print("Scheduler started.")
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
        return tracks
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error fetching scrobbles: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/downloads")
async def list_downloads():
    return get_downloads()

@app.post("/download")
async def download_song(request: DownloadRequest, background_tasks: BackgroundTasks):
    # Run download in background to not block the API
    background_tasks.add_task(downloader_service.download_song, request.query, request.artist, request.title, request.album)
    return {"status": "queued", "query": request.query}
