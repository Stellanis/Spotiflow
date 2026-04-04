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
    find_download_by_track,
    get_download_status,
    get_downloads,
    get_all_pending_downloads,
    get_all_failed_downloads,
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

from .repositories.discover import (
    dismiss_track,
    get_dismissed_tracks
)

from .repositories.jobs import (
    create_job,
    add_job_event,
    update_job,
    mark_job_running,
    mark_job_succeeded,
    mark_job_failed,
    increment_job_retry,
    get_job,
    find_active_job,
    list_jobs,
    get_job_events,
    get_job_summary
)

from .repositories.intelligence import (
    upsert_artist,
    upsert_album,
    upsert_track,
    upsert_artist_alias,
    upsert_album_alias,
    upsert_track_enrichment,
    list_enriched_tracks,
    replace_sessions,
    get_sessions,
    add_feedback,
    get_feedback_map,
    ignore_item,
    get_ignored_items,
    upsert_release_watch_artist,
    list_release_watch_artists,
    upsert_artist_release,
    list_releases,
    mark_release_state,
    set_feature_refresh_state,
    get_feature_refresh_state
)

from .repositories.playback import (
    create_radio_session,
    get_radio_session,
    update_radio_session,
    list_active_radio_sessions,
    get_streaming_dashboard_stats,
    add_playback_event,
    list_playback_events,
    get_playback_event_counts,
    upsert_stream_source,
    get_stream_source,
    get_stream_source_by_cache_key,
    find_recent_stream_source,
    mark_stream_source_failure,
    mark_stream_source_verified,
    list_recent_stream_sources,
    get_stream_failure_counts,
)
