import { useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import {
    addQueueItemsRequest,
    clearUpcomingRequest,
    getActiveSession,
    getSessionById,
    nextTrackRequest,
    playNowRequest,
    removeQueueItemRequest,
    reorderQueueRequest,
    resolvePlayable,
    restartRadioRequest,
    sendPlaybackEventRequest,
    startPlaybackRequest,
} from './playerApi';
import { PLAYER_SESSION_STORAGE_KEY } from './context';
import { buildRequestTrack, mergeTrackWithPlayable, normalizeTrack, tracksMatch } from './trackUtils';

export function usePlaybackSession({
    audioRef,
    duration,
    queueState,
    playbackState,
}) {
    const {
        queue,
        setQueue,
        queueIndex,
        setQueueIndex,
        sessionId,
        setSessionId,
        queueMode,
        setQueueMode,
        syncSessionState,
        resetSessionState,
        sessionIdRef,
        hasRestoredSessionRef,
    } = queueState;
    const {
        currentTrack,
        setCurrentTrack,
        setIsPlaying,
        playbackType,
        setPlaybackType,
        sourceName,
        setSourceName,
        setStreamStatus,
        setRetryCount,
        setIsReady,
        setProgress,
        canPromote,
        setCanPromote,
        isPromoted,
        setIsPromoted,
    } = playbackState;

    const sendPlaybackEvent = useCallback(async (eventType, trackOverride = null, extras = {}) => {
        const track = trackOverride || currentTrack;
        if (!track) return null;
        try {
            const response = await sendPlaybackEventRequest({
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
    }, [audioRef, currentTrack, duration, playbackType, sessionId, setIsPromoted, sourceName]);

    const loadPlayableTrack = useCallback(async (track, playable, options = {}) => {
        const audio = audioRef.current;
        const resolvedTrack = mergeTrackWithPlayable(track, playable);
        if (options.sessionPayload) {
            syncSessionState(options.sessionPayload);
        } else {
            const nextQueue = options.queue || queue;
            const nextIndex =
                typeof options.queueIndex === 'number'
                    ? options.queueIndex
                    : nextQueue.findIndex((item) => tracksMatch(item, resolvedTrack));
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
    }, [
        audioRef,
        queue,
        sendPlaybackEvent,
        sessionIdRef,
        setCanPromote,
        setCurrentTrack,
        setIsPlaying,
        setIsPromoted,
        setIsReady,
        setPlaybackType,
        setProgress,
        setQueue,
        setQueueIndex,
        setQueueMode,
        setRetryCount,
        setSessionId,
        setSourceName,
        setStreamStatus,
        syncSessionState,
    ]);

    const loadSessionResponse = useCallback(async (payload, options = {}) => {
        syncSessionState(payload);
        const track = normalizeTrack(payload.track || payload.current_track);
        if (!track) {
            setCurrentTrack(null);
            setPlaybackType(null);
            setSourceName(null);
            return null;
        }
        const playable = payload.playable || await resolvePlayable(track);
        return loadPlayableTrack(track, playable, {
            autoplay: options.autoplay,
            sendStartEvent: options.sendStartEvent,
            sessionPayload: payload,
            streamHealth: payload.stream_health || null,
        });
    }, [loadPlayableTrack, setCurrentTrack, setPlaybackType, setSourceName, syncSessionState]);

    const refreshActiveSession = useCallback(async (preferredSessionId = null, options = {}) => {
        try {
            let response;
            try {
                response = await getActiveSession();
            } catch (error) {
                if (!preferredSessionId) throw error;
                response = await getSessionById(preferredSessionId);
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
                resetSessionState();
            } else {
                console.error('Failed to refresh active session', error);
            }
            return null;
        }
    }, [loadSessionResponse, resetSessionState, setStreamStatus]);

    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId, sessionIdRef]);

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
    }, [sessionId, queueMode, queueIndex, queue, currentTrack, playbackType, sourceName, canPromote, isPromoted, hasRestoredSessionRef]);

    useEffect(() => {
        if (hasRestoredSessionRef.current || typeof window === 'undefined') return;
        hasRestoredSessionRef.current = true;

        const restoreSession = async () => {
            const raw = window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
            if (!raw) return;

            try {
                const saved = JSON.parse(raw);
                if (!saved?.sessionId || saved.queueMode !== 'radio') return;
                const response = await getSessionById(saved.sessionId);
                await loadSessionResponse(response.data, {
                    autoplay: false,
                    sendStartEvent: false,
                });
                setStreamStatus('restored');
            } catch (error) {
                console.error('Failed to restore player session', error);
                sessionIdRef.current = null;
                window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
            }
        };

        restoreSession();
    }, [hasRestoredSessionRef, loadSessionResponse, sessionIdRef, setStreamStatus]);

    const startManualQueue = useCallback(async (items, startIndex = 0) => {
        const response = await startPlaybackRequest({
            ...buildRequestTrack(items[startIndex]),
            mode: 'manual',
            queue_items: items.map(buildRequestTrack),
            start_index: startIndex,
            replace_active_session: true,
        });
        await loadSessionResponse(response.data);
        return response.data;
    }, [loadSessionResponse]);

    const startRadioQueue = useCallback(async (track) => {
        const response = await startPlaybackRequest({
            ...buildRequestTrack(track),
            mode: 'radio',
        });
        await loadSessionResponse(response.data);
        return response.data;
    }, [loadSessionResponse]);

    const resolveAndPlayTrack = useCallback(async (track) => startRadioQueue(track), [startRadioQueue]);

    const playTrack = useCallback(async (track, newQueue = null) => {
        const normalizedTrack = normalizeTrack(track);
        if (newQueue?.length) {
            const items = newQueue.map(normalizeTrack);
            const startIndex = Math.max(0, items.findIndex((item) => tracksMatch(item, normalizedTrack)));
            await startManualQueue(items, startIndex);
            return;
        }

        if (normalizedTrack.reason || normalizedTrack.recommended_because || normalizedTrack.seed_type === 'recommendation') {
            await startRadioQueue(normalizedTrack);
            return;
        }

        await startManualQueue([normalizedTrack], 0);
    }, [startManualQueue, startRadioQueue]);

    const playQueueNow = useCallback(async (items, startIndex = 0) => {
        const response = await playNowRequest({
            items: items.map(buildRequestTrack),
            start_index: startIndex,
            session_id: sessionId,
        });
        await loadSessionResponse(response.data);
        return response.data;
    }, [loadSessionResponse, sessionId]);

    const addToQueueNext = useCallback(async (track) => {
        const response = await addQueueItemsRequest({
            session_id: sessionId,
            placement: 'next',
            items: [buildRequestTrack(track)],
        });
        syncSessionState(response.data);
        return response.data;
    }, [sessionId, syncSessionState]);

    const addToQueueEnd = useCallback(async (track) => {
        const response = await addQueueItemsRequest({
            session_id: sessionId,
            placement: 'end',
            items: [buildRequestTrack(track)],
        });
        syncSessionState(response.data);
        return response.data;
    }, [sessionId, syncSessionState]);

    const removeFromQueue = useCallback(async (trackKey) => {
        const response = await removeQueueItemRequest({
            session_id: sessionId,
            track_key: trackKey,
        });
        syncSessionState(response.data);
        return response.data;
    }, [sessionId, syncSessionState]);

    const reorderQueue = useCallback(async (orderedTrackKeys) => {
        const response = await reorderQueueRequest({
            session_id: sessionId,
            ordered_track_keys: orderedTrackKeys,
        });
        syncSessionState(response.data);
        return response.data;
    }, [sessionId, syncSessionState]);

    const clearUpcoming = useCallback(async () => {
        const response = await clearUpcomingRequest({
            session_id: sessionId,
        });
        syncSessionState(response.data);
        return response.data;
    }, [sessionId, syncSessionState]);

    const restartRadio = useCallback(async (track = currentTrack) => {
        if (!track) return null;
        const response = await restartRadioRequest(buildRequestTrack(track));
        await loadSessionResponse(response.data);
        return response.data;
    }, [currentTrack, loadSessionResponse]);

    const nextTrack = useCallback(async () => {
        if (!sessionId) return;
        try {
            const response = await nextTrackRequest({
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
    }, [currentTrack, loadSessionResponse, sessionId, setIsPlaying, setStreamStatus]);

    return {
        loadPlayableTrack,
        loadSessionResponse,
        refreshActiveSession,
        sendPlaybackEvent,
        startManualQueue,
        startRadioQueue,
        resolveAndPlayTrack,
        playTrack,
        playQueueNow,
        addToQueueNext,
        addToQueueEnd,
        removeFromQueue,
        reorderQueue,
        clearUpcoming,
        restartRadio,
        nextTrack,
    };
}
