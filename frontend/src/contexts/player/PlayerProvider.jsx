import { useRef, useState } from 'react';

import { PlayerContext } from './context';
import { useAudioController } from './useAudioController';
import { usePlaybackSession } from './usePlaybackSession';
import { usePlayerWebSocket } from './usePlayerWebSocket';
import { useQueueState } from './useQueueState';

export function PlayerProvider({ children }) {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [showQueuePanel, setShowQueuePanel] = useState(false);
    const [playbackType, setPlaybackType] = useState(null);
    const [sourceName, setSourceName] = useState(null);
    const [streamStatus, setStreamStatus] = useState('idle');
    const [retryCount, setRetryCount] = useState(0);
    const [buffering, setBuffering] = useState(false);
    const [canPromote, setCanPromote] = useState(false);
    const [isPromoted, setIsPromoted] = useState(false);

    const audioRef = useRef(new Audio());
    const queueState = useQueueState();
    const playbackState = {
        currentTrack,
        setCurrentTrack,
        isPlaying,
        setIsPlaying,
        volume,
        setVolume,
        progress,
        setProgress,
        duration,
        setDuration,
        isReady,
        setIsReady,
        showLyrics,
        setShowLyrics,
        showQueuePanel,
        setShowQueuePanel,
        playbackType,
        setPlaybackType,
        sourceName,
        setSourceName,
        streamStatus,
        setStreamStatus,
        retryCount,
        setRetryCount,
        buffering,
        setBuffering,
        canPromote,
        setCanPromote,
        isPromoted,
        setIsPromoted,
    };

    const sessionActions = usePlaybackSession({ audioRef, duration, queueState, playbackState });

    usePlayerWebSocket({
        sessionIdRef: queueState.sessionIdRef,
        setActiveDownloads: queueState.setActiveDownloads,
        syncSessionState: queueState.syncSessionState,
        setStreamStatus,
        setIsPromoted,
    });

    const audioController = useAudioController({
        audioRef,
        queueState,
        playbackState,
        sessionActions,
    });

    return (
        <PlayerContext.Provider
            value={{
                currentTrack,
                isPlaying,
                volume,
                progress,
                duration,
                isReady,
                playTrack: sessionActions.playTrack,
                resolveAndPlayTrack: sessionActions.resolveAndPlayTrack,
                togglePlay: audioController.togglePlay,
                seek: audioController.seek,
                updateVolume: audioController.updateVolume,
                activeDownloads: queueState.activeDownloads,
                nextTrack: sessionActions.nextTrack,
                prevTrack: audioController.prevTrack,
                queue: queueState.queue,
                queueIndex: queueState.queueIndex,
                queueSummary: queueState.queueSummary,
                showLyrics,
                toggleLyrics: () => setShowLyrics((prev) => !prev),
                setShowLyrics,
                showQueuePanel,
                setShowQueuePanel,
                sessionId: queueState.sessionId,
                queueMode: queueState.queueMode,
                sessionStatus: queueState.sessionStatus,
                playbackType,
                sourceName,
                streamStatus,
                retryCount,
                buffering,
                canPromote,
                isPromoted,
                hasSuspendedRadio: queueState.hasSuspendedRadio,
                addToQueueNext: sessionActions.addToQueueNext,
                addToQueueEnd: sessionActions.addToQueueEnd,
                removeFromQueue: sessionActions.removeFromQueue,
                reorderQueue: sessionActions.reorderQueue,
                clearUpcoming: sessionActions.clearUpcoming,
                playQueueNow: sessionActions.playQueueNow,
                refreshActiveSession: sessionActions.refreshActiveSession,
                restartRadio: sessionActions.restartRadio,
                sendPlaybackEvent: sessionActions.sendPlaybackEvent,
            }}
        >
            {children}
        </PlayerContext.Provider>
    );
}
