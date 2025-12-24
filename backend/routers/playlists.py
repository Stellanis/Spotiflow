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
    get_candidates_for_recommendation,
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
    tag: Optional[str] = None
    tags: Optional[List[str]] = None

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
        from services.playlist_service import playlist_service
        return playlist_service.generate_top_playlist(req.name, req.description, req.period, user)
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating top playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/playlists/generate/genre")
async def generate_genre_playlist(req: PlaylistGenerateGenre):
    user = get_setting("LASTFM_USER")
    if not user:
        raise HTTPException(status_code=400, detail="LastFM user not configured")
        
    try:
        from services.playlist_service import playlist_service
        result = playlist_service.generate_genre_playlist(req.name, req.description, req.tags, req.tag)
        
        if "error" in result:
             # Handle the specific case where no artists found
             return {"message": result["error"]}
             
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
    try:
        from services.playlist_service import playlist_service
        return playlist_service.get_playlist_stats(playlist_id)
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return {
            "total_songs": 0,
            "error": str(e)
        }

@router.get("/playlists/{playlist_id}/recommendations")
async def get_playlist_recommendations(playlist_id: int, limit: int = 10):
    playlist = get_playlist_by_id(playlist_id)
    if not playlist: return [] # Or 404
    
    # We need the list of artists currently in the playlist
    songs = get_playlist_songs(playlist_id, playlist['type'], playlist['rules'])
    artists = list({s['artist'] for s in songs if s.get('artist')})
    current_queries = {s['query'] for s in songs}
    
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

