import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, RefreshCw, Sparkles, Radio, Smile, History, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

import { usePlayer } from '../contexts/PlayerContext';
import { SkeletonCard } from '../components/SkeletonCard';
import { DiscoverTrackCard } from '../components/discover/DiscoverTrackCard';
import { ArtistRadarCard } from '../components/discover/ArtistRadarCard';
import { MoodPill } from '../components/discover/MoodPill';
import { HistoryWeekCard } from '../components/discover/HistoryWeekCard';
import { cn } from '../utils';

const TABS = [
    { id: 'foryou', label: 'For You', Icon: Sparkles },
    { id: 'radar', label: 'Artist Radar', Icon: Radio },
    { id: 'moods', label: 'Mood Stations', Icon: Smile },
    { id: 'history', label: 'This Week in History', Icon: History },
];

function SkeletonGrid({ count = 12 }) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} type="vertical" />
            ))}
        </div>
    );
}

function TrackGrid({ tracks, downloading, currentTrack, onDownload, onPlay, onDismiss, onFeedback }) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {tracks.map((track, index) => {
                const query = `${track.artist} - ${track.title}`;
                return (
                    <DiscoverTrackCard
                        key={`${track.artist}-${track.title}-${index}`}
                        track={track}
                        status={downloading[query] || 'idle'}
                        onDownload={onDownload}
                        onPlay={track.audio_url ? onPlay : undefined}
                        onDismiss={onDismiss}
                        onFeedback={onFeedback}
                        isCurrentlyPlaying={currentTrack?.title === track.title && currentTrack?.artist === track.artist}
                    />
                );
            })}
        </div>
    );
}

function EmptyState({ icon: Icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            {Icon ? <Icon className="mb-4 h-14 w-14 text-white/10" /> : null}
            <p className="max-w-xs text-sm text-spotify-grey">{message}</p>
        </div>
    );
}

