import { ListMusic, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export function PlaylistActions({ onCreate }) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
                    <ListMusic className="h-6 w-6 text-spotify-green" />
                    Your Playlists
                </h2>
                <p className="mt-1 text-sm text-spotify-grey">Manage and curate your collections</p>
            </div>

            <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCreate}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
                <Plus className="h-4 w-4" />
                Create Playlist
            </motion.button>
        </div>
    );
}
