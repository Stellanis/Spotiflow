from fastapi import APIRouter

from services.release_service import release_service


router = APIRouter(tags=["releases"])


@router.get("/releases")
def get_releases(limit: int = 60):
    items = release_service.get_releases(limit=limit)
    return {"items": items, "total": len(items)}


@router.post("/releases/refresh")
def refresh_releases():
    return release_service.refresh()
