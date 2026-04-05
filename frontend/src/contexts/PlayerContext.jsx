import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const PlayerContext = createContext();
const PLAYER_SESSION_STORAGE_KEY = 'spotiflow.player.sessionId';

function normalizeTrack(track) {
    if (!track) return null;
    return {
        ...track,
        image: track.image || track.image_url || null,
        image_url: track.image_url || track.image || null,
    };
}

function mergeTrackWithPlayable(track, playable) {
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

function buildRequestTrack(track) {
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

export function PlayerProvider({ children }) {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(-1);
    const [queueSummary, setQueueSummary] = useState(null);
    const [activeDownloads, setActiveDownloads] = useState([]);
    const [showLyrics, setShowLyrics] = useState(false);
    const [showQueuePanel, setShowQueuePanel] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [queueMode, setQueueMode] = useState(null);
    const [sessionStatus, setSessionStatus] = useState(null);
    const [playbackType, setPlaybackType] = useState(null);
    const [sourceName, setSourceName] = useState(null);
    const [streamStatus, setStreamStatus] = useState('idle');
    const [retryCount, setRetryCount] = useState(0);
    const [buffering, setBuffering] = useState(false);
    const [canPromote, setCanPromote] = useState(false);
    const [isPromoted, setIsPromoted] = useState(false);
    const [hasSuspendedRadio, setHasSuspendedRadio] = useState(false);

    const audioRef = useRef(new Audio());
    const wsRef = useRef(null);
    const hasRestoredSessionRef = useRef(false);
    const sessionIdRef = useRef(null);

    const syncSessionState = (payload) => {
        const resolvedQueue = (payload.queue || []).map(normalizeTrack);
        const nextSessionId = payload.session_id ?? payload.sessionId ?? null;
        sessionIdRef.current = nextSessionId;
        setSessionId(nextSessionId);
        setQueueMode(payload.mode || payload.queue_mode || null);
        setSessionStatus(payload.status || null);
        setQueue(resolvedQueue);
        setQueueIndex(payload.current_index ?? -1);
        setQueueSummary(payload.queue_summary || null);
        setHasSuspendedRadio(Boolean(payload.suspended_queue_summary?.total));
    };

    const loadPlayableTrack = async (track, playable, options = {}) => {
        const audio = audioRef.current;
        const resolvedTrack = mergeTrackWithPlayable(track, playable);
        if (options.sessionPayload) {
            syncSessionState(options.sessionPayload);
        } else {
            const nextQueue = options.queue || queue;
            const nextIndex = typeof options.queueIndex === 'number'
                ? options.queueIndex
                : nextQueue.findIndex((item) => item.track_key === resolvedTrack.track_key);
            if (options.queue) setQueue(nextQueue);
            if (nextIndex >= 0) setQueueIndex(nextIndex);
            if (options.sessionId !== undefined) {
                sessionIdRef.current = options.sessionId;
                setSessionId(options.sessionId);
            }
            if (options.queueMode) setQueueMode(options.queueMode);
        }

        setCurrentTrack(resolvedTrack);
        setPlaybackType(playable.playback_type);
        setSourceName(playable.source_name);
        setCanPromote(Boolean(playable.is_promotable));
        setIsPromoted(false);
        setRetryCount(0);
        setStreamStatus(
            options.streamHealth?.status && options.streamHealth.status !== 'healthy'
                ? options.streamHealth.status
                : playable.playback_type === 'local'
                    ? 'ready'
                    : 'streaming'
        );
        setIsReady(false);
        setProgress(0);

        audio.src = playable.audio_url;
        audio.load();

        if (options.autoplay === false) {
            setIsPlaying(false);
            return resolvedTrack;
        }

        try {
            await audio.play();
            setIsPlaying(true);
            if (options.sendStartEvent !== false) {
                await sendPlaybackEvent('start', resolvedTrack);
            }
        } catch (error) {
            setIsPlaying(false);
            setStreamStatus('error');
            console.error('Playback failed', error);
            toast.error(`Playback failed for "${resolvedTrack.title}"`);
        }
        return resolvedTrack;
    };

    const loadSessionResponse = async (payload, options = {}) => {
        syncSessionState(payload);
        const track = normalizeTrack(payload.track);
        if (!track) {
            setCurrentTrack(null);
            setPlaybackType(null);
            setSourceName(null);
            return null;
        }
        const playable = payload.playable || await axios.get('/api/playback/resolve', {
            params: {
                artist: track.artist,
                title: track.title,
                album: track.album || null,
                preview_url: track.preview_url || null,
            },
        }).then((response) => response.data);
        return loadPlayableTrack(track, playable, {
            autoplay: options.autoplay,
            sendStartEvent: options.sendStartEvent,
            sessionPayload: payload,
            streamHealth: payload.stream_health || null,
        });
    };

    const refreshActiveSession = async (preferredSessionId = null, options = {}) => {
        try {
            let response;
            try {
                response = await axios.get('/api/playback/session/active');
            } catch (error) {
                if (!preferredSessionId) throw error;
                response = await axios.get(`/api/playback/session/${preferredSessionId}`);
            }
            await loadSessionResponse(response.data, {
                autoplay: options.autoplay ?? false,
                sendStartEvent: false,
            });
            if (typeof window !== 'undefined' && response.data.session_id) {
                window.localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, String(response.data.session_id));
            }
            setStreamStatus('restored');
            return response.data;
        } catch (error) {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
            }
            if (error?.response?.status === 404) {
                sessionIdRef.current = null;
                setSessionId(null);
                setQueue([]);
                setQueueIndex(-1);
                setQueueMode(null);
                setQueueSummary(null);
                setHasSuspendedRadio(false);
            } else {
                console.error('Failed to refresh active session', error);
            }
            return null;
        }
    };

    useEffect(() => {
        const connect = () => {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.active_downloads) {
                        setActiveDownloads(data.active_downloads);
                    }
                    if (data.type === 'playback.session' && data.session_id && data.session_id === sessionIdRef.current) {
                        if (data.queue) {
                            syncSessionState(data);
                        }
                        if (data.stream_health?.status) {
                            setStreamStatus(data.stream_health.status === 'healthy' ? 'streaming' : data.stream_health.status);
                            if (data.stream_health.status === 'cooldown') {
                                toast.error('Stream source is cooling down after repeated playback errors');
                            }
                        }
                        if (data.event?.event_type === 'error') {
                            setStreamStatus('error');
                        }
                        if (Array.isArray(data.promotion_events) && data.promotion_events.length > 0) {
                            setIsPromoted(true);
                            toast.success(`Queued "${data.promotion_events[0].title}" for download`);
                        }
                    }
                } catch (error) {
                    console.error('WS parse error', error);
                }
            };

            ws.onclose = () => {
                setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        connect();
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [sessionId]);

    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!hasRestoredSessionRef.current) return;
        const payload = {
            sessionId,
            queueMode,
            queueIndex,
            queue,
            currentTrack,
            playbackType,
            sourceName,
            canPromote,
            isPromoted,
        };
        window.localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, JSON.stringify(payload));
    }, [sessionId, queueMode, queueIndex, queue, currentTrack, playbackType, sourceName, canPromote, isPromoted]);

    useEffect(() => {
        if (hasRestoredSessionRef.current || typeof window === 'undefined') return;
        hasRestoredSessionRef.current = true;

        const restoreSession = async () => {
            const raw = window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
            if (!raw) return;

            try {
                const saved = JSON.parse(raw);
                if (!saved?.sessionId || saved.queueMode !== 'radio') return;

                const response = await axios.get(`/api/playback/session/${saved.sessionId}`);
                const session = response.data;
                const restoredQueue = session.queue_payload || [];
                const restoredIndex = session.current_index ?? 0;
                const restoredTrack = restoredQueue[restoredIndex];
                if (!restoredTrack) return;

                const playableResponse = await axios.get('/api/playback/resolve', {
                    params: {
                        artist: restoredTrack.artist,
                        title: restoredTrack.title,
                        album: restoredTrack.album || null,
                        preview_url: restoredTrack.preview_url || null,
                    },
                });

                await loadPlayableTrack(restoredTrack, playableResponse.data, {
                    queue: restoredQueue,
                    queueIndex: restoredIndex,
                    sessionId: session.id,
                    queueMode: 'radio',
                    autoplay: false,
                    sendStartEvent: false,
                    streamHealth: session.stream_health || null,
                });
                setStreamStatus('restored');
            } catch (error) {
                console.error('Failed to restore player session', error);
                sessionIdRef.current = null;
                window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
            }
        };

        restoreSession();
    }, []);

    const sendPlaybackEvent = async (eventType, trackOverride = null, extras = {}) => {
        const track = trackOverride || currentTrack;
        if (!track) return null;
        try {
            const response = await axios.post('/api/playback/event', {
                session_id: sessionId,
                artist: track.artist,
                title: track.title,
                album: track.album || null,
                event_type: eventType,
                position_seconds: audioRef.current.currentTime || extras.position_seconds || 0,
                duration_seconds: audioRef.current.duration || duration || extras.duration_seconds || null,
                playback_type: playbackType || track.playbackType || 'local',
                source_name: sourceName || track.sourceName || null,
                source_url: track.sourceUrl || null,
                stream_source_id: track.stream_source_id || null,
                image: track.image || track.image_url || null,
                error_message: extras.error_message || null,
            });
            if (response.data?.promotion?.status) {
                setIsPromoted(true);
            }
            return response.data;
        } catch (error) {
            console.error('Failed to send playback event', error);
            return null;
        }
    };

    const startManualQueue = async (items, startIndex = 0) => {
        const response = await axios.post('/api/playback/start', {
            ...buildRequestTrack(items[startIndex]),
            mode: 'manual',
            queue_items: items.map(buildRequestTrack),
            start_index: startIndex,
            replace_active_session: true,
        });
        await loadSessionResponse(response.data);
        return response.data;
    };

    const startRadioQueue = async (track) => {
        const response = await axios.post('/api/playback/start', {
            ...buildRequestTrack(track),
            mode: 'radio',
        });
        await loadSessionResponse(response.data);
        return response.data;
    };

    const resolveAndPlayTrack = async (track) => {
        return startRadioQueue(track);
    };

    const playTrack = async (track, newQueue = null) => {
        const normalizedTrack = normalizeTrack(track);
        if (newQueue?.length) {
            const items = newQueue.map(normalizeTrack);
            const startIndex = Math.max(0, items.findIndex((item) => item.track_key === normalizedTrack.track_key || (item.artist === normalizedTrack.artist && item.title === normalizedTrack.title)));
            await startManualQueue(items, startIndex);
            return;
        }

        if (normalizedTrack.reason || normalizedTrack.recommended_because || normalizedTrack.seed_type === 'recommendation') {
            await startRadioQueue(normalizedTrack);
            return;
        }

        await startManualQueue([normalizedTrack], 0);
    };

    const playQueueNow = async (items, startIndex = 0) => {
        const response = await axios.post('/api/playback/queue/play-now', {
            items: items.map(buildRequestTrack),
            start_index: startIndex,
            session_id: sessionId,
        });
        await loadSessionResponse(response.data);
        return response.data;
    };

    const addToQueueNext = async (track) => {
        const response = await axios.post('/api/playback/queue/add', {
            session_id: sessionId,
            placement: 'next',
            items: [buildRequestTrack(track)],
        });
        syncSessionState(response.data);
        return response.data;
    };

    const addToQueueEnd = async (track) => {
        const response = await axios.post('/api/playback/queue/add', {
            session_id: sessionId,
            placement: 'end',
            items: [buildRequestTrack(track)],
        });
        syncSessionState(response.data);
        return response.data;
    };

    const removeFromQueue = async (trackKey) => {
        const response = await axios.post('/api/playback/queue/remove', {
            session_id: sessionId,
            track_key: trackKey,
        });
        syncSessionState(response.data);
        return response.data;
    };

    const reorderQueue = async (orderedTrackKeys) => {
        const response = await axios.post('/api/playback/queue/reorder', {
            session_id: sessionId,
            ordered_track_keys: orderedTrackKeys,
        });
        syncSessionState(response.data);
        return response.data;
    };

    const clearUpcoming = async () => {
        const response = await axios.post('/api/playback/queue/clear-upcoming', {
            session_id: sessionId,
        });
        syncSessionState(response.data);
        return response.data;
    };

    const restartRadio = async (track = currentTrack) => {
        if (!track) return null;
        const response = await axios.post('/api/playback/radio/restart', buildRequestTrack(track));
        await loadSessionResponse(response.data);
        return response.data;
    };

    const nextTrack = async () => {
        if (!sessionId) return;
        try {
            const response = await axios.post('/api/playback/next', {
                session_id: sessionId,
                current_track: currentTrack,
                reason: 'next',
            });
            await loadSessionResponse(response.data);
        } catch (error) {
            if (error?.response?.status === 404) {
                setIsPlaying(false);
                setStreamStatus('idle');
            } else {
                console.error('Failed to fetch next track', error);
            }
        }
    };

    const prevTrack = async () => {
        if (audioRef.current.currentTime > 5) {
            audioRef.current.currentTime = 0;
            setProgress(0);
            return;
        }
        if (queueIndex > 0) {
            await playQueueNow(queue, queueIndex - 1);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;

        const handleTimeUpdate = () => {
            setProgress(audio.currentTime);
        };
        const handleDurationChange = () => {
            setDuration(audio.duration || 0);
        };
        const handleEnded = async () => {
            setIsPlaying(false);
            setProgress(0);
            await sendPlaybackEvent('ended');
            await nextTrack();
        };
        const handleCanPlay = () => {
            setIsReady(true);
            setBuffering(false);
        };
        const handleWaiting = () => {
            setBuffering(true);
        };
        const handlePause = () => {
            setIsPlaying(false);
        };
        const handlePlaying = () => {
            setIsPlaying(true);
            setBuffering(false);
        };
        const handleError = async () => {
            setStreamStatus('error');
            await sendPlaybackEvent('error', null, { error_message: 'audio_element_error' });
            if (retryCount < 1 && currentTrack && currentTrack.playbackType !== 'local') {
                setRetryCount((count) => count + 1);
                toast.error(`Retrying stream for "${currentTrack.title}"`);
                try {
                    const response = await axios.get('/api/playback/resolve', {
                        params: {
                            artist: currentTrack.artist,
                            title: currentTrack.title,
                            album: currentTrack.album || null,
                            preview_url: currentTrack.preview_url || null,
                        },
                    });
                    await loadPlayableTrack(currentTrack, response.data, {
                        autoplay: true,
                        sendStartEvent: false,
                        sessionPayload: {
                            session_id: sessionId,
                            mode: queueMode,
                            status: sessionStatus,
                            queue,
                            current_index: queueIndex,
                            queue_summary: queueSummary,
                            suspended_queue_summary: hasSuspendedRadio ? { total: 1 } : null,
                        },
                    });
                    return;
                } catch (error) {
                    console.error('Stream retry failed', error);
                }
            }
            toast.error('Stream failed, skipping to the next track');
            await nextTrack();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('waiting', handleWaiting);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('playing', handlePlaying);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('waiting', handleWaiting);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('playing', handlePlaying);
            audio.removeEventListener('error', handleError);
        };
    }, [currentTrack, duration, retryCount, sessionId, playbackType, sourceName, queue, queueIndex, queueMode, sessionStatus, queueSummary, hasSuspendedRadio]);

    const togglePlay = async () => {
        if (!currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
            await sendPlaybackEvent('pause');
        } else {
            await audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const seek = (time) => {
        audioRef.current.currentTime = time;
        setProgress(time);
    };

    const updateVolume = (val) => {
        setVolume(val);
        audioRef.current.volume = val;
    };

    return (
        <PlayerContext.Provider value={{
            currentTrack,
            isPlaying,
            volume,
            progress,
            duration,
            isReady,
            playTrack,
            resolveAndPlayTrack,
            togglePlay,
            seek,
            updateVolume,
            activeDownloads,
            nextTrack,
            prevTrack,
            queue,
            queueIndex,
            queueSummary,
            showLyrics,
            toggleLyrics: () => setShowLyrics((prev) => !prev),
            setShowLyrics,
            showQueuePanel,
            setShowQueuePanel,
            sessionId,
            queueMode,
            sessionStatus,
            playbackType,
            sourceName,
            streamStatus,
            retryCount,
            buffering,
            canPromote,
            isPromoted,
            hasSuspendedRadio,
            addToQueueNext,
            addToQueueEnd,
            removeFromQueue,
            reorderQueue,
            clearUpcoming,
            playQueueNow,
            refreshActiveSession,
            restartRadio,
            sendPlaybackEvent,
        }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    return useContext(PlayerContext);
}
