import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ListMusic, Sparkles, Tag, X, Zap } from 'lucide-react';

import { GlassCard } from '../../GlassCard';
import { CreationModeMenu } from './CreationModeMenu';
import { GenrePlaylistForm } from './GenrePlaylistForm';
import { ManualPlaylistForm } from './ManualPlaylistForm';
import { SmartPlaylistForm } from './SmartPlaylistForm';
import { TopSongsForm } from './TopSongsForm';
import { VibePresetGrid } from './VibePresetGrid';
import { usePlaylistCreation } from './usePlaylistCreation';

const MODE_META = {
    manual: { icon: ListMusic, title: 'Standard Playlist' },
    smart: { icon: Sparkles, title: 'Smart Playlist', className: 'text-purple-400' },
    top: { icon: BarChart3, title: 'Top Songs Generator', className: 'text-blue-400' },
    genre: { icon: Tag, title: 'Genre Mix Generator', className: 'text-pink-400' },
    vibe: { icon: Zap, title: 'Vibe Generator', className: 'text-amber-400' },
};

export function PlaylistCreatorModal(props) {
    const creator = usePlaylistCreation(props);
    const Icon = MODE_META[creator.mode]?.icon || ListMusic;

    return (
        <>
            <CreationModeMenu
                isOpen={props.isOpen && creator.mode === 'menu'}
                onClose={props.onClose}
                onSelect={(mode, nextName) => {
                    creator.setMode(mode);
                    if (nextName !== undefined) {
                        creator.setName(nextName);
                    }
                }}
            />

            <AnimatePresence>
                {props.isOpen && creator.mode !== 'menu' && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl">
                            <GlassCard className="p-6">
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => creator.setMode('menu')} className="rounded-full p-1 transition-colors hover:bg-white/10">
                                            <Icon className={`h-5 w-5 text-spotify-grey ${MODE_META[creator.mode]?.className || ''}`} />
                                        </button>
                                        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                                            <Icon className={`h-5 w-5 ${MODE_META[creator.mode]?.className || ''}`} />
                                            {MODE_META[creator.mode]?.title}
                                        </h2>
                                    </div>
                                    <button onClick={props.onClose} className="rounded-full p-1 transition-colors hover:bg-white/10">
                                        <X className="h-6 w-6 text-white" />
                                    </button>
                                </div>

                                {creator.mode === 'vibe' ? (
                                    <VibePresetGrid vibePresets={creator.vibePresets} loading={creator.loading} onSelect={creator.handleVibeCreate} />
                                ) : (
                                    <form onSubmit={creator.handleSubmit} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="mb-1 block text-sm font-medium text-spotify-grey">Name</label>
                                                    <input
                                                        type="text"
                                                        value={creator.name}
                                                        onChange={(event) => creator.setName(event.target.value)}
                                                        className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:border-spotify-green focus:outline-none"
                                                        required
                                                        placeholder="Playlist Name"
                                                    />
                                                </div>

                                                {creator.mode === 'top' && <TopSongsForm timeRange={creator.timeRange} setTimeRange={creator.setTimeRange} />}
                                                {creator.mode === 'genre' && (
                                                    <GenrePlaylistForm genreTag={creator.genreTag} setGenreTag={creator.setGenreTag} availableTags={creator.availableTags} />
                                                )}
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-sm font-medium text-spotify-grey">Description</label>
                                                <textarea
                                                    value={creator.description}
                                                    onChange={(event) => creator.setDescription(event.target.value)}
                                                    className="min-h-[60px] w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:border-spotify-green focus:outline-none"
                                                    placeholder="Optional description..."
                                                />
                                            </div>
                                        </div>

                                        {creator.mode === 'manual' && <ManualPlaylistForm />}
                                        {creator.mode === 'smart' && (
                                            <SmartPlaylistForm
                                                matchType={creator.matchType}
                                                setMatchType={creator.setMatchType}
                                                rules={creator.rules}
                                                handleAddRule={creator.handleAddRule}
                                                handleRemoveRule={creator.handleRemoveRule}
                                                handleRuleChange={creator.handleRuleChange}
                                            />
                                        )}

                                        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                                            <button type="button" onClick={props.onClose} className="px-4 py-2 text-sm text-spotify-grey transition-colors hover:text-white">
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={creator.loading}
                                                className="rounded-full bg-spotify-green px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-spotify-green/80 disabled:opacity-50"
                                            >
                                                {creator.loading ? 'Creating...' : `Create ${creator.mode === 'smart' ? 'Smart Playlist' : creator.mode === 'manual' ? 'Playlist' : 'Generator'}`}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </GlassCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
