import { createContext, useContext, useState, useRef, useEffect } from 'react';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1); // 0.0 to 1.0
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(-1);
    const [activeDownloads, setActiveDownloads] = useState([]);
    const [showLyrics, setShowLyrics] = useState(false);

    const audioRef = useRef(new Audio());
    const wsRef = useRef(null);

    // WebSocket connection for real-time status
    useEffect(() => {
        const connect = () => {
            // Determine protocol (ws or wss) based on current protocol
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Use window.location.host since we have a proxy, but wait, proxy handles HTTP.
            // For websockets, we typically need to hit the backend directly or via proxy if proxy supports upgrade.
            // Vite proxy supports WS upgrade. So connecting to same host at /ws should work if proxy is configured.
            // Let's assume proxy rewrites /api/ws. Wait, my proxy config is: '/api': { target: '...', rewrite: ... }
            // If I connect to `ws://localhost:5173/api/ws`, it should get proxied to `ws://localhost:8000/ws`.

            // Debugging: Bypass proxy and connect directly to backend
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws`;
            console.log("Connecting to WS:", wsUrl);
            // Note: If /api is stripped by Vite proxy as per config, we need backend route to be /ws.
            // My backend router is @router.websocket("/ws").
            // So if I call /api/ws, it becomes /ws on backend. Correct.

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WS Connected");
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.active_downloads) {
                        setActiveDownloads(data.active_downloads);
                    }
                } catch (e) {
                    console.error("WS Parse error", e);
                }
            };

            ws.onclose = (e) => {
                console.log("WS Disconnected, reconnecting...", e.reason);
                setTimeout(connect, 3000); // Retry logic
            };

            ws.onerror = (err) => {
                console.error("WS Error:", err);
                ws.close();
            };
        };

        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    const playTrack = (track, newQueue = null) => {
        const audio = audioRef.current;

        if (newQueue) {
            setQueue(newQueue);
            const index = newQueue.findIndex(t => t.id === track.id || t.title === track.title);
            setQueueIndex(index !== -1 ? index : 0);
        }

        // Use the backend-provided URL if available, fallback to constructed one
        // The backend should now be returning 'audio_url' for downloaded tracks
        let url = track.audio_url;

        if (!url) {
            console.warn("No audio_url found for track:", track);
            // Fallback: This likely won't work due to the folder structure issue we just fixed, 
            // but keeps the old logic as a last resort.
            const filename = encodeURIComponent(`${track.artist} - ${track.title}.mp3`);
            url = `/api/audio/${filename}`;
        }

        // Check if we are already playing this track (by URL match)
        // audio.src is the full absolute URL, so we check if it ends with our relative URL or just check title
        const isSameTrack = currentTrack?.title === track.title;

        if (isSameTrack && !audio.paused) {
            return; // Already playing
        }

        if (!isSameTrack) {
            console.log("Loading URL:", url);
            audio.src = url;
            audio.load();
            setCurrentTrack(track);
            setIsReady(false);
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch(e => {
                    console.error("Playback failed:", e);
                    setIsPlaying(false);
                    // If 404, it might be the fallback failing or the URL being wrong
                });
        }
    };

    const nextTrack = () => {
        if (queue.length > 0 && queueIndex < queue.length - 1) {
            playTrack(queue[queueIndex + 1]);
            setQueueIndex(queueIndex + 1);
        }
    };

    const prevTrack = () => {
        if (queue.length > 0 && queueIndex > 0) {
            playTrack(queue[queueIndex - 1]);
            setQueueIndex(queueIndex - 1);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;

        const handleTimeUpdate = () => setProgress(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            nextTrack(); // Auto-play next
        };
        const handleCanPlay = () => setIsReady(true);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('canplay', handleCanPlay);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('canplay', handleCanPlay);
        };
    }, [queue, queueIndex]);

    const togglePlay = () => {
        if (!currentTrack) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
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
            togglePlay,
            seek,
            updateVolume,
            activeDownloads,
            nextTrack,
            prevTrack,
            queue,
            showLyrics,
            toggleLyrics: () => setShowLyrics(prev => !prev),
            setShowLyrics
        }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    return useContext(PlayerContext);
}
