import { useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export function useAudioController({
    audioRef,
    queueState,
    playbackState,
    sessionActions,
}) {
    const {
        queue,
        queueIndex,
        queueSummary,
        sessionId,
        queueMode,
        sessionStatus,
        hasSuspendedRadio,
    } = queueState;
    const {
        currentTrack,
        isPlaying,
        setIsPlaying,
        volume,
        setVolume,
        setProgress,
        duration,
        setDuration,
        setIsReady,
        retryCount,
        setRetryCount,
        setStreamStatus,
        buffering,
        setBuffering,
    } = playbackState;
    const { sendPlaybackEvent, nextTrack, playQueueNow, loadPlayableTrack } = sessionActions;

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
    }, [
        audioRef,
        currentTrack,
        duration,
        retryCount,
        sessionId,
        queue,
        queueIndex,
        queueMode,
        sessionStatus,
        queueSummary,
        hasSuspendedRadio,
        loadPlayableTrack,
        nextTrack,
        sendPlaybackEvent,
        setBuffering,
        setDuration,
        setIsPlaying,
        setIsReady,
        setProgress,
        setRetryCount,
        setStreamStatus,
    ]);

    async function togglePlay() {
        if (!currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
            await sendPlaybackEvent('pause');
        } else {
            await audioRef.current.play();
            setIsPlaying(true);
        }
    }

    function seek(time) {
        audioRef.current.currentTime = time;
        setProgress(time);
    }

    function updateVolume(val) {
        setVolume(val);
        audioRef.current.volume = val;
    }

    async function prevTrack() {
        if (audioRef.current.currentTime > 5) {
            audioRef.current.currentTime = 0;
            setProgress(0);
            return;
        }
        if (queueIndex > 0) {
            await playQueueNow(queue, queueIndex - 1);
        }
    }

    return {
        togglePlay,
        seek,
        updateVolume,
        prevTrack,
        volume,
        buffering,
    };
}
