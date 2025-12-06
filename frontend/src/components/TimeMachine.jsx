import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';

export function TimeMachine({ data }) {
    if (!data || data.length === 0) return null;

    const scrollRef = useRef(null);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = 300;
            if (direction === 'left') {
                current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

    return (
        <GlassCard className="p-0 overflow-hidden">
            <div className="p-6 pb-2 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-spotify-grey uppercase tracking-wide flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-400" />
                    On This Day
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => scroll('left')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={() => scroll('right')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex overflow-x-auto gap-4 p-6 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            >
                {data.map((entry) => (
                    <div
                        key={entry.year}
                        className="flex-shrink-0 w-[280px] bg-black/20 rounded-xl p-4 snap-center border border-white/5"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl font-bold text-white">{entry.year}</span>
                            <span className="text-xs font-medium px-2 py-1 bg-white/10 rounded-md text-spotify-grey">
                                {entry.track_count} scrobbles
                            </span>
                        </div>

                        <div className="space-y-3">
                            {entry.top_tracks.length > 0 ? (
                                entry.top_tracks.map((track, i) => (
                                    <div key={i} className="flex items-center gap-3 group">
                                        <div className="w-10 h-10 rounded bg-white/5 overflow-hidden flex-shrink-0">
                                            {track.image && <img src={track.image} alt={track.title} className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="min-w-0 overflow-hidden">
                                            <div className="text-sm font-medium text-white truncate group-hover:text-spotify-green transition-colors">{track.title}</div>
                                            <div className="text-xs text-spotify-grey truncate">{track.artist}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-sm text-spotify-grey italic">
                                    No tracks recorded.
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
