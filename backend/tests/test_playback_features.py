import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database
import database.core as database_core
from database import (
    add_download,
    add_playback_event,
    create_radio_session,
    get_radio_session,
    get_stream_source_by_cache_key,
    init_db,
    set_setting,
    update_radio_session,
    upsert_stream_source,
)
from main import app
from services.radio_service import radio_service
from services.playable_source_service import playable_source_service


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test_downloads.db"
    monkeypatch.setattr(database, "DB_NAME", str(db_path))
    monkeypatch.setattr(database_core, "DB_NAME", str(db_path))
    init_db()
    return db_path


def test_playback_schema_and_repository_crud(temp_db):
    stream = upsert_stream_source(
        artist="Test Artist",
        title="Test Track",
        album="Test Album",
        source_name="resolver",
        source_url="https://example.com/source",
        playable_url="https://example.com/audio.mp3",
        playback_type="remote_stream",
        resolver_payload={"duration": 180},
        expires_at="2030-01-01T00:00:00+00:00",
        cache_key="test-artist|test-track|test-album",
    )
    assert stream["id"] > 0

    found = get_stream_source_by_cache_key("test-artist|test-track|test-album")
    assert found["source_name"] == "resolver"
    assert found["resolver_payload"]["duration"] == 180

    session = create_radio_session(
        username="tester",
        seed_type="recommendation",
        seed_payload={"artist": "Test Artist", "title": "Test Track"},
        queue_payload=[{"artist": "Test Artist", "title": "Test Track"}],
    )
    assert session["current_index"] == 0

    updated = update_radio_session(session["id"], current_index=1, queue_payload=[{"artist": "Next", "title": "Song"}])
    assert updated["current_index"] == 1
    assert updated["queue_payload"][0]["artist"] == "Next"

    event = add_playback_event(
        username="tester",
        session_id=session["id"],
        artist="Test Artist",
        title="Test Track",
        playback_type="remote_stream",
        event_type="start",
        position_seconds=0,
        source_name="resolver",
    )
    assert event["event_type"] == "start"

    persisted_session = get_radio_session(session["id"])
    assert persisted_session["id"] == session["id"]


def test_playable_source_service_prefers_local_download(temp_db):
    add_download(
        query="Test Artist - Test Track",
        artist="Test Artist",
        title="Test Track",
        album="Test Album",
        status="completed",
    )

    playable = playable_source_service.resolve("Test Artist", "Test Track", album="Test Album")
    assert playable["playback_type"] == "local"
    assert playable["audio_url"].endswith("/Test Artist/Test Album/Test Track.mp3")


def test_playback_start_endpoint_returns_session_and_queue(temp_db, monkeypatch):
    set_setting("LASTFM_USER", "tester")

    from routers import playback as playback_router

    monkeypatch.setattr(
        playback_router.playable_source_service,
        "resolve",
        lambda artist, title, album=None, preview_url=None: {
            "playback_type": "remote_stream",
            "audio_url": "https://example.com/stream.mp3",
            "expires_at": None,
            "source_name": "resolver",
            "source_url": "https://example.com/source",
            "headers_required": False,
            "duration_seconds": 200,
            "cache_key": "artist|track|album",
            "can_download": True,
            "is_promotable": True,
            "stream_source_id": 1,
        },
    )
    monkeypatch.setattr(
        playback_router.radio_service,
        "start_session",
        lambda username, seed_track, seed_type="recommendation", seed_context=None: {
            "id": 9,
            "current_index": 0,
            "queue_payload": [
                {"artist": seed_track["artist"], "title": seed_track["title"], "track_key": "seed"},
                {"artist": "Next Artist", "title": "Next Track", "track_key": "next"},
            ],
        },
    )

    client = TestClient(app)
    response = client.post(
        "/playback/start",
        json={"artist": "Test Artist", "title": "Test Track", "album": "Test Album"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == 9
    assert payload["queue_mode"] == "radio"
    assert len(payload["queue"]) == 2
    assert payload["playable"]["playback_type"] == "remote_stream"


def test_playback_event_accepts_extra_fields_without_500(temp_db):
    set_setting("LASTFM_USER", "tester")
    client = TestClient(app)

    response = client.post(
        "/playback/event",
        json={
            "artist": "Test Artist",
            "title": "Test Track",
            "event_type": "start",
            "playback_type": "remote_stream",
            "duration_seconds": 123,
            "stream_source_id": 9,
            "image": "https://example.com/cover.jpg",
            "error_message": "ignored for start",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["event"]["event_type"] == "start"


def test_radio_service_record_event_filters_non_persisted_fields(temp_db):
    event, promotion = radio_service.record_event(
        "tester",
        {
            "artist": "Artist",
            "title": "Track",
            "event_type": "error",
            "playback_type": "remote_stream",
            "duration_seconds": 10,
            "stream_source_id": 22,
            "image": "https://example.com/image.jpg",
            "error_message": "boom",
        },
    )
    assert event["event_type"] == "error"
    assert promotion is None
