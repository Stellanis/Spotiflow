from fastapi import APIRouter, HTTPException, BackgroundTasks
from core import lastfm_service, logger
from tasks import check_new_scrobbles
from database import is_downloaded, get_download_info
import urllib.parse

from utils import sanitize_filename

router = APIRouter(tags=["scrobbles"])

@router.get("/scrobbles/{user}")
def get_scrobbles(user: str, limit: int = 10):
    try:
        tracks = lastfm_service.get_recent_tracks(user, limit)
        
        # 1. Collect all queries
        track_queries = []
        for track in tracks:
            query = f"{track['artist']} - {track['title']}"
            track_queries.append(query)
            # Store temporarily to avoid re-formatting
            track['__query_key'] = query

        # 2. Batch fetch status
        from database import get_downloads_batch
        downloads_map = get_downloads_batch(track_queries)
        
        # 3. Map back to tracks
        for track in tracks:
            query = track.pop('__query_key') # Clean up
            download_info = downloads_map.get(query)
            
            if download_info:
                track['downloaded'] = True
                # Construct URL based on DB metadata
                s_artist = sanitize_filename(download_info['artist'])
                s_album = sanitize_filename(download_info['album'])
                s_title = sanitize_filename(download_info['title'])
                
                track['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
            else:
                track['downloaded'] = False
                track['audio_url'] = None
                
        return tracks
                
        return tracks
    except Exception as e:
        import traceback
        logger.error(f"Error fetching scrobbles: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def sync_scrobbles(background_tasks: BackgroundTasks):
    background_tasks.add_task(check_new_scrobbles)
    return {"status": "sync_started"}
