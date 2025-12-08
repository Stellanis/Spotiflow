import os
from database import get_setting, is_downloaded, add_download, get_download_status
from core import lastfm_service, downloader_service, logger

def check_new_scrobbles():
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if not user:
        logger.warning("No LASTFM_USER configured for auto-download.")
        return

    limit = int(get_setting("SCROBBLE_LIMIT_COUNT") or 20)
    logger.info(f"Checking new scrobbles for {user} (limit: {limit})...")
    try:
        # Force fresh fetch for sync
        tracks = lastfm_service.get_recent_tracks(user, limit=limit, ignore_cache=True)
        
        # Check auto-download setting
        auto_download = get_setting("AUTO_DOWNLOAD", "true").lower() == "true"
        
        for track in tracks:
            query = f"{track['artist']} - {track['title']}"
            logger.info(f"Processing: {query}")
            
            if auto_download:
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
                    add_download(query, track['artist'], track['title'], track['album'], image_url=track.get('image'), status="pending")
                    logger.info(f"Added to library (pending): {query}")

    except Exception as e:
        logger.error(f"Error in background job: {e}")

def refresh_daily_stats():
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if user:
        lastfm_service.refresh_stats_cache(user)
    else:
        logger.warning("Daily refresh skipped: No user configured.")
