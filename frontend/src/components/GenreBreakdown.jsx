import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Disc } from 'lucide-react';
import { GlassCard } from './GlassCard';

export function GenreBreakdown({ data }) {
    if (!data || data.length === 0) return null;

    return (
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-spotify-grey uppercase tracking-wide flex items-center gap-2">
                <Disc className="w-5 h-5 text-spotify-green" />
                Genre Breakdown
            </h3>
            <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={data}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fill: '#bbb', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#1DB954' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index < 3 ? '#1DB954' : '#1DB95480'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <p className="text-xs text-spotify-grey mt-2 text-center">
                Based on your Top Artists
            </p>
        </GlassCard>
    );
}
