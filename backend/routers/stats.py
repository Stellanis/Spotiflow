from fastapi import APIRouter, HTTPException, BackgroundTasks
from core import lastfm_service, analytics_service, logger

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/top-tracks/{user}")
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

@router.get("/track")
def get_track_info(user: str, artist: str, track: str):
    try:
        info = lastfm_service.get_track_info(user, artist, track)
        if not info:
             raise HTTPException(status_code=404, detail="Track not found")
        return info
    except Exception as e:
        logger.error(f"Error fetching track info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/{user}")
def sync_stats(user: str, background_tasks: BackgroundTasks):
    """
    Trigger a sync of recent scrobbles to the local database.
    """
    background_tasks.add_task(lastfm_service.sync_scrobbles_to_db, user)
    return {"status": "sync_started", "message": "Scrobble sync started in background"}

@router.get("/chart")
def get_chart_data(user: str, period: str = "1month", artist: str = None, track: str = None):
    try:
        if artist or track:
             return analytics_service.get_chart_data(user, period, artist, track)
             
        # Use local DB for main activity chart via analytics service
        data = analytics_service.get_chart_data_db(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching chart data: {e}")
        try:
            return analytics_service.get_chart_data(user, period, artist, track)
        except:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/listening-clock/{user}")
def get_listening_clock(user: str, period: str = "1month"):
    try:
        data = analytics_service.get_listening_clock_data(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching listening clock data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/genre-breakdown/{user}")
def get_genre_breakdown(user: str, period: str = "1month"):
    try:
        data = analytics_service.get_genre_breakdown(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching genre breakdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/on-this-day/{user}")
def get_on_this_day(user: str):
    try:
        data = lastfm_service.get_on_this_day(user)
        return data
    except Exception as e:
        logger.error(f"Error fetching on this day data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/streak/{user}")
def get_streak(user: str):
    try:
        # Use local DB for streak via analytics
        data = analytics_service.get_listening_streak_db(user)
        return data
    except Exception as e:
        logger.error(f"Error fetching streak data: {e}")
        # Fallback
        return analytics_service.get_listening_streak(user)

@router.get("/diversity/{user}")
def get_diversity(user: str, period: str = "1month"):
    try:
        data = analytics_service.get_artist_diversity(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching diversity score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mainstream/{user}")
def get_mainstream(user: str, period: str = "1month"):
    try:
        data = analytics_service.get_mainstream_score(user, period)
        return data
    except Exception as e:
        logger.error(f"Error fetching mainstream score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/top-artists/{user}")
def get_top_artists(user: str, period: str = "1month", limit: int = 10):
    try:
        return lastfm_service.get_top_artists(user, period, limit)
    except Exception as e:
        logger.error(f"Error getting top artists: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sonic-diary/{user}")
def get_sonic_diary(user: str):
    try:
        data = analytics_service.generate_sonic_diary(user)
        if not data:
            raise HTTPException(status_code=404, detail="Not enough data for diary")
        return data
    except Exception as e:
        logger.error(f"Error generating sonic diary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
