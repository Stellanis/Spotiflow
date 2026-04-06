import axios from 'axios';

export function resolvePlayable(track) {
    return axios.get('/api/playback/resolve', {
        params: {
            artist: track.artist,
            title: track.title,
            album: track.album || null,
            preview_url: track.preview_url || null,
        },
    }).then((response) => response.data);
}

export function getActiveSession() {
    return axios.get('/api/playback/session/active');
}

export function getSessionById(sessionId) {
    return axios.get(`/api/playback/session/${sessionId}`);
}

export function sendPlaybackEventRequest(payload) {
    return axios.post('/api/playback/event', payload);
}

export function startPlaybackRequest(payload) {
    return axios.post('/api/playback/start', payload);
}

export function playNowRequest(payload) {
    return axios.post('/api/playback/queue/play-now', payload);
}

export function addQueueItemsRequest(payload) {
    return axios.post('/api/playback/queue/add', payload);
}

export function removeQueueItemRequest(payload) {
    return axios.post('/api/playback/queue/remove', payload);
}

export function reorderQueueRequest(payload) {
    return axios.post('/api/playback/queue/reorder', payload);
}

export function clearUpcomingRequest(payload) {
    return axios.post('/api/playback/queue/clear-upcoming', payload);
}

export function nextTrackRequest(payload) {
    return axios.post('/api/playback/next', payload);
}

export function restartRadioRequest(payload) {
    return axios.post('/api/playback/radio/restart', payload);
}
