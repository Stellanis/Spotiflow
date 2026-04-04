import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Music } from 'lucide-react';
import { GlassCard } from '../GlassCard';

/**
 * HistoryWeekCard
 * Shows listening activity for a given historical week.
 * Props:
 *   entry – { year, week_start, week_end, scrobble_count, top_tracks }
 */
export function HistoryWeekCard({ entry, index }) {
    const { year, week_start, week_end, scrobble_count, top_tracks = [] } = entry;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const yearsAgo = new Date().getFullYear() - year;
    const agoLabel = yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
        >
            <GlassCard className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <div className="text-3xl font-black text-white">{year}</div>
                        <div className="text-xs text-spotify-grey mt-0.5">
                            {formatDate(week_start)} – {formatDate(week_end)}
                        </div>
                        <div className="text-xs text-spotify-green mt-0.5 italic">{agoLabel}</div>
                    </div>

                    {scrobble_count > 0 && (
                        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                            <Headphones className="w-3.5 h-3.5 text-spotify-green" />
                            <span className="text-sm font-semibold text-white">{scrobble_count}</span>
                            <span className="text-xs text-spotify-grey">scrobbles</span>
                        </div>
                    )}
                </div>

                {/* Top tracks row */}
                {top_tracks.length > 0 ? (
                    <div>
                        <p className="text-xs text-spotify-grey uppercase tracking-wider mb-3 font-medium">
                            Top Tracks This Week
                        </p>
                        <div className="space-y-2">
                            {top_tracks.map((track, i) => (
                                <div key={`${track.artist}-${track.title}`} className="flex items-center gap-3">
                                    {/* Rank */}
                                    <span className="text-xs text-spotify-grey w-4 text-right flex-shrink-0">
                                        {i + 1}
                                    </span>

                                    {/* Thumbnail */}
                                    <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0 bg-white/10">
                                        {track.image ? (
                                            <img
                                                src={track.image}
                                                alt={track.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Music className="w-4 h-4 text-white/20" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white truncate font-medium">{track.title}</div>
                                        <div className="text-xs text-spotify-grey truncate">{track.artist}</div>
                                    </div>

                                    {track.plays > 1 && (
                                        <span className="text-xs text-spotify-grey flex-shrink-0">
                                            ×{track.plays}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-6 text-spotify-grey">
                        <Music className="w-5 h-5 mr-2 opacity-40" />
                        <span className="text-sm">No data for this week</span>
                    </div>
                )}
            </GlassCard>
        </motion.div>
    );
}
