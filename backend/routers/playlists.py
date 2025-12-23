from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from collections import Counter
from core import lastfm_service, logger
from database import DB_NAME, get_setting, get_download_info
from database import (
    get_playlists_with_stats,
    create_playlist as repo_create_playlist,
    get_playlist_by_id,
    get_playlist_songs,
    add_song_to_playlist as repo_add_song,
    remove_song_from_playlist as repo_remove_song,
    delete_playlist as repo_delete_playlist,
    update_playlist_details,
    reorder_playlist_songs,
    get_top_local_artists,
    find_local_song,
    add_songs_to_playlist_batch
)

router = APIRouter(tags=["playlists"])

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "manual"
    rules: Optional[str] = None
    color: Optional[str] = None

class PlaylistAddSong(BaseModel):
    playlist_id: int
    song_query: str

class PlaylistGenerateTop(BaseModel):
    name: str
    description: str
    period: str

class PlaylistGenerateGenre(BaseModel):
    name: str
    description: str
    tag: str

class Playlist(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: str
    rules: Optional[str]
    color: Optional[str]
    created_at: str
    song_count: int = 0
    images: List[str] = []

class PlaylistDetail(Playlist):
    songs: List[dict] = []

@router.get("/playlists", response_model=List[Playlist])
async def get_playlists():
    return get_playlists_with_stats()

@router.post("/playlists/generate/top")
async def generate_top_playlist(req: PlaylistGenerateTop):
    user = get_setting("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="LastFM user not configured")
        
    try:
        # Fetch Top Tracks
        tracks = lastfm_service.get_top_tracks(user, period=req.period, limit=100)
        if not tracks:
            raise HTTPException(status_code=400, detail="No top tracks found or API error")
            
        # Create Playlist
        playlist = repo_create_playlist(req.name, req.description, 'manual')
        if not playlist:
            raise HTTPException(status_code=400, detail="Playlist with this name already exists")
        
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
            "name": req.name,
            "song_count": added_count,
            "message": f"Created playlist with {added_count} matching songs."
        }
            
    except Exception as e:
        logger.error(f"Error generating top playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/playlists/generate/genre")
async def generate_genre_playlist(req: PlaylistGenerateGenre):
    user = get_setting("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="LastFM user not configured")
        
    try:
        # 1. Get Top Artists
        top_local_artists = get_top_local_artists(limit=50)
        
        valid_artists = []
        target_tag = req.tag.lower()
        
        for artist in top_local_artists:
            # Use public method (renamed in refactor)
            tags = lastfm_service.get_artist_tags(artist)
            if any(target_tag in t.lower() for t in tags):
                valid_artists.append(artist)
                
        if not valid_artists:
                return {"message": f"No artists found with tag '{req.tag}' in your top 50 local artists."}
                
        # Create Playlist
        playlist = repo_create_playlist(req.name, req.description, 'manual')
        if not playlist:
            raise HTTPException(status_code=400, detail="Playlist with this name already exists")
        
        playlist_id = playlist['id']
        
        # Add songs - Use recommendation helper to pick random songs from these artists
        candidates = get_candidates_for_recommendation(valid_artists, limit=50)
        songs_to_add = [row['query'] for row in candidates]
        
        added_count = add_songs_to_playlist_batch(playlist_id, songs_to_add)
        
        return {
            "id": playlist_id,
            "name": req.name,
            "song_count": added_count,
            "message": f"Created genre mix for {len(valid_artists)} artists with {added_count} songs."
        }

    except Exception as e:
        logger.error(f"Error generating genre playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/playlists", response_model=Playlist)
async def create_playlist(playlist: PlaylistCreate):
    res = repo_create_playlist(playlist.name, playlist.description, playlist.type, playlist.rules, playlist.color)
    if not res:
        raise HTTPException(status_code=400, detail="Playlist with this name already exists")
    return res

@router.get("/playlists/tags")
async def get_available_tags():
    try:
        artists = get_top_local_artists(limit=50)
        tag_counts = Counter()
        
        for artist in artists:
            tags = lastfm_service.get_artist_tags(artist)
            for tag in tags:
                tag_counts[tag] += 1
                
        return [tag for tag, count in tag_counts.most_common(50)]
        
    except Exception as e:
        logger.error(f"Error fetching tags: {e}")
        return []

@router.get("/playlists/{playlist_id}", response_model=PlaylistDetail)
async def get_playlist_detail(playlist_id: int):
    playlist = get_playlist_by_id(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    raw_songs = get_playlist_songs(playlist_id, playlist['type'], playlist['rules'])
    
    # Process songs (add audio_url)
    song_list = []
    from routers.downloads import sanitize_filename
    images = []
    
    for song in raw_songs:
        item = dict(song)
        # Handle cases where song might be missing fields if query failed? No, repo handles it.
        # But we need basic validation
        if 'artist' not in item: continue 
        
        s_artist = sanitize_filename(item['artist'])
        s_album = sanitize_filename(item['album'])
        s_title = sanitize_filename(item['title'])
        item['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
        song_list.append(item)
        
        if item.get('image_url') and item['image_url'] not in images and len(images) < 4:
            images.append(item['image_url'])
    
    result = dict(playlist)
    result['created_at'] = str(result['created_at'])
    result['songs'] = song_list
    result['song_count'] = len(song_list)
    result['images'] = images
    return result

@router.post("/playlists/{playlist_id}/add")
async def add_song_to_playlist(playlist_id: int, song: PlaylistAddSong):
    playlist = get_playlist_by_id(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    pos = repo_add_song(playlist_id, song.song_query)
    if pos is None:
        raise HTTPException(status_code=400, detail="Could not add song")
        
    return {"status": "added", "position": pos}

@router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: int, playlist: PlaylistCreate):
    success = update_playlist_details(playlist_id, playlist.name, playlist.description)
    if not success:
         # Could be not found OR duplicate name. Repo returns False for both mostly, or Exception.
         # For simplicity assuming it failed.
         raise HTTPException(status_code=400, detail="Update failed (Playlist not found or name duplicate)")
    return {"status": "updated", "id": playlist_id}

class ReorderItem(BaseModel):
    song_query: str
    new_position: int

@router.put("/playlists/{playlist_id}/reorder")
async def reorder_playlist(playlist_id: int, items: List[ReorderItem]):
    # Allow items to be passed as list of objects
    # Repo expects objects or dicts, our Pydantic models work fine if we pass them directly? 
    # Repo expects 'song_query' and 'new_position' attributes or keys. Pydantic models have attributes.
    if not reorder_playlist_songs(playlist_id, items):
        raise HTTPException(status_code=500, detail="Failed to reorder")
        
    return {"status": "reordered"}

@router.delete("/playlists/{playlist_id}/songs/{song_query}")
async def remove_song_from_playlist(playlist_id: int, song_query: str):
    repo_remove_song(playlist_id, song_query)
    return {"status": "removed"}

@router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: int):
    repo_delete_playlist(playlist_id)
    return {"status": "deleted"}

@router.get("/playlists/{playlist_id}/stats")
async def get_playlist_stats(playlist_id: int):
    # Reuse the detail logic to get songs
    # This might be slightly inefficient calling full detail, but keeps logic centralized
    playlist_detail = await get_playlist_detail(playlist_id)
    songs = playlist_detail['songs']
    
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
                
            tags = lastfm_service._get_artist_tags(artist)
            
            for tag in tags[:3]: 
                genre_counts[tag] += count_in_playlist
            
            for tag in tags:
                tag_lower = tag.lower()
                for mood, keywords in mood_keywords.items():
                    if any(k in tag_lower for k in keywords):
                        mood_distribution[mood] += count_in_playlist
                        
        if artist_count_for_listeners > 0:
            avg_listeners = total_listeners / artist_count_for_listeners
            import math
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

@router.get("/playlists/{playlist_id}/recommendations")
async def get_playlist_recommendations(playlist_id: int, limit: int = 10):
    playlist = get_playlist_by_id(playlist_id)
    if not playlist: return [] # Or 404
    
    # We need the list of artists currently in the playlist
    songs = get_playlist_songs(playlist_id, playlist['type'], playlist['rules'])
    artists = list({s['artist'] for s in songs if s.get('artist')})
    current_queries = {s['song_query'] for s in songs}
    
    if not artists: return []
    
    # Get candidates from repo
    # Limit number of artists to check to top 20 to be safe
    top_artists = [a for a, c in Counter(artists).most_common(20)]
    
    raw_recs = get_candidates_for_recommendation(top_artists, limit=50)
    
    recommendations = []
    from routers.downloads import sanitize_filename
    
    for row in raw_recs:
        if row['query'] not in current_queries:
            s_artist = sanitize_filename(row['artist'])
            s_album = sanitize_filename(row['album'])
            s_title = sanitize_filename(row['title'])
            row['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
            recommendations.append(row)
            if len(recommendations) >= limit:
                break
                
    return recommendations

