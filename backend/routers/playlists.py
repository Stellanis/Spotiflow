from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime
from collections import Counter
from core import lastfm_service, logger
from database import DB_NAME, get_download_info, get_setting

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

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

@router.get("/playlists", response_model=List[Playlist])
async def get_playlists():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('''
        SELECT p.*, COUNT(ps.id) as song_count 
        FROM playlists p 
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id 
        GROUP BY p.id
        ORDER BY p.created_at DESC
    ''')
    rows = c.fetchall()
    
    playlists = []
    for row in rows:
        p = dict(row)
        # Fetch up to 4 images for the collage
        c.execute('''
            SELECT DISTINCT d.image_url 
            FROM playlist_songs ps 
            JOIN downloads d ON ps.song_query = d.query 
            WHERE ps.playlist_id = ? AND d.image_url IS NOT NULL AND d.image_url != ''
            ORDER BY ps.position ASC 
            LIMIT 4
        ''', (p['id'],))
        images = [r[0] for r in c.fetchall()]
        p['images'] = images
        playlists.append(p)
        
    conn.close()
    return playlists


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
            
        # Match with local DB
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        
        # Create Playlist
        created_at = datetime.now()
        c.execute('INSERT INTO playlists (name, description, type, created_at) VALUES (?, ?, ?, ?)', 
                  (req.name, req.description, 'manual', created_at))
        playlist_id = c.lastrowid
        
        # Find Matches
        added_count = 0
        for track in tracks:
            # Query format: "Artist - Title"
            # We try exact match first
            query = f"{track['artist']} - {track['title']}"
            
            # Check if exists in downloads (completed)
            c.execute('SELECT query FROM downloads WHERE query = ? AND status = "completed"', (query,))
            row = c.fetchone()
            
            if not row:
                # Try sloppy match? (Simple string search might be dangerous for "Playlist", let's stick to query id)
                # Maybe try search by artist AND title separately?
                c.execute('SELECT query FROM downloads WHERE artist = ? AND title = ? AND status = "completed"', 
                          (track['artist'], track['title']))
                row = c.fetchone()
                
            if row:
                song_query = row[0]
                # Add to playlist
                c.execute('INSERT INTO playlist_songs (playlist_id, song_query, position, added_at) VALUES (?, ?, ?, ?)',
                          (playlist_id, song_query, added_count, datetime.now()))
                added_count += 1
                
        conn.commit()
        conn.close()
        
        return {
            "id": playlist_id,
            "name": req.name,
            "song_count": added_count,
            "message": f"Created playlist with {added_count} songs matched from your top tracks."
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
        # 1. Get Top Artists (Proxy for "My Artists")
        artists_data = lastfm_service.get_genre_breakdown(user, period="overall") 
        # Wait, get_genre_breakdown returns tags. We need artists.
        # Let's call get_top_tracks or generic Top Artists if exposed.
        # lastfm_service.get_top_artists isn't public? It IS used inside get_genre_breakdown but not exposed.
        # Actually I can access `lastfm_service.network` if I really want but that's messy.
        # Let's rely on `get_all_artists` from database (LOCAL artists) and filter them.
        from database import get_all_artists
        local_artists = get_all_artists() # Returns list of strings
        
        # This might be huge. We can't check tags for 1000 artists.
        # Strategy: Random sample? Or just first 50?
        # Better: Check DB for most downloaded artists?
        
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute('SELECT artist, COUNT(*) as cnt FROM downloads GROUP BY artist ORDER BY cnt DESC LIMIT 50')
        top_local_artists = [r[0] for r in c.fetchall()]
        
        valid_artists = []
        target_tag = req.tag.lower()
        
        for artist in top_local_artists:
            tags = lastfm_service._get_artist_tags(artist)
            # Check for match (partial?)
            # API tags are title case.
            if any(target_tag in t.lower() for t in tags):
                valid_artists.append(artist)
                
        if not valid_artists:
             conn.close()
             return {"message": f"No artists found with tag '{req.tag}' in your top 50 local artists."}
             
        # Create Playlist
        created_at = datetime.now()
        c.execute('INSERT INTO playlists (name, description, type, created_at) VALUES (?, ?, ?, ?)', 
                  (req.name, req.description, 'manual', created_at))
        playlist_id = c.lastrowid
        
        # Add songs by these artists
        placeholders = ','.join(['?'] * len(valid_artists))
        c.execute(f'''
            SELECT query FROM downloads 
            WHERE artist IN ({placeholders}) AND status = "completed"
            ORDER BY RANDOM() LIMIT 100
        ''', valid_artists)
        
        songs = c.fetchall()
        for idx, (q,) in enumerate(songs):
             c.execute('INSERT INTO playlist_songs (playlist_id, song_query, position, added_at) VALUES (?, ?, ?, ?)',
                          (playlist_id, q, idx, datetime.now()))
                          
        conn.commit()
        conn.close()
        
        return {
            "id": playlist_id,
            "name": req.name,
            "song_count": len(songs),
            "message": f"Created genre mix with {len(songs)} songs from {len(valid_artists)} artists."
        }

    except Exception as e:
        logger.error(f"Error generating genre playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/playlists", response_model=Playlist)
async def create_playlist(playlist: PlaylistCreate):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        created_at = datetime.now()
        created_at = datetime.now()
        c.execute('INSERT INTO playlists (name, description, type, rules, color, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
                  (playlist.name, playlist.description, playlist.type, playlist.rules, playlist.color, created_at))
        playlist_id = c.lastrowid
        conn.commit()
        return {
            "id": playlist_id,
            "name": playlist.name,
            "description": playlist.description,
            "type": playlist.type,
            "rules": playlist.rules,
            "color": playlist.color,
            "created_at": str(created_at),
            "song_count": 0
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Playlist with this name already exists")
    finally:
        conn.close()

@router.get("/playlists/tags")
async def get_available_tags():
    """
    Scans recent/top artists in library and returns aggregated tags.
    """
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        # Get top 50 local artists by song count
        c.execute('SELECT artist, COUNT(*) as cnt FROM downloads GROUP BY artist ORDER BY cnt DESC LIMIT 50')
        artists = [r[0] for r in c.fetchall()]
        conn.close()
        
        tag_counts = Counter()
        from core import lastfm_service # Ensure import
        
        for artist in artists:
            tags = lastfm_service._get_artist_tags(artist)
            for tag in tags:
                tag_counts[tag] += 1
                
        # Return top 50 tags
        top_tags = [tag for tag, count in tag_counts.most_common(50)]
        return top_tags
        
    except Exception as e:
        logger.error(f"Error fetching tags: {e}")
        return []

@router.get("/playlists/{playlist_id}", response_model=PlaylistDetail)
async def get_playlist_detail(playlist_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Get playlist info
    c.execute('SELECT * FROM playlists WHERE id = ?', (playlist_id,))
    playlist = c.fetchone()
    if not playlist:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    # Get songs
    if playlist['type'] == 'smart' and playlist['rules']:
        import json
        try:
            rules_data = json.loads(playlist['rules'])
            match_type = rules_data.get('match_type', 'all') # 'all' (AND) or 'any' (OR)
            rules = rules_data.get('rules', [])
            
            if not rules:
                songs = []
            else:
                query_parts = ["SELECT 0 as position, * FROM downloads WHERE status = 'completed'"]
                conditions = []
                params = []
                
                for rule in rules:
                    field = rule.get('field')
                    operator = rule.get('operator')
                    value = rule.get('value')
                    
                    clause = ""
                    if field in ['artist', 'album', 'title']:
                        if operator == 'contains':
                            clause = f"{field} LIKE ?"
                            params.append(f"%{value}%")
                        elif operator == 'is':
                            clause = f"{field} = ?"
                            params.append(value)
                        elif operator == 'is_not':
                            clause = f"{field} != ?"
                            params.append(value)
                    elif field == 'created_at':
                        # Value expected to be days ago, or specific date? 
                        # Let's assume 'days_ago' for simplicity in V1 for "Recently Added"
                        # Or 'date_range'
                        pass 

                    if clause:
                        conditions.append(clause)
                
                if conditions:
                    join_op = " AND " if match_type == 'all' else " OR "
                    query_parts.append(f"AND ({join_op.join(conditions)})")
                
                query_parts.append("ORDER BY created_at DESC")
                
                sql = " ".join(query_parts)
                c.execute(sql, params)
                songs = c.fetchall()
        except Exception as e:
            print(f"Error executing smart playlist strings: {e}")
            songs = []
            
    else:
        # Manual playlist
        c.execute('''
            SELECT ps.position, d.* 
            FROM playlist_songs ps
            JOIN downloads d ON ps.song_query = d.query
            WHERE ps.playlist_id = ?
            ORDER BY ps.position ASC
        ''', (playlist_id,))
        songs = c.fetchall()
    
    # Process songs (add audio_url)
    song_list = []
    from routers.downloads import sanitize_filename
    images = [] # Collect images for the playlist cover
    for song in songs:
        item = dict(song)
        s_artist = sanitize_filename(item['artist'])
        s_album = sanitize_filename(item['album'])
        s_title = sanitize_filename(item['title'])
        item['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
        song_list.append(item)
        
        # Collect unique images up to 4
        if item.get('image_url') and item['image_url'] not in images and len(images) < 4:
            images.append(item['image_url'])
        
    conn.close()
    
    result = dict(playlist)
    result['created_at'] = str(result['created_at'])
    result['songs'] = song_list
    result['song_count'] = len(song_list)
    result['images'] = images
    return result

@router.post("/playlists/{playlist_id}/add")
async def add_song_to_playlist(playlist_id: int, song: PlaylistAddSong):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Verify playlist exists
    c.execute('SELECT id FROM playlists WHERE id = ?', (playlist_id,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Get max position
    c.execute('SELECT MAX(position) FROM playlist_songs WHERE playlist_id = ?', (playlist_id,))
    max_pos = c.fetchone()[0]
    next_pos = (max_pos + 1) if max_pos is not None else 0
    
    try:
        c.execute('''
            INSERT INTO playlist_songs (playlist_id, song_query, position, added_at)
            VALUES (?, ?, ?, ?)
        ''', (playlist_id, song.song_query, next_pos, datetime.now()))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
        
    conn.close()
    return {"status": "added", "position": next_pos}

@router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: int, playlist: PlaylistCreate):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute('UPDATE playlists SET name = ?, description = ? WHERE id = ?', 
                  (playlist.name, playlist.description, playlist_id))
        if c.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Playlist not found")
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Playlist with this name already exists")
    finally:
        conn.close()
    return {"status": "updated", "id": playlist_id}

class ReorderItem(BaseModel):
    song_query: str
    new_position: int

@router.put("/playlists/{playlist_id}/reorder")
async def reorder_playlist(playlist_id: int, items: List[ReorderItem]):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Verify playlist exists
    c.execute('SELECT id FROM playlists WHERE id = ?', (playlist_id,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    try:
        # We'll use a transaction to update all positions safely
        for item in items:
            c.execute('UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_query = ?',
                      (item.new_position, playlist_id, item.song_query))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
        
    conn.close()
    return {"status": "reordered"}

@router.delete("/playlists/{playlist_id}/songs/{song_query}")
async def remove_song_from_playlist(playlist_id: int, song_query: str):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_query = ?', (playlist_id, song_query))
    conn.commit()
    conn.close()
    return {"status": "removed"}

@router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: int):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('DELETE FROM playlist_songs WHERE playlist_id = ?', (playlist_id,))
    c.execute('DELETE FROM playlists WHERE id = ?', (playlist_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@router.get("/playlists/{playlist_id}/stats")
async def get_playlist_stats(playlist_id: int):
    # Fetch playlist details first to get the song list (which handles smart/manual logic)
    playlist_detail = await get_playlist_detail(playlist_id)
    songs = playlist_detail['songs']
    
    if not songs:
        return {
            "total_songs": 0,
            "total_artists": 0,
            "top_artists": [],
            "years_distribution": {}
        }
        
    artists = [s['artist'] for s in songs if s.get('artist')]
    artist_counts = Counter(artists).most_common(5)
    
    # Simple 'added_at' timeline (by month?) - strictly for manual playlists it's 'added_at', for smart it's 'created_at' of song
    # Let's use 'created_at' which exists on downloads table and is what we have in song items
    dates = []
    for s in songs:
        dt = s.get('created_at')
        if dt:
            # truncate to YYYY-MM
            try:
                if isinstance(dt, str):
                    dates.append(dt[:7]) 
                else:
                    dates.append(str(dt)[:7])
            except: pass
            
    timeline = dict(Counter(dates).most_common(12)) # Top 12 months? Or just sorted?
    # Better to sort by date for a timeline
    sorted_timeline = dict(sorted(timeline.items()))

    return {
        "total_songs": len(songs),
        "total_artists": len(set(artists)),
        "top_artists": [{"artist": a, "count": c} for a, c in artist_counts],
        "timeline": sorted_timeline
    }

@router.get("/playlists/{playlist_id}/recommendations")
async def get_playlist_recommendations(playlist_id: int, limit: int = 10):
    playlist_detail = await get_playlist_detail(playlist_id)
    current_song_queries = {s['query'] for s in playlist_detail['songs']}
    
    if not current_song_queries:
        return []

    # Strategy: Find songs by the same artists in the library that are NOT in the playlist
    artists = list({s['artist'] for s in playlist_detail['songs'] if s.get('artist')})
    
    if not artists:
        return []
        
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # We can't pass all artists if list is huge. Limit to top 20 artists
    all_artists = [s['artist'] for s in playlist_detail['songs'] if s.get('artist')]
    top_artists = [a for a, c in Counter(all_artists).most_common(20)]
    
    placeholders = ','.join(['?'] * len(top_artists))
    query = f'''
        SELECT * FROM downloads 
        WHERE status = 'completed' 
        AND artist IN ({placeholders})
        ORDER BY RANDOM() 
        LIMIT 50
    '''
    
    try:
        c.execute(query, top_artists)
        candidates = c.fetchall()
        
        recommendations = []
        for r in candidates:
            row = dict(r)
            if row['query'] not in current_song_queries:
                # Format it
                from routers.downloads import sanitize_filename
                s_artist = sanitize_filename(row['artist'])
                s_album = sanitize_filename(row['album'])
                s_title = sanitize_filename(row['title'])
                row['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
                recommendations.append(row)
                if len(recommendations) >= limit:
                    break
                    
        conn.close()
        return recommendations
        
    except Exception as e:
        print(f"Error getting recs: {e}")
        conn.close()
        return []

