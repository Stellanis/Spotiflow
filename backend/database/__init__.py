from .core import init_db, DB_NAME, get_connection

from .repositories.scrobbles import (
    add_scrobble,
    add_scrobbles_batch,
    get_scrobbles_from_db,
    get_latest_scrobble_timestamp,
    get_total_scrobbles_count,
    get_scrobbles_in_range,
    get_all_scrobbles,
    get_top_artists_from_db,
    get_top_tracks_from_db
)

from .repositories.downloads import (
    add_download,
    is_downloaded,
    get_downloads_batch,
    get_download_info,
    get_download_status,
    get_downloads,
    get_all_pending_downloads,
    get_total_downloads_count,
    get_all_artists,
    get_all_artists_with_counts,
    get_all_albums
)

from .repositories.settings import (
    get_setting,
    set_setting,
    get_all_settings
)

from .repositories.concerts import (
    add_concert,
    get_cached_concerts,
    clear_concerts,
    add_favorite_artist,
    remove_favorite_artist,
    get_favorite_artists,
    add_reminder,
    remove_reminder,
    get_reminders,
    is_reminder_set,
    delete_past_concerts
)

from .repositories.playlists import (
    get_playlists_with_stats,
    create_playlist,
    get_playlist_by_id,
    get_playlist_songs,
    add_song_to_playlist,
    remove_song_from_playlist,
    delete_playlist,
    update_playlist_details,
    reorder_playlist_songs,
    get_top_local_artists,
    get_candidates_for_recommendation,
    find_local_song,
    add_songs_to_playlist_batch
)
