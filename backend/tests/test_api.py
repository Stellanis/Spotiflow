import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
import pytest

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Spotify Downloader API is running"}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_get_settings():
    response = client.get("/settings")
    assert response.status_code == 200
    # Check if keys are masked if they exist
    data = response.json()
    if "LASTFM_API_KEY" in data and data["LASTFM_API_KEY"]:
        assert "*" in data["LASTFM_API_KEY"]

def test_get_downloads_pagination():
    # This assumes the DB might be empty or not, but we check the structure
    response = client.get("/downloads?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert data["page"] == 1
    assert data["limit"] == 10
