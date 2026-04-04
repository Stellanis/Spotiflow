from fastapi import APIRouter
from pydantic import BaseModel

from services.release_service import release_service


router = APIRouter(tags=["releases"])


class ReleaseStateRequest(BaseModel):
    field: str
    value: bool


@router.get("/releases")
def get_releases(limit: int = 60):
    items = release_service.get_releases(limit=limit)
    return {"items": items, "total": len(items)}


@router.post("/releases/refresh")
def refresh_releases():
    return release_service.refresh()


@router.patch("/releases/{release_id}")
def update_release_state(release_id: int, req: ReleaseStateRequest):
    return release_service.update_release_state(release_id, req.field, req.value)
