export function normalizeTrack(track) {
    if (!track) return null;
    return {
        ...track,
        image: track.image || track.image_url || null,
        image_url: track.image_url || track.image || null,
    };
}

export function mergeTrackWithPlayable(track, playable) {
    const normalized = normalizeTrack(track);
    return {
        ...normalized,
        audio_url: playable.audio_url,
        playable,
        playbackType: playable.playback_type,
        sourceName: playable.source_name,
        sourceUrl: playable.source_url,
        canPromote: playable.is_promotable,
        stream_source_id: playable.stream_source_id,
    };
}

export function buildRequestTrack(track) {
    return {
        artist: track.artist,
        title: track.title,
        album: track.album || null,
        preview_url: track.preview_url || null,
        image: track.image || track.image_url || null,
        canonical_track_id: track.canonical_track_id || null,
        seed_type: track.seed_type || null,
        seed_context: track.seed_context || { recommended_because: track.recommended_because || track.reason || null },
        track_key: track.track_key || null,
    };
}

export function tracksMatch(left, right) {
    if (!left || !right) return false;
    if (left.track_key && right.track_key) {
        return left.track_key === right.track_key;
    }
    return left.artist === right.artist && left.title === right.title;
}
