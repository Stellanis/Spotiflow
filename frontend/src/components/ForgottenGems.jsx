import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Sparkles, Music, Play, Plus } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';

const API_URL = '/api';

export function ForgottenGems({ username, onTrackClick }) {
    const [gems, setGems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (username) {
            fetchGems();
        }
    }, [username]);

    const fetchGems = async () => {
        try {
            const response = await axios.get(`${API_URL}/stats/forgotten-gems/${username}`);
            setGems(response.data);
        } catch (error) {
            console.error('Error fetching forgotten gems:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!loading && gems.length === 0) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-spotify-grey uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    Forgotten Gems
                </h3>
                <GlassCard className="py-12 flex flex-col items-center justify-center text-center">
                    <Music className="w-12 h-12 text-spotify-grey/30 mb-4" />
                    <p className="text-spotify-grey max-w-xs mx-auto">
                        No forgotten gems found yet. Try listening to more tracks and we'll resurface your old favorites here!
                    </p>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-spotify-grey uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Forgotten Gems
            </h3>
            <div className="overflow-x-auto pb-4 no-scrollbar">
                <div className="flex gap-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="min-w-[280px] h-32 bg-white/5 rounded-xl animate-pulse" />
                        ))
                    ) : (
                        gems.map((gem, index) => (
                            <motion.div
                                key={`${gem.artist}-${gem.title}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="min-w-[300px]"
                            >
                                <GlassCard
                                    image={gem.image}
                                    className="p-4 flex gap-4 items-center group cursor-pointer hover:bg-white/10 transition-colors"
                                    onClick={() => onTrackClick(gem)}
                                >
                                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 relative">
                                        {gem.image ? (
                                            <img src={gem.image} alt={gem.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                                <Music className="w-8 h-8 text-spotify-grey" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Play className="w-8 h-8 text-white fill-white" />
                                        </div>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h4 className="font-bold text-white truncate text-base">{gem.title}</h4>
                                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 mt-0.5 mb-2">
                                            {gem.artist.split(/[\/,]/).map((a, i, arr) => {
                                                const name = a.trim();
                                                return (
                                                    <span key={name} className="flex items-center gap-1 group/artist">
                                                        <span
                                                            className="text-spotify-grey text-sm hover:text-white hover:underline transition-all cursor-pointer truncate max-w-[120px]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.dispatchEvent(new CustomEvent('open-artist-deep-dive', { detail: name }));
                                                            }}
                                                        >
                                                            {name}
                                                        </span>
                                                        {i < arr.length - 1 && <span className="text-spotify-grey/40 text-xs">/</span>}
                                                    </span>
                                                );
                                            })}
                                            <Sparkles className="w-2.5 h-2.5 text-spotify-green opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-spotify-grey">
                                                {gem.playcount} Total Plays
                                            </span>
                                            {gem.downloaded && (
                                                <button
                                                    className="p-2 bg-spotify-green rounded-full shadow-lg shadow-spotify-green/20 hover:scale-110 transition-transform"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTrackClick(gem);
                                                    }}
                                                >
                                                    <Play className="w-3 h-3 text-black fill-black" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
