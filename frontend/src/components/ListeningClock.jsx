import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Clock } from 'lucide-react';
import { GlassCard } from './GlassCard';

export function ListeningClock({ data }) {
    if (!data || data.length === 0) return null;

    // Sort by hour to be safe, though backend should sort
    const sortedData = [...data].sort((a, b) => a.hour - b.hour);

    // Format hour labels
    const formatHour = (hour) => {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
    };

    return (
        <GlassCard className="p-6 flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold mb-4 text-spotify-grey uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-5 h-5 text-spotify-green" />
                Listening Clock
            </h3>
            <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={sortedData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis
                            dataKey="hour"
                            tickFormatter={formatHour}
                            tick={{ fill: '#888', fontSize: 10 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Radar
                            name="Scrobbles"
                            dataKey="count"
                            stroke="#1DB954"
                            strokeWidth={2}
                            fill="#1DB954"
                            fillOpacity={0.3}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#1DB954' }}
                            formatter={(value) => [value, "Scrobbles"]}
                            labelFormatter={(label) => formatHour(label)}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <p className="text-xs text-spotify-grey mt-2 text-center">
                Activity by time of day (24h)
            </p>
        </GlassCard>
    );
}