export default function DiscoverPage() {
    const { username } = useOutletContext();
    const { playTrack, currentTrack } = usePlayer();

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
            setRecommendations(response.data.items || []);
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
            const stationsData = response.data.stations || [];
            setStations(stationsData);
            if (stationsData.length > 0) {
                setSelectedMood(stationsData[0].mood);
            }
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
        setDownloading((previous) => ({ ...previous, [query]: 'loading' }));
        try {
            await axios.post('/api/download', {
                query,
                artist: track.artist,
                title: track.title,
                album: track.album || '',
                image: track.image || '',
            });
            setDownloading((previous) => ({ ...previous, [query]: 'success' }));
            toast.success(`Downloading "${track.title}"`);
        } catch {
            setDownloading((previous) => ({ ...previous, [query]: 'error' }));
            toast.error(`Failed to download "${track.title}"`);
        } finally {
            inProgressRef.current[query] = false;
        }
    }, []);

    const handleDownloadByParts = useCallback((artist, title) => {
        handleDownload({ artist, title });
    }, [handleDownload]);

    const hideTrack = useCallback((track) => {
        const key = `${track.artist.toLowerCase()}|${track.title.toLowerCase()}`;
        setDismissed((previous) => new Set([...previous, key]));
    }, []);

    const handleDismiss = useCallback(async (track) => {
        hideTrack(track);
        try {
            await axios.post('/api/recommendations/dismiss', {
                artist: track.artist,
                title: track.title,
            });
        } catch {
            // Local hide already happened.
        }
    }, [hideTrack]);

    const handleFeedback = useCallback(async (track, feedbackType) => {
        if (feedbackType === 'not_my_taste' || feedbackType === 'already_know') {
            hideTrack(track);
        }
        try {
            await axios.post('/api/recommendations/feedback', {
                artist: track.artist,
                title: track.title,
                feedback_type: feedbackType,
            });
            if (feedbackType === 'liked') toast.success(`Saved ${track.title} as a strong recommendation`);
            if (feedbackType === 'saved_for_later') toast.success(`Saved ${track.title} for later`);
        } catch {
            toast.error('Failed to save recommendation feedback.');
        }
    }, [hideTrack]);

    const handlePlay = useCallback((track) => {
        if (track.audio_url) {
            playTrack(track);
        }
    }, [playTrack]);

    const visibleRecs = useMemo(
        () => recommendations.filter((track) => !dismissed.has(`${track.artist.toLowerCase()}|${track.title.toLowerCase()}`)),
        [recommendations, dismissed]
    );

    const currentMoodTracks = useMemo(
        () => stations.find((station) => station.mood === selectedMood)?.tracks ?? [],
        [stations, selectedMood]
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Compass className="h-5 w-5 text-spotify-green" />
                    Discover
                </h2>

                {activeTab === 'foryou' ? (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={fetchRecommendations}
                        disabled={recLoading}
                        className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                        <RefreshCw className={cn('h-4 w-4', recLoading && 'animate-spin')} />
                        Refresh
                    </motion.button>
                ) : null}
            </div>

            <div className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1">
                {TABS.map(({ id, label, Icon }) => (
                    <motion.button
                        key={id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all',
                            activeTab === id
                                ? 'bg-spotify-green text-black shadow-lg shadow-spotify-green/20'
                                : 'text-spotify-grey hover:bg-white/10 hover:text-white'
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </motion.button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'foryou' ? (
                        recLoading ? (
                            <SkeletonGrid count={12} />
                        ) : recError ? (
                            <EmptyState icon={AlertCircle} message="Could not load recommendations. Check your Last.fm settings." />
                        ) : visibleRecs.length === 0 ? (
                            <EmptyState icon={Compass} message="No recommendations yet. Listen to more tracks to build your profile." />
                        ) : (
                            <TrackGrid
                                tracks={visibleRecs}
                                downloading={downloading}
                                currentTrack={currentTrack}
                                onDownload={handleDownload}
                                onPlay={handlePlay}
                                onDismiss={handleDismiss}
                                onFeedback={handleFeedback}
                            />
                        )
                    ) : null}

                    {activeTab === 'radar' ? (
                        radarLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                            </div>
                        ) : radar.length === 0 ? (
                            <EmptyState icon={Radio} message="No artist radar data yet. Check back after building more listening history." />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {radar.map((artist) => (
                                    <ArtistRadarCard key={artist.name} artist={artist} onDownload={handleDownloadByParts} />
                                ))}
                            </div>
                        )
                    ) : null}

                    {activeTab === 'moods' ? (
                        moodsLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                            </div>
                        ) : stations.length === 0 ? (
                            <EmptyState icon={Smile} message="Mood stations will appear here once we know your genre preferences." />
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-wrap gap-2">
                                    {stations.map((station) => (
                                        <MoodPill
                                            key={station.mood}
                                            mood={station.mood}
                                            count={station.tracks.length}
                                            selected={selectedMood === station.mood}
                                            onClick={() => setSelectedMood(station.mood)}
                                        />
                                    ))}
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={selectedMood}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {currentMoodTracks.length === 0 ? (
                                            <EmptyState icon={Smile} message="No tracks found for this mood." />
                                        ) : (
                                            <TrackGrid
                                                tracks={currentMoodTracks}
                                                downloading={downloading}
                                                currentTrack={currentTrack}
                                                onDownload={handleDownload}
                                                onPlay={handlePlay}
                                                onFeedback={handleFeedback}
                                            />
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        )
                    ) : null}

                    {activeTab === 'history' ? (
                        historyLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                            </div>
                        ) : history.length === 0 ? (
                            <EmptyState icon={History} message="No historical data found. Start scrobbling to see this!" />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {history.map((entry, index) => (
                                    <HistoryWeekCard key={entry.year} entry={entry} index={index} />
                                ))}
                            </div>
                        )
                    ) : null}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
