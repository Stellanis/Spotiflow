from fastapi import APIRouter, HTTPException

from database import get_setting
from services.enrichment_service import enrichment_service
from services.insight_service import insight_service


router = APIRouter(tags=["insights"])


def _user():
    user = get_setting("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="No LASTFM_USER configured")
    return user


@router.get("/insights/overview")
def get_insight_overview():
    user = _user()
    return insight_service.get_overview(user)


@router.get("/insights/sessions")
def get_sessions(rebuild: bool = False):
    user = _user()
    if rebuild:
        sessions = insight_service.rebuild_sessions(user)
    else:
        sessions = insight_service.rebuild_sessions(user)
    return {"items": sessions, "total": len(sessions)}


@router.get("/insights/albums")
def get_album_journeys():
    user = _user()
    return insight_service.get_album_journeys(user)


@router.get("/insights/timecapsule")
def get_time_capsule():
    user = _user()
    return insight_service.get_time_capsule(user)


@router.post("/insights/enrich")
def run_enrichment(force: bool = False):
    return enrichment_service.enrich_library(force=force)
