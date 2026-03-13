from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.recommendations import recommendations_service
from database import get_setting, dismiss_track
import os

router = APIRouter(tags=["recommendations"])


class DismissRequest(BaseModel):
    artist: str
    title: str


@router.get("/recommendations")
def get_recommendations(limit: int = 20):
    """For You – personalized recommendations with reason + genre tags."""
    candidates = recommendations_service.get_recommendations(limit)
    return {"items": candidates, "total": len(candidates)}


@router.get("/recommendations/radar")
def get_artist_radar(limit: int = 12):
    """Artist Radar – similar artists not yet in user's top list, with top tracks."""
    artists = recommendations_service.get_artist_radar(limit)
    return {"items": artists, "total": len(artists)}


@router.get("/recommendations/moods")
def get_mood_stations():
    """Mood Stations – user's top genre tags each mapped to a curated track list."""
    stations = recommendations_service.get_mood_stations()
    return {"stations": stations, "total": len(stations)}


@router.get("/recommendations/history")
def get_history_this_week(years_back: int = 5):
    """This Week in History – what the user listened to this week in past years."""
    history = recommendations_service.get_history_this_week(years_back)
    return {"years": history, "total": len(history)}


@router.post("/recommendations/dismiss")
def dismiss_recommendation(req: DismissRequest):
    """Mark a recommendation as dismissed so it won't reappear."""
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="No LASTFM_USER configured")
    dismiss_track(user, req.artist, req.title)
    return {"status": "dismissed", "artist": req.artist, "title": req.title}
