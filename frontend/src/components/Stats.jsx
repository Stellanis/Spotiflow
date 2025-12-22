import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Music, Trophy, Calendar, RefreshCw } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { SkeletonCard } from './SkeletonCard';
import { cn } from '../utils';
import { ActivityChart } from './ActivityChart';
import { ListeningClock } from './ListeningClock';
import { GenreBreakdown } from './GenreBreakdown';
import { TimeMachine } from './TimeMachine';
import { StreakCard } from './StreakCard';
import { DiversityScore } from './DiversityScore';
import { MainstreamScore } from './MainstreamScore';
import { ShareButton } from './ShareButton';

const API_URL = '/api';

export default function Stats({ username, onTrackClick }) {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('overall'); // overall, 7day, 1month, 3month, 6month, 12month
    const [chartData, setChartData] = useState([]);
    const [clockData, setClockData] = useState([]);
    const [genreData, setGenreData] = useState([]);
    const [onThisDay, setOnThisDay] = useState([]);
    const [streak, setStreak] = useState(null);
    const [diversity, setDiversity] = useState(null);
    const [mainstream, setMainstream] = useState(null);
    const [topArtists, setTopArtists] = useState([]);

    const statsRef = useRef(null);


    const periods = [
        { value: 'overall', label: 'All Time' },
        { value: '7day', label: 'Last 7 Days' },
        { value: '1month', label: 'Last Month' },
        { value: '3month', label: 'Last 3 Months' },
        { value: '6month', label: 'Last 6 Months' },
        { value: '12month', label: 'Last Year' },
    ];

    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (username) {
            // Trigger background sync on mount to ensure we have latest data
            syncStats();

            fetchTopTracks();
            fetchChartData();
        }
    }, [username, period]);

    const syncStats = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await axios.post(`${API_URL}/stats/sync/${username}`);
            // After sync starts, we might want to poll or just wait a bit and re-fetch chart?
            // Since it's background, immediate re-fetch might not show everything. 
            // Let's rely on the user or a delayed re-fetch.
            setTimeout(() => {
                fetchChartData(); // Refresh charts after a partial sync might have happened
            }, 2000);
        } catch (error) {
            console.error("Sync error:", error);
        } finally {
            setSyncing(false);
        }
    };

    const fetchTopTracks = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/stats/top-tracks/${username}`, {
                params: { period, limit: 50 },
            });
            setTracks(response.data);
        } catch (error) {
            console.error('Error fetching top tracks:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchChartData = async () => {
        try {
            // Fetch Activity Chart (1month default)
            const chartRes = await axios.get(`${API_URL}/stats/chart`, {
                params: { user: username, period: '1month' }
            });
            setChartData(chartRes.data);

            // Fetch Listening Clock (matches Top Tracks period)
            const clockRes = await axios.get(`${API_URL}/stats/listening-clock/${username}`, {
                params: { period }
            });
            setClockData(clockRes.data);

            // Fetch Genre Breakdown (matches Top Tracks period)
            const genreRes = await axios.get(`${API_URL}/stats/genre-breakdown/${username}`, {
                params: { period }
            });
            setGenreData(genreRes.data);

            // Fetch History features (independent of period selector, but we fetch on mount/user change)
            if (period === 'overall' || period === '1month') { // Only fetch once or when main view is active
                const otdRes = await axios.get(`${API_URL}/stats/on-this-day/${username}`);
                setOnThisDay(otdRes.data);

                const streakRes = await axios.get(`${API_URL}/stats/streak/${username}`);
                setStreak(streakRes.data.current_streak);

                const diversityRes = await axios.get(`${API_URL}/stats/diversity/${username}`, { params: { period } });
                setDiversity(diversityRes.data);

                const mainstreamRes = await axios.get(`${API_URL}/stats/mainstream/${username}`, { params: { period } });
                setMainstream(mainstreamRes.data);

                const artistsRes = await axios.get(`${API_URL}/stats/top-artists/${username}`, { params: { period: 'overall', limit: 3 } });
                setTopArtists(artistsRes.data);
            }

        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    return (
        <div ref={statsRef} className="space-y-6 group/stats group-[.capturing]/stats:pb-6 group-[.capturing]/stats:w-[800px] group-[.capturing]/stats:mx-auto">
            {/* Capture Header */}
            <div className="hidden group-[.capturing]/stats:block text-center mb-6">
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter">My Spotify Stats</h1>
                <p className="text-spotify-grey text-sm uppercase tracking-widest mb-6">Generated by Spotiflow</p>

                {/* Capture-only Summary */}
                <div className="grid grid-cols-2 gap-8 mb-8 text-left max-w-2xl mx-auto">
                    <div>
                        <h3 className="text-spotify-green font-bold uppercase tracking-wider mb-2 text-sm">Top Artists</h3>
                        {topArtists.map((artist, i) => (
                            <div key={artist.name} className="flex items-center gap-2 mb-1">
                                <span className="text-spotify-grey font-mono text-xs">0{i + 1}</span>
                                <span className="font-semibold truncate">{artist.name}</span>
                            </div>
                        ))}
                    </div>
                    <div>
                        <h3 className="text-spotify-green font-bold uppercase tracking-wider mb-2 text-sm">Top Tracks</h3>
                        {tracks.slice(0, 3).map((track, i) => (
                            <div key={track.title} className="flex items-center gap-2 mb-1">
                                <span className="text-spotify-grey font-mono text-xs">0{i + 1}</span>
                                <div className="truncate">
                                    <span className="font-semibold">{track.title}</span>
                                    <span className="text-xs text-spotify-grey block">{track.artist}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 no-capture group-[.capturing]/stats:hidden">
                <button
                    onClick={syncStats}
                    disabled={syncing}
                    className="p-2 rounded-full hover:bg-white/10 text-spotify-grey hover:text-white transition-colors disabled:opacity-50"
                    title="Sync with Last.fm"
                >
                    <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                </button>
            </div>


            {/* Activity Chart */}
            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-spotify-grey uppercase tracking-wide">Last 30 Days Activity</h3>
                <ActivityChart data={chartData} />
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ListeningClock data={clockData} />
                <GenreBreakdown data={genreData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <TimeMachine data={onThisDay} />
                </div>
                <div>
                    <StreakCard streak={streak} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DiversityScore data={diversity} />
                <MainstreamScore data={mainstream} />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 no-capture group-[.capturing]/stats:hidden">

                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top Tracks
                </h2>

                <div className="flex bg-white/10 p-1 rounded-full border border-white/5 overflow-x-auto max-w-full">
                    {periods.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={cn(
                                "relative px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap z-10",
                                period === p.value
                                    ? "text-white"
                                    : "text-gray-400 hover:text-white"
                            )}
                        >
                            {period === p.value && (
                                <motion.div
                                    layoutId="stats-period-active"
                                    className="absolute inset-0 bg-spotify-green rounded-full -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10">{p.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid gap-3 no-capture group-[.capturing]/stats:hidden">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <SkeletonCard key={i} type="horizontal" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-3 no-capture group-[.capturing]/stats:hidden">
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            className="grid gap-3"
                            variants={{
                                hidden: { opacity: 0 },
                                show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                            }}
                            initial="hidden"
                            animate="show"
                        >
                            {tracks.map((track, index) => (
                                <motion.div
                                    key={`${track.title}-${track.artist}-${period}`}
                                    variants={{
                                        hidden: { opacity: 0, x: -10 },
                                        show: { opacity: 1, x: 0 }
                                    }}
                                    whileHover={{ x: 4 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                    <GlassCard
                                        image={track.image}
                                        onClick={() => onTrackClick(track)}
                                        className="p-3 flex items-center gap-4 group hover:bg-white/5 cursor-pointer"
                                    >

                                        <div className="flex-shrink-0 w-8 text-center font-bold text-spotify-grey group-hover:text-spotify-green transition-colors">
                                            #{track.rank}
                                        </div>

                                        <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-md overflow-hidden bg-black/20 relative">
                                            {track.image ? (
                                                <img src={track.image} alt={track.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Music className="w-6 h-6 text-spotify-grey" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <h3 className="font-semibold text-base sm:text-lg truncate">{track.title}</h3>
                                            <p className="text-spotify-grey text-sm truncate">{track.artist}</p>
                                        </div>

                                        <div className="flex-shrink-0 text-right">
                                            <div className="font-bold text-spotify-green text-lg sm:text-xl">
                                                {track.playcount}
                                            </div>
                                            <div className="text-xs text-spotify-grey uppercase tracking-wide">
                                                Plays
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {tracks.length === 0 && !loading && (
                        <div className="text-center py-20 text-spotify-grey">
                            <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>No plays found for this period.</p>
                        </div>
                    )}
                </div>
            )}

            <div className="no-capture group-[.capturing]/stats:hidden">
                <ShareButton targetRef={statsRef} />
            </div>
        </div >
    );
}
