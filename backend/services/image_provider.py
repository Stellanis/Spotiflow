import os
import requests
import subprocess
import urllib.parse
import json

class ImageProvider:
    def __init__(self):
        self._image_cache = {}
        self._placeholder_hash = "2a96cbd8b46e442fc41c2b86b821562f"

    def get_image(self, lastfm_images, artist, title):
        """
        Get best available image.
        1. Check Last.fm provided images (XL > L).
        2. If missing or placeholder, try iTunes.
        3. If iTunes fails, try Deezer.
        """
        image_url = self._extract_lastfm_image(lastfm_images)

        # Check for placeholder or missing
        if not image_url or self._placeholder_hash in image_url:
            if artist and title:
                fallback_url = self._fetch_itunes_image(artist, title)
                if fallback_url:
                    image_url = fallback_url
                else:
                    deezer_url = self._fetch_deezer_image(artist, title)
                    if deezer_url:
                        image_url = deezer_url
            elif artist:
                # Artist-only fallback (for Concerts/Profiles)
                fallback_url = self._fetch_itunes_artist_image(artist)
                if fallback_url:
                    image_url = fallback_url
                else:
                    deezer_url = self._fetch_deezer_artist_image(artist)
                    if deezer_url:
                        image_url = deezer_url
        
        return image_url

    def _extract_lastfm_image(self, images):
        """Extract best image from Last.fm list."""
        if not images or not isinstance(images, list):
            return None
            
        image_url = None
        # Try extralarge, then large, then last available
        for img in images:
            if img.get("size") == "extralarge":
                image_url = img.get("#text")
                break
        
        if not image_url and images:
            image_url = images[-1].get("#text")
            
        return image_url

    def _fetch_itunes_image(self, artist, title):
        """Fallback to iTunes Search API for album art."""
        cache_key = f"itunes_{artist}_{title}"
        if cache_key in self._image_cache:
            return self._image_cache[cache_key]

        img_url = None
        try:
            term = urllib.parse.quote(f"{artist} {title}")
            url = f"https://itunes.apple.com/search?term={term}&entity=song&limit=1"
            
            # Use curl to bypass potential UA blocking if simple requests fail, 
            # mirroring original implementation's robustness
            curl_cmd = 'curl.exe' if os.name == 'nt' else 'curl'
            cmd = [
                curl_cmd, '-s',
                '-A', "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=5)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data["resultCount"] > 0:
                    result_item = data["results"][0]
                    raw_url = result_item.get("artworkUrl100")
                    if raw_url:
                        img_url = raw_url.replace("100x100bb", "600x600bb")
        except Exception as e:
            print(f"Error fetching from iTunes via curl: {e}")

        if img_url:
            self._image_cache[cache_key] = img_url
            
        return img_url

    def _fetch_deezer_image(self, artist, title):
        """Fallback to Deezer API for album art."""
        try:
            query = f'artist:"{artist}" track:"{title}"'
            params = {
                "q": query,
                "limit": 1
            }
            url = "https://api.deezer.com/search"
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and len(data["data"]) > 0:
                    track = data["data"][0]
                    album = track.get("album", {})
                    return album.get("cover_xl") or album.get("cover_big") or album.get("cover_medium")
        except Exception as e:
            print(f"Error fetching from Deezer: {e}")
        return None

    def _fetch_itunes_artist_image(self, artist):
        """Fallback to iTunes Search API for artist image."""
        cache_key = f"itunes_artist_{artist}"
        if cache_key in self._image_cache:
            return self._image_cache[cache_key]

        img_url = None
        try:
            term = urllib.parse.quote(artist)
            url = f"https://itunes.apple.com/search?term={term}&entity=musicArtist&limit=1"
            
            # Reuse curl logic if regular request might fail, but requests is usually fine for iTunes
            # Using requests for simplicity unless blocked
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data["resultCount"] > 0:
                    # Apple Music doesn't always return generic artist images in 'musicArtist' search without extra work,
                    # but sometimes it does via `artistLinkUrl`? No, usually `amgArtistId` etc.
                    # Actually, `musicArtist` entity searches return `artistName`, `primaryGenreName`, etc. but often NO `artworkUrl`.
                    # Alternate strategy: Search for an album by the artist and take the artwork?
                    # "entity=album"
                    pass

            # Method 2: Search for top album
            url = f"https://itunes.apple.com/search?term={term}&entity=album&limit=1"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data["resultCount"] > 0:
                     img_url = data["results"][0].get("artworkUrl100")
                     if img_url:
                        img_url = img_url.replace("100x100bb", "600x600bb")

        except Exception as e:
            print(f"Error fetching artist from iTunes: {e}")

        if img_url:
            self._image_cache[cache_key] = img_url
            
        return img_url

    def _fetch_deezer_artist_image(self, artist):
        """Fallback to Deezer API for artist image."""
        try:
            # Query artist directly
            # "https://api.deezer.com/search/artist?q={artist}"
            query = f'"{artist}"'
            params = {
                "q": query,
                "limit": 1
            }
            url = "https://api.deezer.com/search/artist"
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and len(data["data"]) > 0:
                    a = data["data"][0]
                    return a.get("picture_xl") or a.get("picture_big") or a.get("picture_medium")
        except Exception as e:
            print(f"Error fetching artist from Deezer: {e}")
        return None
