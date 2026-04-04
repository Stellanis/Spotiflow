import React from 'react';
import { motion } from 'framer-motion';
import { BookmarkPlus, CheckCircle, Download, EyeOff, Heart, Library, Loader2, Music, Play, X } from 'lucide-react';

import { GlassCard } from '../GlassCard';
import { cn } from '../../utils';

export function DiscoverTrackCard({
    track,
    status = 'idle',
    onDownload,
    onPlay,
    onDismiss,
    onFeedback,
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
                    'group flex cursor-pointer flex-col gap-2 overflow-hidden p-3 transition-all hover:bg-white/10',
                    isCurrentlyPlaying && 'ring-2 ring-spotify-green'
                )}
                onClick={() => hasAudio && onPlay?.(track)}
            >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white/5 shadow-lg">
                    {track.image ? (
                        <img src={track.image} alt={track.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Music className="h-10 w-10 text-white/20" />
                        </div>
                    )}

                    <div
                        className={cn(
                            'absolute inset-0 flex items-center justify-center gap-2 bg-black/50 transition-opacity',
                            isQueued || isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                    >
                        {status === 'loading' ? (
                            <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                        ) : status === 'success' ? (
                            <CheckCircle className="h-8 w-8 text-spotify-green" />
                        ) : (
                            <>
                                {hasAudio ? (
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onPlay?.(track);
                                        }}
                                        className="rounded-full bg-spotify-green p-2.5 shadow-lg shadow-black/40"
                                        title="Play"
                                    >
                                        <Play className="h-5 w-5 fill-black text-black" />
                                    </motion.button>
                                ) : null}
                                <motion.button
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onDownload?.(track);
                                    }}
                                    className={cn(
                                        'rounded-full p-2.5 shadow-lg shadow-black/40',
                                        hasAudio ? 'bg-white/20' : 'bg-spotify-green'
                                    )}
                                    title="Download"
                                >
                                    <Download className={cn('h-5 w-5', hasAudio ? 'text-white' : 'text-black')} />
                                </motion.button>
                            </>
                        )}
                    </div>

                    {isCurrentlyPlaying ? (
                        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-lg ring-2 ring-spotify-green" />
                    ) : null}
                </div>

                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold leading-tight text-white">{track.title}</h3>
                    <p className="mt-0.5 truncate text-xs text-spotify-grey">{track.artist}</p>

                    {track.reason ? (
                        <p className="mt-1 truncate text-xs italic leading-tight text-spotify-green/70">{track.reason}</p>
                    ) : null}

                    {track.tags?.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {track.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none text-spotify-grey">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {onFeedback ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onFeedback(track, 'liked');
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/[0.1]"
                            >
                                <Heart className="h-3 w-3" />
                                Like
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onFeedback(track, 'saved_for_later');
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/[0.1]"
                            >
                                <BookmarkPlus className="h-3 w-3" />
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onFeedback(track, 'already_know');
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/[0.1]"
                            >
                                <Library className="h-3 w-3" />
                                Know It
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onFeedback(track, 'not_my_taste');
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/[0.1]"
                            >
                                <EyeOff className="h-3 w-3" />
                                Pass
                            </button>
                        </div>
                    ) : null}
                </div>
            </GlassCard>

            {onDismiss ? (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1 }}
                    className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/60 p-1 text-white/60 opacity-0 transition-all group-hover:opacity-100 hover:text-white"
                    onClick={(event) => {
                        event.stopPropagation();
                        onDismiss(track);
                    }}
                    title="Don't show this"
                >
                    <X className="h-3 w-3" />
                </motion.button>
            ) : null}
        </motion.div>
    );
}
