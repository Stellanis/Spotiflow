import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Compass, RefreshCw, Sparkles, Radio, Smile, History, Loader2, AlertCircle,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast'
import { usePlayer } from '../contexts/PlayerContext';
import { SkeletonCard } from '../components/SkeletonCard';
import { DiscoverTrackCard } from '../components/discover/DiscoverTrackCard';
import { ArtistRadarCard } from '../components/discover/ArtistRadarCard';
import { MoodPill } from '../components/discover/MoodPill';
import { HistoryWeekCard } from '../components/discover/HistoryWeekCard';
import { cn } from '../utils';

// ─────────────────────────────────────────────
// Tab config (module-level constant, never recreated)
// ─────────────────────────────────────────────
const TABS = [
    { id: 'foryou',  label: 'For You',             Icon: Sparkles },
    { id: 'radar',   label: 'Artist Radar',         Icon: Radio    },
    { id: 'moods',   label: 'Mood Stations',        Icon: Smile    },
    { id: 'history', label: 'This Week in History', Icon: History  },
];

// ─────────────────────────────────────────────
// SkeletonGrid – defined OUTSIDE the page component so React never
// sees a "new" component type between renders (prevents remount churn)
// ─────────────────────────────────────────────
function SkeletonGrid({ count = 12 }) {
    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} type="vertical" />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────
