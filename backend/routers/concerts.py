from fastapi import APIRouter, Depends, HTTPException, Query
from services.concerts import ConcertService
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from services.concerts import ConcertService
from database import get_all_artists, get_setting

router = APIRouter()
concert_service = ConcertService()

@router.get("/concerts/top-artists")
def get_top_artists():
    """
    Get top 50 artists from library (cached in DB).
    """
    all_artists = get_all_artists()
    return all_artists[:50]

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
