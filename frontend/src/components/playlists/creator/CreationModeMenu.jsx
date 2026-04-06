import { BarChart3, ListMusic, Sparkles, Tag, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { GlassCard } from '../../GlassCard';

const MODE_CARDS = [
    { mode: 'manual', title: 'Standard', description: 'Build manually from your library', icon: ListMusic, accent: 'hover:border-spotify-green/50', iconClass: 'text-white', nextName: '' },
    { mode: 'top', title: 'Top Songs', description: 'Based on listening history', icon: BarChart3, accent: 'hover:border-blue-500/50', iconClass: 'text-blue-400', nextName: 'Top Songs' },
    { mode: 'genre', title: 'Genre Mix', description: 'Generate from specific tags', icon: Tag, accent: 'hover:border-pink-500/50', iconClass: 'text-pink-400', nextName: '' },
    { mode: 'smart', title: 'Smart Rules', description: 'Dynamic rules (e.g. Artist is...)', icon: Sparkles, accent: 'hover:border-purple-500/50', iconClass: 'text-purple-400', nextName: '' },
    { mode: 'vibe', title: 'Vibe Match', description: 'Mood-based AI generation', icon: Zap, accent: 'hover:border-amber-500/50', iconClass: 'text-amber-400', nextName: '' },
];

export function CreationModeMenu({ isOpen, onClose, onSelect }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-4xl">
                        <GlassCard className="p-8">
                            <div className="mb-8 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white">Create Playlist</h2>
                                <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-white/10">
                                    <X className="h-6 w-6 text-white" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {MODE_CARDS.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <div
                                            key={card.mode}
                                            onClick={() => onSelect(card.mode, card.nextName)}
                                            className={`group flex cursor-pointer flex-col items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-6 text-center transition-colors hover:bg-white/10 ${card.accent}`}
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-transform group-hover:scale-110">
                                                <Icon className={`h-6 w-6 ${card.iconClass}`} />
                                            </div>
                                            <div>
                                                <h3 className="mb-1 text-lg font-bold">{card.title}</h3>
                                                <p className="text-sm text-spotify-grey">{card.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
