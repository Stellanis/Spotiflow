import logging
from collections import Counter
from typing import List, Optional
import math

from core import lastfm_service
from database import (
    create_playlist as repo_create_playlist,
    get_playlist_by_id,
    add_songs_to_playlist_batch,
    get_top_local_artists,
    find_local_song,
    get_candidates_for_recommendation,
    get_playlist_songs
)

logger = logging.getLogger(__name__)

class PlaylistService:
    def __init__(self):
        pass

    def generate_top_playlist(self, name: str, description: str, period: str, user: str) -> dict:
        """Generates a playlist from Top Tracks on Last.fm"""
        # Fetch Top Tracks
        tracks = lastfm_service.get_top_tracks(user, period=period, limit=100)
        if not tracks:
            raise ValueError("No top tracks found or API error")
            
        # Create Playlist
        playlist = repo_create_playlist(name, description, 'manual')
        if not playlist:
            raise ValueError("Playlist with this name already exists")
        
        playlist_id = playlist['id']
        songs_to_add = []
        
        for track in tracks:
            artist = track['artist']
            title = track['title']
            
            # Find in local DB
            query = find_local_song(artist, title)
            if query:
                songs_to_add.append(query)
                
        # Batch add
        added_count = add_songs_to_playlist_batch(playlist_id, songs_to_add)

        return {
            "id": playlist_id,
            "name": name,
            "song_count": added_count,
            "message": f"Created playlist with {added_count} matching songs."
        }

    def generate_genre_playlist(self, name: str, description: str, tags: List[str], tag: str) -> dict:
        """Generates a playlist based on Genre/Tags"""
        # 1. Get Top Artists
        top_local_artists = get_top_local_artists(limit=100)
        
        valid_artists = []
        target_tags = [t.lower() for t in tags] if tags else [tag.lower()]
        
        for artist in top_local_artists:
            artist_tags = [t.lower() for t in lastfm_service.get_artist_tags(artist)]
            # Check if artist has ANY of the target tags
            if any(any(tt in t for t in artist_tags) for tt in target_tags):
                valid_artists.append(artist)
                
        if not valid_artists:
            # Need to handle this gracefully in the caller or return empty result here
            return {"error": f"No artists found with tag '{tag}' in your top 50 local artists."}
                
        # Create Playlist
        playlist = repo_create_playlist(name, description, 'manual')
        if not playlist:
            raise ValueError("Playlist with this name already exists")
        
        playlist_id = playlist['id']
        
        # Add songs - Use recommendation helper to pick random songs from these artists
        candidates = get_candidates_for_recommendation(valid_artists, limit=50)
        songs_to_add = [row['query'] for row in candidates]
        
        added_count = add_songs_to_playlist_batch(playlist_id, songs_to_add)
        
        return {
            "id": playlist_id,
            "name": name,
            "song_count": added_count,
            "message": f"Created genre mix for {len(valid_artists)} artists with {added_count} songs."
        }

    def get_playlist_stats(self, playlist_id: int) -> dict:
        playlist = get_playlist_by_id(playlist_id)
        if not playlist:
            return {}
            
        songs = get_playlist_songs(playlist_id, playlist['type'], playlist['rules'])
        
        if not songs:
            return {
                "total_songs": 0,
                "total_artists": 0,
                "top_artists": [],
                "years_distribution": {},
                "diversity_score": 0,
                "dominant_vibe": "None",
                "hipster_score": 0,
                "primary_mood": "Neutral",
                "mood_distribution": [],
                "top_genres": [],
                "timeline": {}
            }
            
        artists = [s['artist'] for s in songs if s.get('artist')]
        artist_counts = Counter(artists).most_common(5)
        
        dates = []
        for s in songs:
            dt = s.get('created_at')
            if dt:
                try:
                    if isinstance(dt, str):
                        dates.append(dt[:7]) 
                    else:
                        dates.append(str(dt)[:7])
                except: pass
                
        timeline = dict(sorted(dict(Counter(dates).most_common(12)).items()))

        # --- ADVANCED STATS ---
        top_artists_subset = [a for a, c in artist_counts[:10]]
        genre_counts = Counter()
        
        hipster_score = 0
        mood_distribution = {"Energy": 0, "Chill": 0, "Melancholic": 0, "Dark": 0}
        
        try:
            total_listeners = 0
            artist_count_for_listeners = 0
            
            mood_keywords = {
                "Energy": ["rock", "metal", "punk", "electronic", "dance", "pop", "hip-hop", "rap", "upbeat"],
                "Chill": ["ambient", "acoustic", "jazz", "lo-fi", "folk", "classical", "instrumental", "mellow"],
                "Melancholic": ["sad", "indie", "blues", "shoegaze", "slowcore", "emotional"],
                "Dark": ["dark", "gothic", "doom", "industrial", "techno", "trap"]
            }
            
            for artist in top_artists_subset:
                count_in_playlist = next((c for a, c in artist_counts if a == artist), 1)

                listeners = lastfm_service.get_artist_listeners(artist)
                if listeners > 0:
                    total_listeners += listeners
                    artist_count_for_listeners += 1
                    
                tags = lastfm_service.get_artist_tags(artist)
                
                for tag in tags[:3]: 
                    genre_counts[tag] += count_in_playlist
                
                for tag in tags:
                    tag_lower = tag.lower()
                    for mood, keywords in mood_keywords.items():
                        if any(k in tag_lower for k in keywords):
                            mood_distribution[mood] += count_in_playlist
                            
            if artist_count_for_listeners > 0:
                avg_listeners = total_listeners / artist_count_for_listeners
                min_l = math.log(10000)
                max_l = math.log(5000000)
                curr_val = max(avg_listeners, 10000)
                curr_l = math.log(curr_val)
                
                if curr_val >= 5000000:
                    hipster_score = 0
                elif curr_val <= 10000:
                    hipster_score = 100
                else:
                    ratio = (curr_l - min_l) / (max_l - min_l)
                    hipster_score = round((1 - ratio) * 100)
                    if hipster_score < 0: hipster_score = 0
                    
        except Exception as e:
            logger.error(f"Error calculating stats: {e}")

        top_genres = [{"name": g, "value": c} for g, c in genre_counts.most_common(10)]
        sorted_mood = sorted(mood_distribution.items(), key=lambda x: x[1], reverse=True)
        primary_mood = sorted_mood[0][0] if sorted_mood[0][1] > 0 else "Neutral"

        diversity_score = 0
        if len(songs) > 0:
            diversity_score = round((len(set(artists)) / len(songs)) * 100)
            
        dominant_vibe = top_genres[0]['name'] if top_genres else "Eclectic"

        return {
            "total_songs": len(songs),
            "total_artists": len(set(artists)),
            "diversity_score": diversity_score,
            "dominant_vibe": dominant_vibe,
            "hipster_score": hipster_score,
            "primary_mood": primary_mood,
            "mood_distribution": [{"name": k, "value": v} for k, v in sorted_mood if v > 0],
            "top_artists": [{"artist": a, "count": c} for a, c in artist_counts],
            "top_genres": top_genres,
            "timeline": timeline
        }

playlist_service = PlaylistService()
