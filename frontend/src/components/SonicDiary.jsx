import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronRight, Music } from 'lucide-react';
import axios from 'axios';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';

const API_URL = '/api';

export function SonicDiary({ username }) {
    const [diary, setDiary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const fetchDiary = async () => {
            if (!username) return;
            try {
                // Check local storage for dismissal
                const dismissed = localStorage.getItem(`sonic_diary_dismissed_${username}`);
                const now = new Date();
                const currentWeek = `${now.getFullYear()}-${Math.floor(now.getDate() / 7)}`;

                if (dismissed === currentWeek) {
                    setLoading(false);
                    setIsVisible(false);
                    return;
                }

                const response = await axios.get(`${API_URL}/stats/sonic-diary/${username}`);
                setDiary(response.data);
            } catch (error) {
                console.error("Failed to fetch diary", error);
                setIsVisible(false);
            } finally {
                setLoading(false);
            }
        };

        fetchDiary();
    }, [username]);

    const handleDismiss = () => {
        setIsVisible(false);
        const now = new Date();
        const currentWeek = `${now.getFullYear()}-${Math.floor(now.getDate() / 7)}`;
        localStorage.setItem(`sonic_diary_dismissed_${username}`, currentWeek);
    };

    if (!isVisible || loading || !diary) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8"
            >
                <GlassCard className="relative overflow-hidden bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/20">
                    <div className="absolute top-0 right-0 p-2 z-20">
                        <button
                            onClick={handleDismiss}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
                        <div className="shrink-0 relative">
                            <div className="absolute -inset-4 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white/10 shadow-xl">
                                {diary.stats.top_artist.image ? (
                                    <img src={diary.stats.top_artist.image[2]['#text']} alt={diary.stats.top_artist.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-spotify-dark flex items-center justify-center">
                                        <Music className="w-8 h-8 text-white/50" />
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-full border border-white/20 shadow-lg">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left z-10">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                                {diary.title}
                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] uppercase tracking-wider font-medium">Weekly AI Recap</span>
                            </h3>
                            <p className="text-gray-200 text-lg leading-relaxed font-light">
                                "{diary.content}"
                            </p>
                        </div>
                    </div>
                </GlassCard>
            </motion.div>
        </AnimatePresence>
    );
}
