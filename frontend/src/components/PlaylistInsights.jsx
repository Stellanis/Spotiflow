import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { motion } from 'framer-motion';
import { Loader2, Zap, Coffee, CloudRain, Moon, Sparkles, TrendingUp } from 'lucide-react';
import { GlassCard } from './GlassCard';

const COLORS = ['#1DB954', '#1ed760', '#2de26d', '#3df07d', '#50fa8f', '#65ff9f', '#7bffb0', '#92ffc1', '#a9ffd3', '#c1ffe6'];

export function PlaylistInsights({ stats, loading }) {
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
            </div>
        );
    }

    if (!stats || stats.total_songs === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
            {/* Quick Stats Row */}
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-spotify-green">{stats.total_songs}</div>
                    <div className="text-xs text-spotify-grey uppercase tracking-wider mt-1">Total Songs</div>
                </GlassCard>
                <GlassCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-white">{stats.total_artists}</div>
                    <div className="text-xs text-spotify-grey uppercase tracking-wider mt-1">Unique Artists</div>
                </GlassCard>
                <GlassCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-white">
                        {stats.diversity_score}%
                    </div>
                    <div className="text-xs text-spotify-grey uppercase tracking-wider mt-1">Diversity Score</div>
                </GlassCard>
                <GlassCard className="p-4 text-center">
                    <div className="text-xl font-bold text-white truncate px-2">
                        {stats.dominant_vibe || "Eclectic"}
                    </div>
                    <div className="text-xs text-spotify-grey uppercase tracking-wider mt-1">Dominant Vibe</div>
                </GlassCard>
            </div>

            {/* Top Artists Chart */}
            <GlassCard className="p-4 flex flex-col h-[300px]">
                <h3 className="text-lg font-bold mb-4 text-white">Top Artists</h3>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.top_artists} layout="vertical" margin={{ left: 40, right: 10 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="artist"
                                type="category"
                                width={100}
                                tick={{ fill: '#9ca3af', fontSize: 11 }}
                                interval={0}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="count" fill="#1DB954" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

            {/* Genre Distribution Chart */}
            <GlassCard className="p-4 flex flex-col h-[300px]">
                <h3 className="text-lg font-bold mb-4 text-white">Genre Distribution</h3>
                <div className="flex-1 min-h-0 relative">
                    {stats.top_genres && stats.top_genres.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.top_genres}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    isAnimationActive={true}
                                    animationDuration={800}
                                    animationBegin={0}
                                >
                                    {stats.top_genres.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                    formatter={(value, name) => [value, name]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-spotify-grey text-sm">
                            Not enough data for genres
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Nerdy Stats Section */}
            {(stats.hipster_score !== undefined || stats.mood_distribution) && (
                <div className="md:col-span-2 mt-4">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        Nerdy Stats
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Hipster Index */}
                        <GlassCard className="p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp className="w-24 h-24 text-white" />
                            </div>
                            <h4 className="text-spotify-grey uppercase tracking-wider text-xs font-bold mb-2">Hipster Index</h4>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-4xl font-bold text-white">{stats.hipster_score}%</span>
                                <span className="text-sm text-spotify-grey mb-1">obscurity score</span>
                            </div>

                            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.hipster_score}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-spotify-grey">
                                <span>Mainstream</span>
                                <span>Underground</span>
                            </div>
                            <p className="mt-4 text-sm text-gray-300">
                                {stats.hipster_score > 80 ? "You're digging really deep! Rare finds." :
                                    stats.hipster_score > 50 ? "A nice balance of hits and hidden gems." :
                                        "You love the hits! A true crowd pleaser."}
                            </p>
                        </GlassCard>

                        {/* Mood Analysis */}
                        <GlassCard className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-spotify-grey uppercase tracking-wider text-xs font-bold">Mood Analysis</h4>
                                {stats.primary_mood === 'Energy' && <Zap className="w-5 h-5 text-yellow-400" />}
                                {stats.primary_mood === 'Chill' && <Coffee className="w-5 h-5 text-green-400" />}
                                {stats.primary_mood === 'Melancholic' && <CloudRain className="w-5 h-5 text-blue-400" />}
                                {stats.primary_mood === 'Dark' && <Moon className="w-5 h-5 text-purple-400" />}
                            </div>

                            {stats.mood_distribution && stats.mood_distribution.length > 0 ? (
                                <div className="h-[150px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.mood_distribution} layout="vertical" margin={{ left: 0, right: 20 }}>
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={80}
                                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                            />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                                {stats.mood_distribution.map((entry, index) => {
                                                    let color = '#fff';
                                                    if (entry.name === 'Energy') color = '#fbbf24';
                                                    if (entry.name === 'Chill') color = '#4ade80';
                                                    if (entry.name === 'Melancholic') color = '#60a5fa';
                                                    if (entry.name === 'Dark') color = '#a78bfa';
                                                    return <Cell key={`cell-${index}`} fill={color} />;
                                                })}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="text-sm text-spotify-grey text-center py-8">
                                    Not enough data for mood analysis
                                </div>
                            )}
                        </GlassCard>
                    </div>
                </div>
            )}

            {/* Timeline Chart */}
            <GlassCard className="md:col-span-2 p-4 flex flex-col h-[300px]">
                <h3 className="text-lg font-bold mb-4 text-white">Collection Timeline</h3>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={Object.entries(stats.timeline).map(([date, count]) => ({ date, count }))}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#1DB954" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#1DB954" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickFormatter={(str) => str}
                            />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="count" stroke="#1DB954" fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>
        </div>
    );
}
