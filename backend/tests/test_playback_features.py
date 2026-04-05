import os
import sys
from datetime import datetime, timedelta, timezone
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
    get_stream_source,
    get_stream_source_by_cache_key,
    init_db,
    set_setting,
    upsert_stream_source,
)
from database.core import get_connection
from main import app
from services.playable_source_service import playable_source_service
from services.radio_service import radio_service
from services.download_service import download_coordinator
from services.stream_resolver import stream_resolver


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test_downloads.db"
    monkeypatch.setattr(database, "DB_NAME", str(db_path))
    monkeypatch.setattr(database_core, "DB_NAME", str(db_path))
    init_db()
    set_setting("LASTFM_USER", "tester")
    return db_path


@pytest.fixture
def client(temp_db):
    return TestClient(app)


def sample_track(artist, title, queue_source="manual"):
    return {
        "artist": artist,
        "title": title,
        "album": "Album",
        "track_key": f"{artist.lower()}|{title.lower()}",
        "queue_source": queue_source,
    }


def fake_playable(artist, title, album=None, preview_url=None):
    return {
        "playback_type": "remote_stream",
        "audio_url": f"https://example.com/{artist}-{title}.mp3",
        "expires_at": None,
        "source_name": "resolver",
        "source_url": "https://example.com/source",
        "headers_required": False,
        "duration_seconds": 200,
        "cache_key": f"{artist}|{title}|{album or ''}",
        "can_download": True,
        "is_promotable": True,
        "stream_source_id": 1,
    }


def test_start_manual_session_persists_queue_and_mode(temp_db):
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two")],
        start_index=0,
    )
    persisted = get_playback_session(session["id"])
    assert persisted["mode"] == "manual"
    assert persisted["queue_payload"][1]["title"] == "Two"


def test_get_active_playback_session_returns_current_manual_session(temp_db):
    radio_service.start_manual_session("tester", sample_track("A", "One"), [sample_track("A", "One")])
    session = get_active_playback_session("tester")
    assert session is not None
    assert session["mode"] == "manual"


def test_queue_add_next_inserts_after_current_index(temp_db):
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two"), sample_track("C", "Three")],
    )
    updated = radio_service.insert_manual_items(session["id"], [sample_track("D", "Four")], placement="next")
    assert [item["title"] for item in updated["queue_payload"]] == ["One", "Four", "Two", "Three"]


def test_queue_add_end_appends_items(temp_db):
    session = radio_service.start_manual_session("tester", sample_track("A", "One"), [sample_track("A", "One")])
    updated = radio_service.insert_manual_items(session["id"], [sample_track("B", "Two")], placement="end")
    assert [item["title"] for item in updated["queue_payload"]] == ["One", "Two"]


def test_queue_remove_deletes_upcoming_item_only(temp_db):
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two")],
    )
    updated = radio_service.remove_item(session["id"], "b|two")
    assert len(updated["queue_payload"]) == 1
    with pytest.raises(ValueError):
        radio_service.remove_item(session["id"], "a|one")


def test_queue_reorder_updates_upcoming_sequence(temp_db):
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two"), sample_track("C", "Three")],
    )
    updated = radio_service.reorder_items(session["id"], ["c|three", "b|two"])
    assert [item["title"] for item in updated["queue_payload"]] == ["One", "Three", "Two"]


def test_clear_upcoming_preserves_current_track(temp_db):
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two"), sample_track("C", "Three")],
    )
    updated = radio_service.clear_upcoming(session["id"])
    assert [item["title"] for item in updated["queue_payload"]] == ["One"]


def test_manual_insert_during_radio_suspends_radio_tail(temp_db):
    session = create_playback_session(
        username="tester",
        mode="radio",
        queue_payload=[
            sample_track("Seed", "Start", "radio"),
            sample_track("Radio", "Tail One", "radio"),
            sample_track("Radio", "Tail Two", "radio"),
        ],
    )
    updated = radio_service.insert_manual_items(session["id"], [sample_track("Manual", "Track")], placement="next")
    assert updated["suspended_mode"] == "radio"
    assert updated["suspended_queue_payload"]
    assert updated["queue_payload"][1]["queue_source"] == "manual"


def test_manual_segment_completion_resumes_suspended_radio(temp_db, monkeypatch):
    session = create_playback_session(
        username="tester",
        mode="radio",
        queue_payload=[sample_track("Seed", "Start", "radio"), sample_track("Manual", "Track", "manual")],
        suspended_queue_payload=[sample_track("Radio", "Resume", "radio")],
        suspended_mode="radio",
    )
    monkeypatch.setattr("services.radio_service.playable_source_service.resolve", fake_playable)
    updated, track, playable, _ = radio_service.next_playable_track(session["id"])
    assert updated["suspended_queue_payload"] is None
    assert track["title"] == "Track"
    resumed = get_playback_session(session["id"])
    assert resumed["queue_payload"][-1]["title"] == "Resume"


def test_play_now_replaces_active_manual_session(client, monkeypatch):
    monkeypatch.setattr("routers.playback.playable_source_service.resolve", fake_playable)
    radio_service.start_manual_session("tester", sample_track("A", "One"), [sample_track("A", "One")])
    response = client.post(
        "/playback/queue/play-now",
        json={"items": [sample_track("B", "Two"), sample_track("C", "Three")], "start_index": 1},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "manual"
    assert payload["track"]["title"] == "Three"


def test_playback_next_on_manual_session_advances_without_radio_refill(temp_db, monkeypatch):
    monkeypatch.setattr("services.radio_service.playable_source_service.resolve", fake_playable)
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two")],
    )
    updated, track, playable, skipped = radio_service.next_playable_track(session["id"])
    assert updated["current_index"] == 1
    assert track["title"] == "Two"
    assert skipped == []


