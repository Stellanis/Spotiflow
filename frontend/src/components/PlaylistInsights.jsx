import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';

export function PlaylistInsights({ stats }) {
    if (!stats || stats.total_songs === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
            {/* Top Artists Chart */}
            <GlassCard className="p-4 flex flex-col h-[300px]">
                <h3 className="text-lg font-bold mb-4 text-white">Top Artists</h3>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.top_artists} layout="vertical" margin={{ left: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="artist"
                                type="category"
                                width={100}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                interval={0}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="count" fill="#1DB954" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

            {/* Timeline Chart */}
            <GlassCard className="p-4 flex flex-col h-[300px]">
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
                                tickFormatter={(str) => str.split('-')[1]} // Show month only
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
                        {stats.total_songs > 0 ? Math.round((stats.total_artists / stats.total_songs) * 100) : 0}%
                    </div>
                    <div className="text-xs text-spotify-grey uppercase tracking-wider mt-1">Diversity Score</div>
                </GlassCard>
                <GlassCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-white">
                        {Object.keys(stats.timeline).length}
                    </div>
                    <div className="text-xs text-spotify-grey uppercase tracking-wider mt-1">Active Months</div>
                </GlassCard>
            </div>
        </div>
    );
}
