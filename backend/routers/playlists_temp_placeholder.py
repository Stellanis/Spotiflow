from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime
from collections import Counter
from database import DB_NAME, get_download_info
from core import lastfm_service, logger

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

# ... (Existing get_db, get_playlists, create_playlist, get_playlist_detail) ...

# NOTE: I will use multi_replace to insert the new endpoints to avoid overwriting the whole file and missing parts 
# But wait, looking at the previous view_file, the file is 400 lines. write_to_file replaces WHOLE content if I don't use replace_file_content. 
# It's safer to use replace_file_content or multi_replace. 
# But replacing a large chunk with new imports and classes...
# I'll use multi_replace to add imports and classes, then add endpoints.

# Actually, I can just use `write_to_file` if I had the full content, but I might miss something.
# I will use `replace_file_content` to add imports/models, and then append the new endpoints at the end or before stats.
