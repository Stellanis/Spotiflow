import urllib.request
import json

API_URL = "http://localhost:8000"

def make_request(method, endpoint):
    url = f"{API_URL}{endpoint}"
    req = urllib.request.Request(url, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        raise

def test_covers():
    print("--- Testing Playlist Covers ---")
    
    # Get all playlists
    playlists = make_request("GET", "/playlists")
    if not playlists:
        print("No playlists found. Create one first via verify_playlists.py or UI.")
        return

    print(f"Found {len(playlists)} playlists.")
    for p in playlists:
        print(f"Playlist '{p['name']}' has {len(p.get('images', []))} images in list view.")
        assert 'images' in p, "images field missing in list view"
        
        # Get detail
        detail = make_request("GET", f"/playlists/{p['id']}")
        print(f"Playlist '{detail['name']}' has {len(detail.get('images', []))} images in detail view.")
        assert 'images' in detail, "images field missing in detail view"

    print("ALL COVER TESTS PASSED")

if __name__ == "__main__":
    try:
        test_covers()
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
