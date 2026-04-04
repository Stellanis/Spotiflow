import os
from database import get_setting
from core import lastfm_service, logger
from services.enrichment_service import enrichment_service
from services.release_service import release_service
from services.radio_service import radio_service
from services.sync_service import sync_service

def check_new_scrobbles():
    sync_service.run_sync()

def refresh_daily_stats():
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if user:
        lastfm_service.refresh_stats_cache(user)
        if get_setting("ENRICHMENT_ENABLED", "true").lower() == "true":
            enrichment_service.enrich_library(force=True)
        if get_setting("RELEASES_ENABLED", "true").lower() == "true":
            release_service.refresh()
    else:
        logger.warning("Daily refresh skipped: No user configured.")


def verify_stream_sources():
    result = radio_service.verify_stream_sources()
    logger.info("verify_stream_sources checked=%s updated=%s", result["checked"], result["updated"])


def warm_recommendation_streamability():
    result = radio_service.warm_recommendation_streamability()
    logger.info("warm_recommendation_streamability warmed=%s", result["warmed"])
