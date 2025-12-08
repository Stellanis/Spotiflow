from fastapi import APIRouter
from pydantic import BaseModel
import os
from core import scheduler, logger
from database import get_all_settings, set_setting, get_setting
from tasks import check_new_scrobbles

router = APIRouter(tags=["settings"])

class SettingsRequest(BaseModel):
    lastfm_api_key: str = None
    lastfm_api_secret: str = None
    lastfm_user: str = None
    scrobble_update_interval: int = None
    scrobble_limit_count: int = None
    auto_download: bool = None
    tutorial_seen: bool = None
    hidden_features: str = None

@router.get("/settings")
async def get_settings():
    settings = get_all_settings()
    
    env_user = os.getenv("LASTFM_USER")

    # Merge with env vars if not in DB or empty
    if (not settings.get("LASTFM_USER")) and env_user:
        settings["LASTFM_USER"] = env_user
        
    if (not settings.get("LASTFM_API_KEY")) and os.getenv("LASTFM_API_KEY"):
        settings["LASTFM_API_KEY"] = os.getenv("LASTFM_API_KEY")
    if (not settings.get("LASTFM_API_SECRET")) and os.getenv("LASTFM_API_SECRET"):
        settings["LASTFM_API_SECRET"] = os.getenv("LASTFM_API_SECRET")
    
    # Mask secrets
    if "LASTFM_API_KEY" in settings and settings["LASTFM_API_KEY"]:
        key = settings["LASTFM_API_KEY"]
        if len(key) > 4:
            settings["LASTFM_API_KEY"] = key[:4] + "*" * (len(key) - 4)
            
    if "LASTFM_API_SECRET" in settings and settings["LASTFM_API_SECRET"]:
        secret = settings["LASTFM_API_SECRET"]
        if len(secret) > 4:
            settings["LASTFM_API_SECRET"] = secret[:4] + "*" * (len(secret) - 4)
            
    return settings

@router.post("/settings")
async def update_settings(settings: SettingsRequest):
    if settings.lastfm_api_key is not None:
        set_setting("LASTFM_API_KEY", settings.lastfm_api_key)
    if settings.lastfm_api_secret is not None:
        set_setting("LASTFM_API_SECRET", settings.lastfm_api_secret)
    if settings.lastfm_user is not None:
        set_setting("LASTFM_USER", settings.lastfm_user)
    
    if settings.scrobble_limit_count is not None:
        set_setting("SCROBBLE_LIMIT_COUNT", str(settings.scrobble_limit_count))

    if settings.auto_download is not None:
        set_setting("AUTO_DOWNLOAD", str(settings.auto_download).lower())

    if settings.tutorial_seen is not None:
        set_setting("TUTORIAL_SEEN", str(settings.tutorial_seen).lower())

    if settings.hidden_features is not None:
        set_setting("HIDDEN_FEATURES", settings.hidden_features)

    if settings.scrobble_update_interval is not None:
        old_interval = int(get_setting("SCROBBLE_UPDATE_INTERVAL") or 30)
        set_setting("SCROBBLE_UPDATE_INTERVAL", str(settings.scrobble_update_interval))
        
        if old_interval != settings.scrobble_update_interval:
            logger.info(f"Rescheduling scrobble check to every {settings.scrobble_update_interval} minutes.")
            try:
                scheduler.reschedule_job('scrobble_check', trigger='interval', minutes=settings.scrobble_update_interval)
            except Exception as e:
                logger.error(f"Failed to reschedule job: {e}")
                # If job doesn't exist (e.g. startup failed), try adding it
                scheduler.add_job(check_new_scrobbles, 'interval', minutes=settings.scrobble_update_interval, id='scrobble_check')

    return {"status": "updated"}
