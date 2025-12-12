from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from services.concerts import ConcertService
from database import get_all_artists, get_setting, add_favorite_artist, remove_favorite_artist, get_favorite_artists
from core import lastfm_service
from pydantic import BaseModel

router = APIRouter()
concert_service = ConcertService()

class FavoriteArtistRequest(BaseModel):
    artist: str

@router.get("/concerts/top-artists")
def get_top_artists():
    """
    Get top 50 artists from library + Favorite Artists.
    Returns: List of artist names (strings).
    """
    favorites = get_favorite_artists()
    
    try:
        user = get_setting('LASTFM_USER')
        if user:
            # Fetch top 50 from last year
            top_artists_data = lastfm_service.get_top_artists(user, period='12month', limit=50)
            top_list = [a['name'] for a in top_artists_data]
            
            # Combine favorites first (so they are at top? or just included?)
            # "always show up in the top 50 concert filter"
            # We just return the list. Client filter uses this set.
            # Order: Favorites first? Not strictly necessary for filter, but maybe nice.
            combined = list(dict.fromkeys(favorites + top_list))
            return combined
            
        all_artists = get_all_artists()
        # Local fallback
        combined = list(dict.fromkeys(favorites + all_artists[:50]))
        return combined
    except Exception as e:
        print(f"Error fetching top artists: {e}")
        all_artists = get_all_artists()
        return list(dict.fromkeys(favorites + all_artists[:50]))

@router.post("/concerts/favorites")
def toggle_favorite_artist(request: FavoriteArtistRequest):
    """
    Toggle favorite status for an artist.
    """
    favorites = get_favorite_artists()
    if request.artist in favorites:
        remove_favorite_artist(request.artist)
        return {"status": "removed", "artist": request.artist, "is_favorite": False}
    else:
        add_favorite_artist(request.artist)
        return {"status": "added", "artist": request.artist, "is_favorite": True}

@router.get("/concerts/favorites")
def get_favorites():
    return get_favorite_artists()

@router.get("/concerts")
def get_concerts(city: str = None):
    """
    Get concerts from local cache.
    If city is provided, filter by city.
    If no city provided, return ALL (Repository View).
    """
    # Removed automatic default filtering to support global repository view
    # if not city:
    #     city = get_setting('concerts_city')
    
    try:
        concerts = concert_service.get_all_concerts(city=city)
        return concerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/concerts/sync")
def sync_concerts(city: str = None, radius: int = 100, background_tasks: BackgroundTasks = None):
    """
    Trigger background sync of concerts.
    """
    if not city:
        city = get_setting('concerts_city')
        
    # Global sync does not require a city
    # if not city:
    #      raise HTTPException(status_code=400, detail="City not configured")

    # Run in background to not block UI
    background_tasks.add_task(concert_service.sync_concerts, city, radius)
    return {"status": "Sync started", "message": f"Syncing concerts for {city}..."}
