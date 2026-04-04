from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_setting, ignore_item
from services.insight_service import insight_service


router = APIRouter(tags=["gaps"])


class IgnoreGapRequest(BaseModel):
    item_type: str
    artist: str | None = None
    title: str | None = None
    album: str | None = None
    reason: str | None = None


def _user():
    user = get_setting("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="No LASTFM_USER configured")
    return user


@router.get("/gaps")
def get_gaps():
    return insight_service.get_gaps(_user())


@router.post("/gaps/ignore")
def ignore_gap(req: IgnoreGapRequest):
    ignore_item(_user(), req.item_type, artist=req.artist, title=req.title, album=req.album, reason=req.reason)
    return {"status": "ignored"}
