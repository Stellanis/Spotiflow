import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, User, Globe, Disc, Activity, Loader2 } from 'lucide-react';
import axios from 'axios';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';
import { ActivityChart } from './ActivityChart';

const API_URL = '/api';

export function TrackStatsModal({ isOpen, onClose, track, username }) {
    const [stats, setStats] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && track && username) {
            fetchStats();
            fetchChartData();
        } else {
            setStats(null);
            setChartData([]);
        }
    }, [isOpen, track, username]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/stats/track`, {
                params: {
                    user: username,
                    artist: track.artist,
                    track: track.title
                }
            });
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching track stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchChartData = async () => {
        try {
            const response = await axios.get(`${API_URL}/stats/chart`, {
                params: {
                    user: username,
                    period: '1month',
                    artist: track.artist,
                    track: track.title
                }
            });
            setChartData(response.data);
        } catch (error) {
            console.error("Error fetching track chart:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GlassCard className="flex flex-col overflow-hidden max-h-[90vh]">

                        {/* Header Image Background */}
                        <div className="relative h-48 bg-black/40">
                            {stats?.image || track.image ? (
                                <img
                                    src={stats?.image || track.image}
                                    alt="Background"
                                    className="w-full h-full object-cover opacity-50 mask-gradient"
                                />
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-white/20 rounded-full text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="absolute bottom-4 left-6 right-6">
                                <h2 className="text-2xl md:text-3xl font-bold truncate text-white">{track.title}</h2>
                                <p className="text-xl text-white/80 truncate">{track.artist}</p>
                                {stats?.album && <p className="text-sm text-white/60 truncate">{stats.album}</p>}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                                </div>
                            ) : stats ? (
                                <div className="space-y-6">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center text-center">
                                            <User className="w-6 h-6 text-spotify-green mb-2" />
                                            <span className="text-2xl font-bold">{stats.userplaycount}</span>
                                            <span className="text-xs text-white/50 uppercase">Your Plays</span>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center text-center">
                                            <Globe className="w-6 h-6 text-blue-400 mb-2" />
                                            <span className="text-2xl font-bold">{parseInt(stats.listeners).toLocaleString()}</span>
                                            <span className="text-xs text-white/50 uppercase">Listeners</span>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center text-center col-span-2 md:col-span-1">
                                            <Activity className="w-6 h-6 text-orange-400 mb-2" />
                                            <span className="text-2xl font-bold">{parseInt(stats.playcount).toLocaleString()}</span>
                                            <span className="text-xs text-white/50 uppercase">Total Scrobbles</span>
                                        </div>
                                    </div>

                                    {/* Activity Chart */}
                                    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                                        <h4 className="text-sm font-medium text-white/70 mb-4 uppercase tracking-wider">30 Day Trend</h4>
                                        <ActivityChart data={chartData} color="#1DB954" />
                                    </div>

                                    {/* Tags */}
                                    {stats.tags && stats.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {stats.tags.map(tag => (
                                                <span key={tag} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs transition-colors">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Summary */}
                                    {stats.wiki && (
                                        <div className="text-sm text-white/70 leading-relaxed bg-black/20 p-4 rounded-lg" dangerouslySetInnerHTML={{ __html: stats.wiki }} />
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-white/50">
                                    <p>Could not load detailed stats.</p>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
