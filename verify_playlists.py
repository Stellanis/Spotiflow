import urllib.request
import json
import time
import uuid

API_URL = "http://localhost:8000"

def make_request(method, endpoint, data=None):
    url = f"{API_URL}{endpoint}"
    if data is not None:
        data = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status != 204:
                return json.loads(response.read().decode('utf-8'))
            return None
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        raise

def test_playlist_flow():
    print("--- Testing Playlist Flow ---")
    
    # 1. Create Playlist
    unique_id = str(uuid.uuid4())[:8]
    playlist_name = f"Test Playlist {unique_id}"
    print(f"Creating playlist: {playlist_name}")
    
    create_res = make_request("POST", "/playlists", {
        "name": playlist_name,
        "description": "Initial Description"
    })
    playlist_id = create_res["id"]
    print(f"Created playlist ID: {playlist_id}")
    
    assert create_res["name"] == playlist_name
    assert create_res["description"] == "Initial Description"
    
    # 2. Update Playlist
    print("Updating playlist details...")
    update_res = make_request("PUT", f"/playlists/{playlist_id}", {
        "name": f"{playlist_name} Updated",
        "description": "Updated Description"
    })
    
    details = make_request("GET", f"/playlists/{playlist_id}")
    assert details["name"] == f"{playlist_name} Updated"
    assert details["description"] == "Updated Description"
    print("Playlist details updated successfully.")
    
    # 3. Add Songs (mocking logic by using existing songs or just assuming success if DB constraint allows empty string query? No, let's insert a fake download first)
    # We need a song to exist in downloads table to add it to playlist due to foreign key?
    # Checking schema: FOREIGN KEY(song_query) REFERENCES downloads(query)
    # So we need to insert a download first.
    
    song_query_1 = f"Song 1 {unique_id}"
    song_query_2 = f"Song 2 {unique_id}"
    
    # Using the /download endpoint to potentially mock-add or we can just hope add_download works locally if we had direct DB access.
    # But let's try to add non-existent song and expect error, or better, try to add 'Test Artist - Test Title' if we can.
    # Let's use a raw SQL injection via a helper script? No.
    # We must use available APIs. We can simulate a download.
    
    # Using backend endpoint that doesn't actually download if we just want to populate DB?
    # Actually, let's just use what we have.
    # We can use the verify_feature.py logic to insert directly into DB if validation fails otherwise.
    # But since this is an "external" verification, we should stick to API.
    # However, `add_download` check might be strict.
    
    # Workaround: Python script to insert into DB directly for setup.
    import sqlite3
    import os
    DB_PATH = os.path.join("backend", "data", "downloads.db")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO downloads (query, artist, title, album, status, created_at) VALUES (?, 'Artist 1', 'Title 1', 'Album 1', 'completed', ?)", (song_query_1, time.strftime('%Y-%m-%d %H:%M:%S')))
    c.execute("INSERT OR IGNORE INTO downloads (query, artist, title, album, status, created_at) VALUES (?, 'Artist 2', 'Title 2', 'Album 2', 'completed', ?)", (song_query_2, time.strftime('%Y-%m-%d %H:%M:%S')))
    conn.commit()
    conn.close()
    
    print("Added mock songs to DB.")
    
    make_request("POST", f"/playlists/{playlist_id}/add", {"playlist_id": playlist_id, "song_query": song_query_1})
    make_request("POST", f"/playlists/{playlist_id}/add", {"playlist_id": playlist_id, "song_query": song_query_2})
    
    details = make_request("GET", f"/playlists/{playlist_id}")
    assert len(details["songs"]) == 2
    assert details["songs"][0]["query"] == song_query_1
    assert details["songs"][1]["query"] == song_query_2
    print("Songs added successfully.")
    
    # 4. Reorder Songs
    print("Reordering songs...")
    # Swap positions: Song 2 -> pos 0, Song 1 -> pos 1
    reorder_payload = [
        {"song_query": song_query_2, "new_position": 0},
        {"song_query": song_query_1, "new_position": 1}
    ]
    make_request("PUT", f"/playlists/{playlist_id}/reorder", reorder_payload)
    
    details = make_request("GET", f"/playlists/{playlist_id}")
    assert details["songs"][0]["query"] == song_query_2
    assert details["songs"][1]["query"] == song_query_1
    print("Songs reordered successfully.")
    
    # 5. Delete Playlist
    print("Deleting playlist...")
    make_request("DELETE", f"/playlists/{playlist_id}")
    
    try:
        make_request("GET", f"/playlists/{playlist_id}")
        assert False, "Playlist should be deleted"
    except urllib.error.HTTPError as e:
        assert e.code == 404
    print("Playlist deleted successfully.")

if __name__ == "__main__":
    try:
        test_playlist_flow()
        print("\nALL PLAYLIST TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
