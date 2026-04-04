import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const PlayerContext = createContext();

function mergeTrackWithPlayable(track, playable) {
    return {
        ...track,
        audio_url: playable.audio_url,
        playable,
        playbackType: playable.playback_type,
        sourceName: playable.source_name,
        sourceUrl: playable.source_url,
        canPromote: playable.is_promotable,
        stream_source_id: playable.stream_source_id,
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
    const [activeDownloads, setActiveDownloads] = useState([]);
    const [showLyrics, setShowLyrics] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [queueMode, setQueueMode] = useState('manual');
    const [playbackType, setPlaybackType] = useState(null);
    const [sourceName, setSourceName] = useState(null);
    const [streamStatus, setStreamStatus] = useState('idle');
    const [retryCount, setRetryCount] = useState(0);
    const [buffering, setBuffering] = useState(false);
    const [canPromote, setCanPromote] = useState(false);
    const [isPromoted, setIsPromoted] = useState(false);

    const audioRef = useRef(new Audio());
    const wsRef = useRef(null);

    useEffect(() => {
        const connect = () => {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.active_downloads) {
                        setActiveDownloads(data.active_downloads);
                    }
                    if (data.type === 'playback.session' && data.session_id && data.session_id === sessionId) {
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

    const loadPlayableTrack = async (track, playable, options = {}) => {
        const audio = audioRef.current;
        const resolvedTrack = mergeTrackWithPlayable(track, playable);
        const nextQueue = options.queue || queue;
        const nextIndex = typeof options.queueIndex === 'number'
            ? options.queueIndex
            : nextQueue.findIndex((item) => item.track_key === resolvedTrack.track_key);

        if (options.queue) setQueue(options.queue);
        if (nextIndex >= 0) setQueueIndex(nextIndex);
        if (options.sessionId !== undefined) setSessionId(options.sessionId);
        if (options.queueMode) setQueueMode(options.queueMode);

        audio.src = playable.audio_url;
        audio.load();

        setCurrentTrack(resolvedTrack);
        setPlaybackType(playable.playback_type);
        setSourceName(playable.source_name);
        setCanPromote(Boolean(playable.is_promotable));
        setIsPromoted(false);
        setRetryCount(0);
        setStreamStatus(playable.playback_type === 'local' ? 'ready' : 'streaming');
        setIsReady(false);

        try {
            await audio.play();
            setIsPlaying(true);
            await sendPlaybackEvent('start', resolvedTrack);
        } catch (error) {
            setIsPlaying(false);
            setStreamStatus('error');
            console.error('Playback failed', error);
            toast.error(`Playback failed for "${resolvedTrack.title}"`);
        }
    };

    const resolveAndPlayTrack = async (track) => {
        const payload = {
            artist: track.artist,
            title: track.title,
            album: track.album || null,
            preview_url: track.preview_url || null,
            image: track.image || track.image_url || null,
            canonical_track_id: track.canonical_track_id || null,
            seed_type: track.seed_type || 'recommendation',
            seed_context: { recommended_because: track.recommended_because || track.reason || null },
        };
        const response = await axios.post('/api/playback/start', payload);
        const resolvedQueue = response.data.queue || [response.data.track];
        await loadPlayableTrack(response.data.track, response.data.playable, {
            queue: resolvedQueue,
            queueIndex: 0,
            sessionId: response.data.session_id,
            queueMode: response.data.queue_mode || 'radio',
        });
        return response.data;
    };

    const playTrack = async (track, newQueue = null) => {
        if (track.audio_url && track.playable) {
            await loadPlayableTrack(track, track.playable, {
                queue: newQueue || queue,
                queueMode: newQueue ? 'manual' : queueMode,
            });
            return;
        }

        if (track.audio_url && !track.is_streamable) {
            await loadPlayableTrack(
                track,
                {
                    audio_url: track.audio_url,
                    playback_type: 'local',
                    source_name: 'local_library',
                    source_url: track.source_url || null,
                    is_promotable: false,
                    stream_source_id: null,
                },
                { queue: newQueue || queue, queueMode: newQueue ? 'manual' : queueMode }
            );
            return;
        }

        await resolveAndPlayTrack(track);
    };

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

    const nextTrack = async () => {
        if (queueMode === 'radio' && sessionId) {
            try {
                const response = await axios.post('/api/playback/next', {
                    session_id: sessionId,
                    current_track: currentTrack,
                    reason: 'next',
                });
                const nextIdx = (response.data.queue || []).findIndex(
                    (item) => item.track_key === response.data.track.track_key
                );
                await loadPlayableTrack(response.data.track, response.data.playable, {
                    queue: response.data.queue || [],
                    queueIndex: nextIdx >= 0 ? nextIdx : queueIndex + 1,
                    sessionId,
                    queueMode: 'radio',
                });
                return;
            } catch (error) {
                console.error('Failed to fetch next radio track', error);
            }
        }

        if (queue.length > 0 && queueIndex < queue.length - 1) {
            const next = queue[queueIndex + 1];
            await playTrack(next, queue);
            setQueueIndex(queueIndex + 1);
        }
    };

    const prevTrack = async () => {
        if (queue.length > 0 && queueIndex > 0) {
            const previous = queue[queueIndex - 1];
            await playTrack(previous, queue);
            setQueueIndex(queueIndex - 1);
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
                        queue,
                        queueIndex,
                        sessionId,
                        queueMode,
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
    }, [currentTrack, duration, nextTrack, playbackType, queue, queueIndex, queueMode, retryCount, sessionId, sourceName]);

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
            showLyrics,
            toggleLyrics: () => setShowLyrics((prev) => !prev),
            setShowLyrics,
            sessionId,
            queueMode,
            playbackType,
            sourceName,
            streamStatus,
            retryCount,
            buffering,
            canPromote,
            isPromoted,
            sendPlaybackEvent,
        }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    return useContext(PlayerContext);
}
