import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database
import database.core as database_core
from database import (
    create_radio_session,
    init_db,
    set_setting,
    upsert_stream_source,
)
from main import app


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test_dashboard.db"
    monkeypatch.setattr(database, "DB_NAME", str(db_path))
    monkeypatch.setattr(database_core, "DB_NAME", str(db_path))
    init_db()
    set_setting("LASTFM_USER", "tester")
    return db_path


def test_dashboard_summary_includes_streaming_stats(temp_db):
    create_radio_session(
        username="tester",
        seed_type="recommendation",
        seed_payload={"artist": "Seed", "title": "Track"},
        queue_payload=[{"artist": "Seed", "title": "Track"}],
    )
    upsert_stream_source(
        artist="Healthy Artist",
        title="Healthy Track",
        source_name="resolver",
        source_url="https://example.com/source",
        playable_url="https://example.com/audio.mp3",
        playback_type="remote_stream",
        health_status="healthy",
        cache_key="healthy|track|",
    )
    upsert_stream_source(
        artist="Promoted Artist",
        title="Promoted Track",
        source_name="resolver",
        source_url="https://example.com/source2",
        playable_url="https://example.com/audio2.mp3",
        playback_type="remote_stream",
        health_status="degraded",
        promoted_to_download=True,
        cache_key="promoted|track|",
    )

    client = TestClient(app)
    response = client.get("/dashboard/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["streaming"]["active_radio_sessions"] == 1
    assert payload["streaming"]["recent_stream_resolutions"] == 2
    assert payload["streaming"]["healthy_recent_streams"] == 1
    assert payload["streaming"]["degraded_recent_streams"] == 1
    assert payload["streaming"]["cooldown_recent_streams"] == 0
    assert payload["streaming"]["expired_recent_streams"] == 0
    assert payload["streaming"]["promoted_downloads"] == 1
    assert payload["streaming"]["resolve_success_rate"] == 50.0
    assert payload["streaming"]["resolve_health_status"] == "warning"
    assert payload["streaming"]["policy"]["failure_threshold"] >= 1
