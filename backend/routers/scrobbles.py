from fastapi import APIRouter, HTTPException, BackgroundTasks
from core import lastfm_service, logger
from tasks import check_new_scrobbles
from database import is_downloaded, get_download_info
import urllib.parse

def sanitize_filename(name):
    # Determine the clean name exactly as DownloaderService does
    if not name: return "Unknown"
    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " -_()"]).strip()

router = APIRouter(tags=["scrobbles"])

@router.get("/scrobbles/{user}")
def get_scrobbles(user: str, limit: int = 10):
    try:
        tracks = lastfm_service.get_recent_tracks(user, limit)
        # Check if each track is already downloaded
        for track in tracks:
            query = f"{track['artist']} - {track['title']}"
            download_info = get_download_info(query)
            
            if download_info:
                track['downloaded'] = True
                # Construct URL based on DB metadata
                s_artist = sanitize_filename(download_info['artist'])
                s_album = sanitize_filename(download_info['album'])
                s_title = sanitize_filename(download_info['title'])
                
                # Path: /api/audio/Artist/Album/Title.mp3
                # We must encode components for URL safety
                # Note: StaticFiles serves file system paths. The URL segments must match the FS directory names.
                # However, URL encoding is needed for HTTP.
                # Since we mounted at /api/audio, the request /api/audio/A/B/C.mp3 matches file A/B/C.mp3
                
                track['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
            else:
                track['downloaded'] = False
                track['audio_url'] = None
                
        return tracks
    except Exception as e:
        import traceback
        logger.error(f"Error fetching scrobbles: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def sync_scrobbles(background_tasks: BackgroundTasks):
    background_tasks.add_task(check_new_scrobbles)
    return {"status": "sync_started"}
