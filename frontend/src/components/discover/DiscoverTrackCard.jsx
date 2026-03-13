import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Play, X, Loader2, CheckCircle, Music } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { cn } from '../../utils';

/**
 * DiscoverTrackCard
 * A reusable card for all Discover tabs.
 * Props:
 *   track      – { artist, title, image, reason?, tags?, audio_url? }
 *   status     – 'idle' | 'loading' | 'success' | 'error'
 *   onDownload – (track) => void
 *   onPlay     – (track) => void   (only shown if track.audio_url is present)
 *   onDismiss  – (track) => void   (optional, shows ✕ button)
 *   isCurrentlyPlaying – bool
 */
export function DiscoverTrackCard({
    track,
    status = 'idle',
    onDownload,
    onPlay,
    onDismiss,
    isCurrentlyPlaying = false,
}) {
    const isQueued = status === 'loading' || status === 'success';
    const hasAudio = Boolean(track.audio_url);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.02 }}
            className="relative"
        >
            <GlassCard
                image={track.image}
                className={cn(
                    'p-3 flex flex-col gap-2 group cursor-pointer hover:bg-white/10 transition-all overflow-hidden',
                    isCurrentlyPlaying && 'ring-2 ring-spotify-green'
                )}
                onClick={() => hasAudio && onPlay?.(track)}
            >
                {/* Album Art */}
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/5 relative shadow-lg">
                    {track.image ? (
                        <img
                            src={track.image}
                            alt={track.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-10 h-10 text-white/20" />
                        </div>
                    )}

                    {/* Hover overlay – play / download / spinner */}
                    <div
                        className={cn(
                            'absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity',
                            isQueued || isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                    >
                        {status === 'loading' ? (
                            <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
                        ) : status === 'success' ? (
                            <CheckCircle className="w-8 h-8 text-spotify-green" />
                        ) : (
                            <>
                                {hasAudio && (
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={(e) => { e.stopPropagation(); onPlay?.(track); }}
                                        className="p-2.5 bg-spotify-green rounded-full shadow-lg shadow-black/40"
                                        title="Play"
                                    >
                                        <Play className="w-5 h-5 text-black fill-black" />
                                    </motion.button>
                                )}
                                <motion.button
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => { e.stopPropagation(); onDownload?.(track); }}
                                    className={cn(
                                        'p-2.5 rounded-full shadow-lg shadow-black/40',
                                        hasAudio ? 'bg-white/20' : 'bg-spotify-green'
                                    )}
                                    title="Download"
                                >
                                    <Download className={cn('w-5 h-5', hasAudio ? 'text-white' : 'text-black')} />
                                </motion.button>
                            </>
                        )}
                    </div>

                    {/* Currently playing pulse ring */}
                    {isCurrentlyPlaying && (
                        <div className="absolute inset-0 rounded-lg ring-2 ring-spotify-green animate-pulse pointer-events-none" />
                    )}
                </div>

                {/* Text info */}
                <div className="w-full min-w-0">
                    <h3 className="font-semibold truncate text-sm text-white leading-tight">{track.title}</h3>
                    <p className="text-spotify-grey truncate text-xs mt-0.5">{track.artist}</p>

                    {/* Reason badge */}
                    {track.reason && (
                        <p className="text-xs text-spotify-green/70 italic truncate mt-1 leading-tight">
                            {track.reason}
                        </p>
                    )}

                    {/* Genre tags */}
                    {track.tags && track.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {track.tags.slice(0, 2).map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded-full text-spotify-grey leading-none"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Dismiss button */}
            {onDismiss && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1 }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 bg-black/60 rounded-full text-white/60 hover:text-white transition-all z-10"
                    onClick={(e) => { e.stopPropagation(); onDismiss(track); }}
                    title="Don't show this"
                >
                    <X className="w-3 h-3" />
                </motion.button>
            )}
        </motion.div>
    );
}
