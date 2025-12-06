import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Music, Trophy, Calendar } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';
import { ActivityChart } from './ActivityChart';

const API_URL = '/api';

export default function Stats({ username, onTrackClick }) {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('overall'); // overall, 7day, 1month, 3month, 6month, 12month
    const [chartData, setChartData] = useState([]);

    const periods = [
        { value: 'overall', label: 'All Time' },
        { value: '7day', label: 'Last 7 Days' },
        { value: '1month', label: 'Last Month' },
        { value: '3month', label: 'Last 3 Months' },
        { value: '6month', label: 'Last 6 Months' },
        { value: '12month', label: 'Last Year' },
    ];

    useEffect(() => {
        if (username) {
            fetchTopTracks();
            fetchChartData();
        }
    }, [username, period]);

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
            // Only fetch chart for 1month for now as it's the intended view
            const response = await axios.get(`${API_URL}/stats/chart`, {
                params: { user: username, period: '1month' }
            });
            setChartData(response.data);
        } catch (error) {
            console.error('Error fetching chart:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Activity Chart */}
            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-spotify-grey uppercase tracking-wide">Last 30 Days Activity</h3>
                <ActivityChart data={chartData} />
            </GlassCard>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top Tracks
                </h2>

                <div className="flex bg-black/10 dark:bg-white/10 p-1 rounded-full border border-black/5 dark:border-white/5 overflow-x-auto max-w-full">
                    {periods.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                                period === p.value
                                    ? "bg-spotify-green text-white"
                                    : "text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
                </div>
            ) : (
                <div className="grid gap-3">
                    <AnimatePresence mode="popLayout">
                        {tracks.map((track, index) => (
                            <GlassCard
                                key={`${track.title}-${track.artist}-${period}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.03 }}
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
                        ))}
                    </AnimatePresence>

                    {tracks.length === 0 && !loading && (
                        <div className="text-center py-20 text-spotify-grey">
                            <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>No plays found for this period.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
