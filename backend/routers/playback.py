import os
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from database import get_active_playback_session, get_setting
from services.playable_source_service import playable_source_service
from services.radio_service import radio_service
from services.stream_resolver import build_track_key

router = APIRouter(tags=["playback"])


class PlayableSource(BaseModel):
    playback_type: Literal["local", "remote_stream", "preview"]
    audio_url: str
    expires_at: Optional[str] = None
    source_name: str
    source_url: Optional[str] = None
    headers_required: bool = False
    duration_seconds: Optional[int] = None
    cache_key: Optional[str] = None
    can_download: bool = True
    is_promotable: bool = False
    stream_source_id: Optional[int] = None


class PlaybackTrackRequest(BaseModel):
    artist: str
    title: str
    album: Optional[str] = None
    seed_type: Optional[str] = None
    seed_context: Optional[dict] = None
    preview_url: Optional[str] = None
    image: Optional[str] = None
    canonical_track_id: Optional[int] = None
    mode: Optional[Literal["manual", "radio"]] = None
    queue_items: Optional[list["PlaybackTrackRequest"]] = None
    start_index: int = 0
    replace_active_session: bool = True


class PlaybackNextRequest(BaseModel):
    session_id: int
    current_track: Optional[dict] = None
    reason: Optional[str] = "next"


class PlaybackEventRequest(BaseModel):
    session_id: Optional[int] = None
    artist: str
    title: str
    album: Optional[str] = None
    event_type: Literal["start", "pause", "ended", "skip", "error", "replay", "like", "save"]
    position_seconds: Optional[float] = None
    duration_seconds: Optional[float] = None
    playback_type: str
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    stream_source_id: Optional[int] = None
    image: Optional[str] = None
    error_message: Optional[str] = None


class QueueAddRequest(BaseModel):
    session_id: Optional[int] = None
    placement: Literal["next", "end"]
    items: list[PlaybackTrackRequest]


class QueueRemoveRequest(BaseModel):
    session_id: int
    track_key: str


class QueueReorderRequest(BaseModel):
    session_id: int
    ordered_track_keys: list[str]


class QueueClearUpcomingRequest(BaseModel):
    session_id: int


class PlayNowRequest(BaseModel):
    items: list[PlaybackTrackRequest]
    start_index: int = 0
    session_id: Optional[int] = None


class RestartRadioRequest(BaseModel):
    artist: str
    title: str
    album: Optional[str] = None
    seed_type: Optional[str] = None
    seed_context: Optional[dict] = None
    preview_url: Optional[str] = None
    image: Optional[str] = None


def _require_user():
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="No LASTFM_USER configured")
    return user


def _track_payload(track):
    return track.model_dump(exclude_none=True, exclude={"queue_items"})


def _resolve_playable_or_404(track):
    playable = playable_source_service.resolve(
        track["artist"],
        track["title"],
        album=track.get("album"),
        preview_url=track.get("preview_url"),
    )
    if not playable:
        raise HTTPException(status_code=404, detail="No playable source found")
    return playable


def _session_response(session, track=None, playable=None, skipped_tracks=None):
    queue = session.get("queue_payload") or []
    current_index = session.get("current_index", 0)
    current_track = track or (queue[current_index] if 0 <= current_index < len(queue) else None)
    stream_health = None
    if current_track:
        stream_health = playable_source_service.get_stream_health(
            current_track["artist"],
            current_track["title"],
            album=current_track.get("album"),
        )
    upcoming = queue[current_index + 1 :] if current_index >= 0 else queue
    queue_summary = {
        "total": len(queue),
        "remaining": max(len(queue) - current_index - 1, 0),
        "manual_upcoming": sum(1 for item in upcoming if item.get("queue_source") == "manual"),
        "radio_upcoming": sum(1 for item in upcoming if item.get("queue_source") == "radio"),
    }
    payload = {
        "session_id": session["id"],
        "mode": session.get("mode"),
        "status": session.get("status"),
        "current_index": current_index,
        "track": current_track,
        "playable": playable,
        "stream_health": stream_health,
        "queue": queue,
        "queue_summary": queue_summary,
        "suspended_queue_summary": {
            "mode": session.get("suspended_mode"),
            "total": len(session.get("suspended_queue_payload") or []),
        }
        if session.get("suspended_queue_payload")
        else None,
    }
    if skipped_tracks is not None:
        payload["skipped_tracks"] = skipped_tracks
    return payload


@router.get("/playback/resolve", response_model=PlayableSource)
def resolve_playback(artist: str, title: str, album: Optional[str] = None, preview_url: Optional[str] = None):
    playable = playable_source_service.resolve(artist, title, album=album, preview_url=preview_url)
    if not playable:
        raise HTTPException(status_code=404, detail="No playable source found")
    return playable


