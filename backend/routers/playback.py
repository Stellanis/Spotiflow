from typing import Literal, Optional
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from database import get_setting
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


def _require_user():
    user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="No LASTFM_USER configured")
    return user


@router.get("/playback/resolve", response_model=PlayableSource)
def resolve_playback(artist: str, title: str, album: Optional[str] = None, preview_url: Optional[str] = None):
    playable = playable_source_service.resolve(artist, title, album=album, preview_url=preview_url)
    if not playable:
        raise HTTPException(status_code=404, detail="No playable source found")
    return playable


@router.post("/playback/start")
def start_playback(req: PlaybackTrackRequest):
    user = _require_user()
    playable = playable_source_service.resolve(req.artist, req.title, album=req.album, preview_url=req.preview_url)
    if not playable:
        raise HTTPException(status_code=404, detail="No playable source found")

    session = radio_service.start_session(
        username=user,
        seed_track=req.model_dump(exclude_none=True),
        seed_type=req.seed_type or "recommendation",
        seed_context=req.seed_context or req.model_dump(exclude_none=True),
    )
    queue = session.get("queue_payload") or []
    return {
        "session_id": session["id"],
        "track": queue[0] if queue else req.model_dump(exclude_none=True),
        "playable": playable,
        "stream_health": playable_source_service.get_stream_health(
            req.artist,
            req.title,
            album=req.album,
        ),
        "queue": queue,
        "queue_mode": "radio",
    }


@router.post("/playback/next")
def next_playback(req: PlaybackNextRequest):
    session, track, playable, skipped_tracks = radio_service.next_playable_track(req.session_id, reason=req.reason or "next")
    if not session or not track or not playable:
        raise HTTPException(status_code=404, detail="No next track available")
    return {
        "session_id": session["id"],
        "track": track,
        "playable": playable,
        "stream_health": playable_source_service.get_stream_health(
            track["artist"],
            track["title"],
            album=track.get("album"),
        ),
        "queue": session.get("queue_payload") or [],
        "queue_mode": "radio",
        "skipped_tracks": skipped_tracks,
    }


@router.post("/playback/event")
def playback_event(req: PlaybackEventRequest):
    user = _require_user()
    event, promotion = radio_service.record_event(user, req.model_dump(exclude_none=True))
    return {"event": event, "promotion": promotion}


@router.get("/playback/session/{session_id}")
def get_playback_session(session_id: int):
    session = radio_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    queue = session.get("queue_payload") or []
    current_index = session.get("current_index", 0)
    current_track = queue[current_index] if current_index < len(queue) else None
    return {
        **session,
        "stream_health": playable_source_service.get_stream_health(
            current_track["artist"],
            current_track["title"],
            album=current_track.get("album"),
        ) if current_track else None,
    }


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
