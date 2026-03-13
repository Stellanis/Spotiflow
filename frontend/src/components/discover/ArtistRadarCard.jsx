import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, ChevronUp, Download, Music } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { cn } from '../../utils';

/**
 * ArtistRadarCard
 * Expandable card showing a similar artist. Click to reveal top tracks.
 * Props:
 *   artist       – { name, image, tags, listeners, because, top_tracks: [{title, listeners}] }
 *   onDownload   – (artist, title) => void
 */
export function ArtistRadarCard({ artist, onDownload }) {
    const [expanded, setExpanded] = useState(false);

    const formatListeners = (n) => {
        if (!n) return '—';
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
        return n.toString();
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
        >
            <GlassCard
                image={artist.image}
                className="overflow-hidden"
            >
                {/* Artist Header – always visible */}
                <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpanded((e) => !e)}
                >
                    {/* Artist image */}
                    <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-white/10 shadow-lg">
                        {artist.image ? (
                            <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-6 h-6 text-white/30" />
                            </div>
                        )}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{artist.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-spotify-grey mt-0.5">
                            <Users className="w-3 h-3" />
                            <span>{formatListeners(artist.listeners)} listeners</span>
                        </div>
                        {artist.because && (
                            <p className="text-xs text-spotify-green/70 italic mt-0.5 truncate">
                                Similar to {artist.because}
                            </p>
                        )}
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {(artist.tags || []).slice(0, 3).map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded-full text-spotify-grey"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Expand chevron */}
                    <div className="text-spotify-grey flex-shrink-0">
                        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>

                {/* Expanded top tracks */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            key="tracks"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <div className="border-t border-white/10 px-4 py-2 space-y-1">
                                {artist.top_tracks && artist.top_tracks.length > 0 ? (
                                    artist.top_tracks.map((track, i) => (
                                        <div
                                            key={track.title}
                                            className="flex items-center gap-3 py-1.5 group/track hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                                        >
                                            <span className="text-spotify-grey text-xs w-5 text-right flex-shrink-0">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-white truncate block">{track.title}</span>
                                                {track.listeners > 0 && (
                                                    <span className="text-[10px] text-spotify-grey">
                                                        {formatListeners(track.listeners)} listeners
                                                    </span>
                                                )}
                                            </div>
                                            <motion.button
                                                whileHover={{ scale: 1.15 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => onDownload?.(artist.name, track.title)}
                                                className="p-1.5 bg-spotify-green rounded-full opacity-0 group-hover/track:opacity-100 transition-opacity"
                                                title="Download"
                                            >
                                                <Download className="w-3.5 h-3.5 text-black" />
                                            </motion.button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-spotify-grey text-sm py-2 text-center">
                                        No top tracks available
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </GlassCard>
        </motion.div>
    );
}
