import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database
import database.core as database_core
from database import init_db, set_setting
from main import app


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test_insights.db"
    monkeypatch.setattr(database, "DB_NAME", str(db_path))
    monkeypatch.setattr(database_core, "DB_NAME", str(db_path))
    init_db()
    set_setting("LASTFM_USER", "tester")
    return db_path


def test_sessions_route_uses_persisted_sessions_without_rebuild(temp_db, monkeypatch):
    from routers import insights as insights_router

    called = {"persisted": 0, "rebuild": 0}

    def fake_get_persisted(user, rebuild_if_empty=True, limit=50):
        called["persisted"] += 1
        return [{"started_at": 1, "finished_at": 2}]

    def fake_rebuild(user):
        called["rebuild"] += 1
        return [{"started_at": 3, "finished_at": 4}]

    monkeypatch.setattr(insights_router.insight_service, "get_persisted_sessions", fake_get_persisted)
    monkeypatch.setattr(insights_router.insight_service, "rebuild_sessions", fake_rebuild)

    client = TestClient(app)
    response = client.get("/insights/sessions")

    assert response.status_code == 200
    assert called["persisted"] == 1
    assert called["rebuild"] == 0
    assert response.json()["items"][0]["started_at"] == 1


def test_sessions_route_rebuild_flag_still_rebuilds(temp_db, monkeypatch):
    from routers import insights as insights_router

    called = {"rebuild": 0}

    def fake_rebuild(user):
        called["rebuild"] += 1
        return [{"started_at": 5, "finished_at": 6}]

    monkeypatch.setattr(insights_router.insight_service, "rebuild_sessions", fake_rebuild)

    client = TestClient(app)
    response = client.get("/insights/sessions?rebuild=true")

    assert response.status_code == 200
    assert called["rebuild"] == 1
    assert response.json()["items"][0]["started_at"] == 5
