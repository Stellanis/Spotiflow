from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime
from database import DB_NAME, get_download_info

router = APIRouter(tags=["playlists"])

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None

class PlaylistAddSong(BaseModel):
    playlist_id: int
    song_query: str

class Playlist(BaseModel):
    id: int
    name: str
    description: Optional[str]
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


@router.post("/playlists", response_model=Playlist)
async def create_playlist(playlist: PlaylistCreate):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        created_at = datetime.now()
        c.execute('INSERT INTO playlists (name, description, created_at) VALUES (?, ?, ?)', 
                  (playlist.name, playlist.description, created_at))
        playlist_id = c.lastrowid
        conn.commit()
        return {
            "id": playlist_id,
            "name": playlist.name,
            "description": playlist.description,
            "created_at": str(created_at),
            "song_count": 0
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Playlist with this name already exists")
    finally:
        conn.close()

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