def test_playback_next_on_radio_session_still_refills(temp_db, monkeypatch):
    monkeypatch.setattr("services.radio_service.playable_source_service.resolve", fake_playable)
    monkeypatch.setattr(
        "services.radio_service.recommendation_index_service.build_radio_candidates",
        lambda seed_track, session_tracks=None, limit=0: [sample_track("Refill", "Track", "radio")],
    )
    session = create_playback_session(
        username="tester",
        mode="radio",
        queue_payload=[sample_track("A", "One", "radio"), sample_track("B", "Two", "radio")],
    )
    updated, _, _, _ = radio_service.next_playable_track(session["id"])
    assert any(item["title"] == "Track" for item in updated["queue_payload"])


def test_active_session_endpoint_returns_404_when_none(client):
    response = client.get("/playback/session/active")
    assert response.status_code == 404


def test_websocket_payload_includes_queue_summary_fields(temp_db):
    session = radio_service.start_manual_session("tester", sample_track("A", "One"), [sample_track("A", "One"), sample_track("B", "Two")])
    payload = radio_service._build_response_payload(session)
    assert payload["queue_summary"]["total"] == 2
    assert "manual_upcoming" in payload["queue_summary"]
    assert "radio_upcoming" in payload["queue_summary"]


def test_restore_finished_session_is_not_returned_as_active(temp_db):
    session = create_playback_session(username="tester", mode="manual", queue_payload=[sample_track("A", "One")])
    finish_playback_session(session["id"])
    assert get_active_playback_session("tester") is None


def test_playback_event_accepts_extra_fields_without_500(client):
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


def test_playable_source_resolves_local_even_when_album_text_differs(temp_db):
    add_download(
        "Artist - Track",
        "Artist",
        "Track",
        "Library Album",
        status="completed",
    )

    playable = playable_source_service.resolve("Artist", "Track", album="Load + Reverb")

    assert playable is not None
    assert playable["playback_type"] == "local"
    assert playable["audio_url"].endswith("/Artist/Library Album/Track.mp3")


def test_download_coordinator_skips_existing_track_when_query_differs(temp_db):
    add_download(
        "Artist - Track",
        "Artist",
        "Track",
        "Library Album",
        status="completed",
    )

    result = download_coordinator.queue(
        downloader=None,
        query="Artist - Track load plus reverb",
        artist="Artist",
        title="Track",
        album="Load + Reverb",
    )

    assert result["status"] == "skipped"
    assert result["message"] == "Track already downloaded"


def test_verify_stream_sources_releases_elapsed_cooldown_without_reentering_it(temp_db):
    source = upsert_stream_source(
        artist="Cooldown Artist",
        title="Cooldown Track",
        source_name="resolver",
        source_url="https://example.com/source",
        playable_url=None,
        playback_type="remote_stream",
        health_status="cooldown",
        failure_count=stream_resolver.failure_threshold,
        cache_key="cooldown|track|",
    )
    expired_cooldown_updated_at = (
        datetime.now(timezone.utc) - timedelta(hours=stream_resolver.failed_source_cooldown_hours, minutes=5)
    ).isoformat()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(
            "UPDATE stream_sources SET updated_at = ? WHERE id = ?",
            (expired_cooldown_updated_at, source["id"]),
        )
        conn.commit()

    result = radio_service.verify_stream_sources()
    updated_source = get_stream_source(source["id"])
    health = stream_resolver.describe_source_health(updated_source)

    assert result["updated"] == 1
    assert updated_source["health_status"] == "degraded"
    assert updated_source["failure_count"] == stream_resolver.failure_threshold
    assert health["status"] == "degraded"
    assert health["is_in_cooldown"] is False
    assert health["should_attempt_resolution"] is True


def test_radio_service_next_playable_track_skips_unresolvable(temp_db, monkeypatch):
    session = create_radio_session(
        username="tester",
        seed_type="recommendation",
        seed_payload={"artist": "Seed", "title": "Seed Track"},
        queue_payload=[
            {"artist": "Seed", "title": "Seed Track", "track_key": "seed"},
            {"artist": "Bad", "title": "Unplayable", "track_key": "bad"},
            {"artist": "Good", "title": "Playable", "track_key": "good"},
        ],
    )
    expired_cooldown_updated_at = (
        datetime.now(timezone.utc) - timedelta(hours=stream_resolver.failed_source_cooldown_hours, minutes=5)
    ).isoformat()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("UPDATE stream_sources SET updated_at = ? WHERE id = ?", (expired_cooldown_updated_at, source["id"]))
        conn.commit()

    result = radio_service.verify_stream_sources()
    updated_source = database.get_stream_source(source["id"])
    health = stream_resolver.describe_source_health(updated_source)

    assert result["updated"] == 1
    assert updated_source["health_status"] == "degraded"
    assert health["is_in_cooldown"] is False


def test_restore_session_endpoint_returns_manual_payload(client, monkeypatch):
    monkeypatch.setattr("routers.playback.playable_source_service.resolve", fake_playable)
    session = radio_service.start_manual_session(
        "tester",
        sample_track("A", "One"),
        [sample_track("A", "One"), sample_track("B", "Two")],
    )
    response = client.get(f"/playback/session/{session['id']}")
    assert response.status_code == 200
    assert response.json()["mode"] == "manual"
