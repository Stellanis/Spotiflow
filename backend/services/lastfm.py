from .api_client import LastFMApiClient
from .cache_manager import CacheManager
from .image_provider import ImageProvider
from .lastfm_support.artist_data import (
    get_artist_image,
    get_artist_info,
    get_artist_listeners,
    get_artist_tags,
    get_artist_top_albums,
    get_artist_top_tracks,
    get_similar_artists,
    get_top_artists,
)
from .lastfm_support.history import get_on_this_day
from .lastfm_support.sync import sync_scrobbles_to_db
from .lastfm_support.track_info import get_track_info
from .lastfm_support.user_tracks import (
    get_cached_recent_tracks,
    get_recent_tracks,
    get_top_tracks,
    prefetch_track_infos,
    refresh_stats_cache,
)


class LastFMService:
    def __init__(self):
        self.cache = CacheManager(ttl=86400)
        self.client = LastFMApiClient()
        self.image_provider = ImageProvider()

    get_recent_tracks = get_recent_tracks
    get_top_tracks = get_top_tracks
    get_track_info = get_track_info
    get_cached_recent_tracks = get_cached_recent_tracks
    prefetch_track_infos = prefetch_track_infos
    refresh_stats_cache = refresh_stats_cache
    get_artist_listeners = get_artist_listeners
    get_artist_tags = get_artist_tags
    get_artist_image = get_artist_image
    get_on_this_day = get_on_this_day
    get_top_artists = get_top_artists
    sync_scrobbles_to_db = sync_scrobbles_to_db
    get_artist_top_albums = get_artist_top_albums
    get_similar_artists = get_similar_artists
    get_artist_info = get_artist_info
    get_artist_top_tracks = get_artist_top_tracks
