from fastapi import APIRouter
from services.recommendations import recommendations_service

router = APIRouter(tags=["recommendations"])

@router.get("/recommendations")
def get_recommendations(limit: int = 20):
    candidates = recommendations_service.get_recommendations(limit)
    return {
        "items": candidates,
        "total": len(candidates)
    }
