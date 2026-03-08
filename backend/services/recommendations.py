import random
from database import get_downloads, get_setting
from .lastfm import LastFMService
import logging
import os

logger = logging.getLogger(__name__)

class RecommendationsService:
    def __init__(self):
        self.lastfm = LastFMService()
        
    def get_recommendations(self, limit: int = 10):
        # 1. Get user configuration
        user = get_setting("LASTFM_USER") or os.getenv("LASTFM_USER")
        if not user:
            logger.warning("No LASTFM_USER setting found.")
            return []
            
        # 2. Get top artists for the user (last 1 month)
        top_artists_req = self.lastfm.get_top_artists(user, period="1month", limit=10)
        if not top_artists_req:
            return []
            
        top_artists = [a['name'] for a in top_artists_req]
        
        # 3. Get similar artists
        similar_artists_pool = set()
        for artist in top_artists:
            similar = self.lastfm.get_similar_artists(artist, limit=5)
            # Add matching tags/images to the set
            for s in similar:
                if s['name'] not in top_artists:
                    similar_artists_pool.add((s['name'], s['image']))
                    
        # 4. Fetch top tracks for these similar artists
        candidates = []
        for artist_name, image_url in list(similar_artists_pool):
            top_tracks = self.lastfm.get_artist_top_tracks(artist_name, limit=3)
            for t in top_tracks:
                candidates.append({
                    "artist": artist_name,
                    "title": t['title'],
                    "image": image_url,
                    "query": f"{artist_name} {t['title']}"
                })
                
        # Shuffle candidates to provide variety
        random.shuffle(candidates)
        
        # 5. Filter out already downloaded tracks
        all_downloads = get_downloads(page=1, limit=100000)
        downloaded_set = set()
        for d in all_downloads:
            artist_key = d['artist'].lower() if d['artist'] else ''
            title_key = d['title'].lower() if d['title'] else ''
            downloaded_set.add((artist_key, title_key))
        
        final_recommendations = []
        # Create a set to keep track of artist/title combos to avoid duplicates natively
        seen_candidates = set()
        for c in candidates:
            c_artist = c['artist'].lower()
            c_title = c['title'].lower()
            
            # Skip if already downloaded or already added to recommendations
            if (c_artist, c_title) not in downloaded_set and (c_artist, c_title) not in seen_candidates:
                final_recommendations.append(c)
                seen_candidates.add((c_artist, c_title))
                if len(final_recommendations) >= limit:
                    break
                    
        return final_recommendations

recommendations_service = RecommendationsService()
