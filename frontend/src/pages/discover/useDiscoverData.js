import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export function useDiscoverData({ username, currentTrack, resolveAndPlayTrack, sendPlaybackEvent }) {
    const [activeTab, setActiveTab] = useState('foryou');
    const [recommendations, setRecommendations] = useState([]);
    const [recLoading, setRecLoading] = useState(true);
    const [recError, setRecError] = useState(false);
    const [downloading, setDownloading] = useState({});
    const [dismissed, setDismissed] = useState(new Set());
    const [radar, setRadar] = useState([]);
    const [radarLoading, setRadarLoading] = useState(false);
    const [stations, setStations] = useState([]);
    const [moodsLoading, setMoodsLoading] = useState(false);
    const [selectedMood, setSelectedMood] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const radarFetchedRef = useRef(false);
    const moodsFetchedRef = useRef(false);
    const historyFetchedRef = useRef(false);
    const inProgressRef = useRef({});

    const fetchRecommendations = useCallback(async () => {
        if (!username) {
            setRecLoading(false);
            return;
        }
        setRecLoading(true);
        setRecError(false);
        try {
            const response = await axios.get('/api/recommendations', { params: { limit: 24 } });
            const items = response.data.items || [];
            setRecommendations(items);

            if (items.length > 0) {
                try {
                    const prefetch = await axios.post(
                        '/api/recommendations/prefetch-playable',
                        items.slice(0, 10).map((item) => ({
                            artist: item.artist,
                            title: item.title,
                            album: item.album || null,
                            preview_url: item.preview_url || null,
                        }))
                    );
                    const warmedByKey = new Map((prefetch.data.items || []).map((item) => [item.track_key, item]));
                    setRecommendations((current) => current.map((item) => ({ ...item, ...(warmedByKey.get(item.track_key) || {}) })));
                } catch {
                    // Prefetch is best-effort only.
                }
            }
        } catch {
            setRecError(true);
            toast.error('Failed to load recommendations.');
        } finally {
            setRecLoading(false);
        }
    }, [username]);

    const fetchRadar = useCallback(async () => {
        if (!username || radarFetchedRef.current) return;
        radarFetchedRef.current = true;
        setRadarLoading(true);
        try {
            const response = await axios.get('/api/recommendations/radar');
            setRadar(response.data.items || []);
        } catch {
            radarFetchedRef.current = false;
            toast.error('Failed to load Artist Radar.');
        } finally {
            setRadarLoading(false);
        }
    }, [username]);

    const fetchMoods = useCallback(async () => {
        if (!username || moodsFetchedRef.current) return;
        moodsFetchedRef.current = true;
        setMoodsLoading(true);
        try {
            const response = await axios.get('/api/recommendations/moods');
            const items = response.data.stations || [];
            setStations(items);
            if (items.length > 0) setSelectedMood(items[0].mood);
        } catch {
            moodsFetchedRef.current = false;
            toast.error('Failed to load Mood Stations.');
        } finally {
            setMoodsLoading(false);
        }
    }, [username]);

    const fetchHistory = useCallback(async () => {
        if (!username || historyFetchedRef.current) return;
        historyFetchedRef.current = true;
        setHistoryLoading(true);
        try {
            const response = await axios.get('/api/recommendations/history');
            setHistory(response.data.years || []);
        } catch {
            historyFetchedRef.current = false;
            toast.error('Failed to load history.');
        } finally {
            setHistoryLoading(false);
        }
    }, [username]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    useEffect(() => {
        if (activeTab === 'radar') fetchRadar();
        if (activeTab === 'moods') fetchMoods();
        if (activeTab === 'history') fetchHistory();
    }, [activeTab, fetchHistory, fetchMoods, fetchRadar]);

    const handleDownload = useCallback(async (track) => {
        const query = `${track.artist} - ${track.title}`;
        if (inProgressRef.current[query]) return;
        inProgressRef.current[query] = true;
        setDownloading((prev) => ({ ...prev, [query]: 'loading' }));
        try {
            await axios.post('/api/download', {
                query,
                artist: track.artist,
                title: track.title,
                album: track.album || '',
                image: track.image || '',
            });
            setDownloading((prev) => ({ ...prev, [query]: 'success' }));
            toast.success(`Downloading "${track.title}"`);
        } catch {
            setDownloading((prev) => ({ ...prev, [query]: 'error' }));
            toast.error(`Failed to download "${track.title}"`);
        } finally {
            inProgressRef.current[query] = false;
        }
    }, []);

    const handleDownloadByParts = useCallback((artist, title) => {
        handleDownload({ artist, title });
    }, [handleDownload]);

    const handleDismiss = useCallback(async (track) => {
        const key = `${track.artist.toLowerCase()}|${track.title.toLowerCase()}`;
        setDismissed((prev) => new Set([...prev, key]));
        try {
            await axios.post('/api/recommendations/dismiss', {
                artist: track.artist,
                title: track.title,
            });
        } catch {
            // Local dismissal is enough.
        }
    }, []);

    const handleFeedback = useCallback(async (track, feedbackType) => {
        if (feedbackType === 'not_my_taste' || feedbackType === 'already_know') {
            const key = `${track.artist.toLowerCase()}|${track.title.toLowerCase()}`;
            setDismissed((prev) => new Set([...prev, key]));
        }
        try {
            await axios.post('/api/recommendations/feedback', {
                artist: track.artist,
                title: track.title,
                feedback_type: feedbackType,
            });
            if (feedbackType === 'liked') toast.success(`Saved ${track.title} as a strong recommendation.`);
            if (feedbackType === 'saved_for_later') toast.success(`Saved ${track.title} for later.`);
            if (currentTrack?.artist === track.artist && currentTrack?.title === track.title) {
                if (feedbackType === 'liked') {
                    await sendPlaybackEvent('like', currentTrack);
                }
                if (feedbackType === 'saved_for_later') {
                    await sendPlaybackEvent('save', currentTrack);
                }
            }
        } catch {
            toast.error('Failed to save recommendation feedback.');
        }
    }, [currentTrack, sendPlaybackEvent]);

    const handlePlay = useCallback(async (track) => {
        if (!track.audio_url && !track.is_streamable) return;
        try {
            await resolveAndPlayTrack(track);
        } catch {
            toast.error(`Could not start "${track.title}"`);
        }
    }, [resolveAndPlayTrack]);

    const visibleRecs = useMemo(
        () => recommendations.filter((track) => !dismissed.has(`${track.artist.toLowerCase()}|${track.title.toLowerCase()}`)),
        [recommendations, dismissed]
    );

    const currentMoodTracks = useMemo(
        () => stations.find((station) => station.mood === selectedMood)?.tracks ?? [],
        [stations, selectedMood]
    );

    return {
        activeTab,
        setActiveTab,
        recLoading,
        recError,
        downloading,
        radar,
        radarLoading,
        stations,
        moodsLoading,
        selectedMood,
        setSelectedMood,
        history,
        historyLoading,
        visibleRecs,
        currentMoodTracks,
        fetchRecommendations,
        handleDownload,
        handleDownloadByParts,
        handleDismiss,
        handleFeedback,
        handlePlay,
    };
}
