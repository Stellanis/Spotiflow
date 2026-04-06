import logging

from services.playable_source_service import playable_source_service
from services.recommendation_index_service import recommendation_index_service

from .radio.broadcasting import _broadcast_event, _broadcast_session
from .radio.events import _mark_source_failure, record_event, verify_stream_sources, warm_recommendation_streamability
from .radio.payloads import _build_queue_summary, _build_response_payload, _build_stream_health_payload
from .radio.promotion import _maybe_promote, _queue_download_promotion
from .radio.queue_management import clear_upcoming, insert_manual_items, remove_item, reorder_items, resume_suspended_queue_if_needed
from .radio.queue_refill import _refill_radio_queue, ensure_refill, next_playable_track, next_track
from .radio.session_lifecycle import (
    _finish_existing_sessions,
    _normalize_track,
    get_or_create_active_session,
    get_session,
    replace_with_manual_session,
    start_manual_session,
    start_radio_session,
    start_session,
)


logger = logging.getLogger(__name__)


class RadioService:
    def __init__(self):
        self.batch_size = 15
        self.refill_threshold = 2
        self._playback_event_fields = {
            "session_id",
            "artist",
            "title",
            "album",
            "playback_type",
            "event_type",
            "position_seconds",
            "source_name",
            "source_url",
        }

    start_session = start_session
    start_manual_session = start_manual_session
    replace_with_manual_session = replace_with_manual_session
    start_radio_session = start_radio_session
    get_session = get_session
    get_or_create_active_session = get_or_create_active_session
    insert_manual_items = insert_manual_items
    remove_item = remove_item
    reorder_items = reorder_items
    clear_upcoming = clear_upcoming
    resume_suspended_queue_if_needed = resume_suspended_queue_if_needed
    next_track = next_track
    next_playable_track = next_playable_track
    ensure_refill = ensure_refill
    record_event = record_event
    verify_stream_sources = verify_stream_sources
    warm_recommendation_streamability = warm_recommendation_streamability
    _finish_existing_sessions = _finish_existing_sessions
    _normalize_track = _normalize_track
    _refill_radio_queue = _refill_radio_queue
    _maybe_promote = _maybe_promote
    _queue_download_promotion = _queue_download_promotion
    _mark_source_failure = _mark_source_failure
    _build_response_payload = _build_response_payload
    _broadcast_session = _broadcast_session
    _broadcast_event = _broadcast_event
    _build_stream_health_payload = _build_stream_health_payload
    _build_queue_summary = _build_queue_summary


radio_service = RadioService()