@router.post("/playback/start")
def start_playback(req: PlaybackTrackRequest):
    user = _require_user()
    mode = req.mode or ("manual" if req.queue_items else "radio")
    request_track = _track_payload(req)
    if mode == "manual":
        queue_items = [_track_payload(item) for item in (req.queue_items or [req])]
        start_index = max(0, min(req.start_index, max(len(queue_items) - 1, 0)))
        session = radio_service.start_manual_session(
            user,
            queue_items[start_index] if queue_items else request_track,
            queue_items,
            start_index=start_index,
            replace_active=req.replace_active_session,
        )
    else:
        session = radio_service.start_radio_session(
            user,
            request_track,
            seed_type=req.seed_type or "recommendation",
            seed_context=req.seed_context or request_track,
            replace_active=req.replace_active_session,
        )
    queue = session.get("queue_payload") or []
    current_index = session.get("current_index", 0)
    current_track = queue[current_index] if current_index < len(queue) else request_track
    playable = _resolve_playable_or_404(current_track)
    return _session_response(session, track=current_track, playable=playable)


@router.post("/playback/next")
def next_playback(req: PlaybackNextRequest):
    session, track, playable, skipped_tracks = radio_service.next_playable_track(req.session_id, reason=req.reason or "next")
    if not session or not track or not playable:
        raise HTTPException(status_code=404, detail="No next track available")
    return _session_response(session, track=track, playable=playable, skipped_tracks=skipped_tracks)


@router.post("/playback/event")
def playback_event(req: PlaybackEventRequest):
    user = _require_user()
    event, promotion = radio_service.record_event(user, req.model_dump(exclude_none=True))
    return {"event": event, "promotion": promotion}


@router.get("/playback/session/active")
def get_active_session():
    user = _require_user()
    session = get_active_playback_session(user)
    if not session or session.get("status") == "finished":
        raise HTTPException(status_code=404, detail="No active session")
    return _session_response(session)


@router.get("/playback/session/{session_id}")
def get_playback_session(session_id: int):
    session = radio_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_response(session)


@router.post("/playback/queue/add")
def add_queue_items(req: QueueAddRequest):
    user = _require_user()
    session = radio_service.get_session(req.session_id) if req.session_id else get_active_playback_session(user)
    items = [_track_payload(item) for item in req.items]
    if not session:
        session = radio_service.start_manual_session(
            user,
            items[0],
            items,
            start_index=0,
            replace_active=False,
        )
        playable = _resolve_playable_or_404(items[0])
        return _session_response(session, track=items[0], playable=playable)
    session = radio_service.insert_manual_items(session["id"], items, placement=req.placement)
    return _session_response(session)


@router.post("/playback/queue/remove")
def remove_queue_item(req: QueueRemoveRequest):
    try:
        session = radio_service.remove_item(req.session_id, req.track_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_response(session)


@router.post("/playback/queue/reorder")
def reorder_queue(req: QueueReorderRequest):
    try:
        session = radio_service.reorder_items(req.session_id, req.ordered_track_keys)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_response(session)


@router.post("/playback/queue/clear-upcoming")
def clear_upcoming_queue(req: QueueClearUpcomingRequest):
    session = radio_service.clear_upcoming(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_response(session)


@router.post("/playback/queue/play-now")
def play_now(req: PlayNowRequest):
    user = _require_user()
    items = [_track_payload(item) for item in req.items]
    if not items:
        raise HTTPException(status_code=400, detail="items are required")
    start_index = max(0, min(req.start_index, len(items) - 1))
    session = radio_service.replace_with_manual_session(user, items[start_index], items, start_index=start_index)
    playable = _resolve_playable_or_404(items[start_index])
    return _session_response(session, track=items[start_index], playable=playable)


@router.post("/playback/radio/restart")
def restart_radio(req: RestartRadioRequest):
    user = _require_user()
    track = req.model_dump(exclude_none=True)
    session = radio_service.start_radio_session(
        user,
        track,
        seed_type=req.seed_type or "recommendation",
        seed_context=req.seed_context or track,
        replace_active=True,
    )
    playable = _resolve_playable_or_404(track)
    return _session_response(session, track=track, playable=playable)


@router.get("/playback/stream/{stream_source_id}")
def stream_playback(stream_source_id: int):
    url = playable_source_service.refresh_proxy_url(stream_source_id)
    if not url:
        raise HTTPException(status_code=404, detail="Stream source not available")
    return RedirectResponse(url=url)


@router.post("/recommendations/prefetch-playable")
def prefetch_playable(items: list[PlaybackTrackRequest]):
    warmed = []
    for item in items[:10]:
        state, is_streamable = playable_source_service.get_playable_state(
            item.artist,
            item.title,
            album=item.album,
            preview_url=item.preview_url,
        )
        warmed.append(
            {
                "track_key": build_track_key(item.artist, item.title, item.album),
                "artist": item.artist,
                "title": item.title,
                "playable_state": state,
                "is_streamable": is_streamable,
            }
        )
    return {"items": warmed}


PlaybackTrackRequest.model_rebuild()