// TrackGrid – also defined OUTSIDE. Props must carry all dependencies.
// ─────────────────────────────────────────────
function TrackGrid({ tracks, downloading, currentTrack, onDownload, onPlay, onDismiss }) {
    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            <AnimatePresence mode="popLayout">
                {tracks.map((track, i) => {
                    const query = `${track.artist} - ${track.title}`;
                    return (
                        <DiscoverTrackCard
                            key={`${track.artist}-${track.title}-${i}`}
                            track={track}
                            status={downloading[query] || 'idle'}
                            onDownload={onDownload}
                            onPlay={track.audio_url ? onPlay : undefined}
                            onDismiss={onDismiss}
                            isCurrentlyPlaying={
                                currentTrack?.title === track.title &&
                                currentTrack?.artist === track.artist
                            }
                        />
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

// ─────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────
function EmptyState({ icon: Icon, message }) {
    const ResolvedIcon = typeof Icon === 'function' ? Icon : null;

    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            {ResolvedIcon ? <ResolvedIcon className="w-14 h-14 text-white/10 mb-4" /> : null}
            <p className="text-spotify-grey text-sm max-w-xs">{message}</p>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function DiscoverPage() {
    const { username } = useOutletContext();
    const { playTrack, currentTrack } = usePlayer();

    const [activeTab, setActiveTab] = useState('foryou');

    // ── For You ──────────────────────────────
    const [recommendations, setRecommendations] = useState([]);
    const [recLoading, setRecLoading] = useState(true);
    const [recError, setRecError] = useState(false);
    const [downloading, setDownloading] = useState({});
    const [dismissed, setDismissed] = useState(new Set());

    // ── Artist Radar ──────────────────────────
    const [radar, setRadar] = useState([]);
    const [radarLoading, setRadarLoading] = useState(false);
    const [radarFetched, setRadarFetched] = useState(false);

    // ── Mood Stations ─────────────────────────
    const [stations, setStations] = useState([]);
    const [moodsLoading, setMoodsLoading] = useState(false);
    const [moodsFetched, setMoodsFetched] = useState(false);
    const [selectedMood, setSelectedMood] = useState(null);

    // ── History ───────────────────────────────
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyFetched, setHistoryFetched] = useState(false);

    // ─────────────────────────────────────────
    // Data fetchers
    // ─────────────────────────────────────────
    const fetchRecommendations = useCallback(async () => {
        if (!username) { setRecLoading(false); return; }
        setRecLoading(true);
        setRecError(false);
        try {
            const res = await axios.get('/api/recommendations', { params: { limit: 24 } });
            setRecommendations(res.data.items || []);
        } catch {
            setRecError(true);
            toast.error('Failed to load recommendations.');
        } finally {
            setRecLoading(false);
        }
    }, [username]); // only re-create when username changes

    // Use refs to avoid stale closures for "already fetched" guards
    const radarFetchedRef = useRef(false);
    const moodsFetchedRef = useRef(false);
    const historyFetchedRef = useRef(false);

    const fetchRadar = useCallback(async () => {
        if (!username || radarFetchedRef.current) return;
        radarFetchedRef.current = true;
        setRadarLoading(true);
        try {
            const res = await axios.get('/api/recommendations/radar');
            setRadar(res.data.items || []);
            setRadarFetched(true);
        } catch {
            radarFetchedRef.current = false; // allow retry
            toast.error('Failed to load Artist Radar.');
        } finally {
            setRadarLoading(false);
        }
    }, [username]); // stable – no fetched-state dep

    const fetchMoods = useCallback(async () => {
        if (!username || moodsFetchedRef.current) return;
        moodsFetchedRef.current = true;
        setMoodsLoading(true);
        try {
            const res = await axios.get('/api/recommendations/moods');
            const s = res.data.stations || [];
            setStations(s);
            if (s.length > 0) setSelectedMood(s[0].mood);
            setMoodsFetched(true);
        } catch {
            moodsFetchedRef.current = false; // allow retry
            toast.error('Failed to load Mood Stations.');
        } finally {
            setMoodsLoading(false);
        }
    }, [username]); // stable

    const fetchHistory = useCallback(async () => {
        if (!username || historyFetchedRef.current) return;
        historyFetchedRef.current = true;
        setHistoryLoading(true);
        try {
            const res = await axios.get('/api/recommendations/history');
            setHistory(res.data.years || []);
            setHistoryFetched(true);
        } catch {
            historyFetchedRef.current = false;
            toast.error('Failed to load history.');
        } finally {
            setHistoryLoading(false);
        }
    }, [username]); // stable

    useEffect(() => { fetchRecommendations(); }, [fetchRecommendations]);

    useEffect(() => {
        if (activeTab === 'radar')   fetchRadar();
        if (activeTab === 'moods')   fetchMoods();
        if (activeTab === 'history') fetchHistory();
    }, [activeTab, fetchRadar, fetchMoods, fetchHistory]);

    // ─────────────────────────────────────────
    // Actions
    // Use a ref to guard double-clicks without adding `downloading`
    // to the useCallback dep array (which would cause thundering re-renders)
    // ─────────────────────────────────────────
    const inProgressRef = useRef({});

    const handleDownload = useCallback(async (track) => {
        const query = `${track.artist} - ${track.title}`;
        if (inProgressRef.current[query]) return;
        inProgressRef.current[query] = true;
        setDownloading(prev => ({ ...prev, [query]: 'loading' }));
        try {
            await axios.post('/api/download', {
                query,
                artist: track.artist,
                title: track.title,
                album: track.album || '',
                image: track.image || '',
            });
            setDownloading(prev => ({ ...prev, [query]: 'success' }));
            toast.success(`Downloading "${track.title}"`);
        } catch {
            setDownloading(prev => ({ ...prev, [query]: 'error' }));
            toast.error(`Failed to download "${track.title}"`);
        } finally {
            inProgressRef.current[query] = false;
        }
    }, []); // no deps – uses ref + functional state updates

    const handleDownloadByParts = useCallback((artist, title) => {
        handleDownload({ artist, title });
    }, [handleDownload]);

    const handleDismiss = useCallback(async (track) => {
        const key = `${track.artist.toLowerCase()}|${track.title.toLowerCase()}`;
        setDismissed(prev => new Set([...prev, key]));
        try {
            await axios.post('/api/recommendations/dismiss', {
                artist: track.artist,
                title: track.title,
            });
        } catch {
            // Non-critical – already dismissed locally
        }
    }, []);

    const handlePlay = useCallback((track) => {
        if (track.audio_url) playTrack(track);
    }, [playTrack]);

    // ─────────────────────────────────────────
    // Derived data (memoized)
    // ─────────────────────────────────────────
    const visibleRecs = useMemo(
        () => recommendations.filter(t => !dismissed.has(
            `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`
        )),
        [recommendations, dismissed]
    );

    const currentMoodTracks = useMemo(
        () => stations.find(s => s.mood === selectedMood)?.tracks ?? [],
        [stations, selectedMood]
    );

    // ─────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Compass className="w-5 h-5 text-spotify-green" />
                    Discover
                </h2>

                {activeTab === 'foryou' && (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={fetchRecommendations}
                        disabled={recLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 transition-colors shadow-lg disabled:opacity-50"
                    >
                        <RefreshCw className={cn('w-4 h-4', recLoading && 'animate-spin')} />
                        Refresh
                    </motion.button>
                )}
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-2xl w-fit max-w-full overflow-x-auto no-scrollbar">
                {TABS.map(({ id, label, Icon }) => (
                    <motion.button
                        key={id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                            activeTab === id
                                ? 'bg-spotify-green text-black shadow-lg shadow-spotify-green/20'
                                : 'text-spotify-grey hover:text-white hover:bg-white/10'
                        )}
                    >
                        {typeof Icon === 'function' ? <Icon className="w-3.5 h-3.5" /> : null}
                        {label}
                    </motion.button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                >

                    {/* ── FOR YOU ─────────────────────────── */}
                    {activeTab === 'foryou' && (
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
                            />
                        )
                    )}

                    {/* ── ARTIST RADAR ─────────────────────── */}
                    {activeTab === 'radar' && (
                        radarLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                            </div>
                        ) : radar.length === 0 ? (
                            <EmptyState icon={Radio} message="No artist radar data yet. Check back after building more listening history." />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <AnimatePresence>
                                    {radar.map((artist) => (
                                        <ArtistRadarCard
                                            key={artist.name}
                                            artist={artist}
                                            onDownload={handleDownloadByParts}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        )
                    )}

                    {/* ── MOOD STATIONS ─────────────────────── */}
                    {activeTab === 'moods' && (
                        moodsLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                            </div>
                        ) : stations.length === 0 ? (
                            <EmptyState icon={Smile} message="Mood stations will appear here once we know your genre preferences." />
                        ) : (
                            <div className="space-y-6">
                                {/* Mood pills */}
                                <div className="flex flex-wrap gap-2">
                                    {stations.map((s) => (
                                        <MoodPill
                                            key={s.mood}
                                            mood={s.mood}
                                            count={s.tracks.length}
                                            selected={selectedMood === s.mood}
                                            onClick={() => setSelectedMood(s.mood)}
                                        />
                                    ))}
                                </div>

                                {/* Track grid for selected mood */}
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
                                            />
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        )
                    )}

                    {/* ── HISTORY ───────────────────────────── */}
                    {activeTab === 'history' && (
                        historyLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                            </div>
                        ) : history.length === 0 ? (
                            <EmptyState icon={History} message="No historical data found. Start scrobbling to see this!" />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {history.map((entry, i) => (
                                    <HistoryWeekCard key={entry.year} entry={entry} index={i} />
                                ))}
                            </div>
                        )
                    )}

                </motion.div>
            </AnimatePresence>
        </div>
    );
}
