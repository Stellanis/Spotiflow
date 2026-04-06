import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus } from 'lucide-react';

import { PlaylistActions } from './PlaylistActions';
import { PlaylistCard } from './PlaylistCard';

export function PlaylistGrid({ loading, playlists, onCreate, onOpen, initiateDelete }) {
    return (
        <motion.div
            key="grid-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8 p-3 md:p-0"
        >
            <PlaylistActions onCreate={onCreate} />

            {loading ? (
                <div className="flex h-[50vh] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-spotify-green" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={onCreate} className="h-full">
                        <div className="group flex h-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 shadow-lg transition-all hover:border-spotify-green/50 hover:bg-white/10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-spotify-green/20">
                                <Plus className="h-8 w-8 text-spotify-grey transition-colors group-hover:text-spotify-green" />
                            </div>
                            <span className="font-bold text-spotify-grey transition-colors group-hover:text-white">Create Playlist</span>
                        </div>
                    </motion.div>

                    <AnimatePresence mode="popLayout">
                        {playlists.map((playlist) => (
                            <PlaylistCard
                                key={playlist.id}
                                playlist={playlist}
                                onClick={() => onOpen(playlist.id)}
                                initiateDelete={initiateDelete}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
