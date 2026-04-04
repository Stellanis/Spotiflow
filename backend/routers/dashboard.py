from datetime import datetime
import os

from fastapi import APIRouter

from core import downloader_service, scheduler
from database import (
    get_setting,
    get_total_downloads_count,
    get_total_scrobbles_count,
    get_favorite_artists,
    get_streaming_dashboard_stats,
)
from services.recommendations import recommendations_service
from services.concerts import ConcertService
from services.stream_resolver import stream_resolver

router = APIRouter(tags=["dashboard"])


def _get_configured_user():
    return get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")


def _health_items():
    settings_checks = [
        ("lastfm_user", "Last.fm username configured", bool(_get_configured_user())),
        ("lastfm_api_key", "Last.fm API key configured", bool(get_setting("LASTFM_API_KEY") or os.getenv("LASTFM_API_KEY"))),
        ("download_behavior", "Download behavior configured", get_setting("AUTO_DOWNLOAD") is not None),
    ]
    optional_checks = [
        ("ticketmaster_api", "Ticketmaster API key configured", bool(get_setting("tm_api_key"))),
        ("bandsintown_app", "Bandsintown app ID configured", bool(get_setting("bit_app_id"))),
    ]

    items = [
        {
            "id": check_id,
            "status": "complete" if ready else "incomplete",
            "label": label,
            "action": "open_settings",
        }
        for check_id, label, ready in settings_checks
    ]
    items.extend(
        {
            "id": check_id,
            "status": "complete" if ready else "warning",
            "label": label,
            "action": "open_settings",
        }
        for check_id, label, ready in optional_checks
    )
    return items


@router.get("/dashboard/summary")
def get_dashboard_summary():
    user = _get_configured_user()
    scrobble_job = scheduler.get_job("scrobble_check") if scheduler.running else None
    recent_scrobbles = get_total_scrobbles_count(user) if user else 0
    missing = [item["id"] for item in _health_items() if item["status"] == "incomplete"]

    concert_service = ConcertService()
    concerts = concert_service.get_all_concerts()
    upcoming_concerts = [concert for concert in concerts if concert.get("date") and concert["date"] >= datetime.now().strftime("%Y-%m-%d")]
    streaming = get_streaming_dashboard_stats()

    return {
        "user": user,
        "health": {
            "configured": len(missing) == 0,
            "missing": missing,
        },
        "sync": {
            "last_run_at": None,
            "next_run_at": scrobble_job.next_run_time.isoformat() if scrobble_job and scrobble_job.next_run_time else None,
            "is_running": bool(downloader_service.get_active_downloads()),
        },
        "downloads": {
            "active": len(downloader_service.get_active_downloads()),
            "pending": get_total_downloads_count(status="pending"),
            "failed": get_total_downloads_count(status="failed"),
            "completed_recent": min(get_total_downloads_count(status="completed"), 20),
        },
        "library": {
            "total_downloaded": get_total_downloads_count(status="completed"),
            "recent_scrobbles": recent_scrobbles,
        },
        "streaming": streaming,
        "highlights": {
            "recommendation_count": len(recommendations_service.get_recommendations(limit=6)) if user else 0,
            "upcoming_concert_count": len(upcoming_concerts),
            "favorite_artist_count": len(get_favorite_artists()),
        },
    }


@router.get("/health/checklist")
def get_health_checklist():
    items = _health_items()
    return {
        "ready": all(item["status"] == "complete" for item in items[:3]),
        "items": items,
    }
