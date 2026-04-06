import { motion } from 'framer-motion';
import { Music, Play, Sparkles, Trash2 } from 'lucide-react';

import { GlassCard } from '../GlassCard';

export function PlaylistCard({ playlist, onClick, initiateDelete }) {
    const coverImages = playlist.images ? playlist.images.slice(0, 4) : [];
    const isSmart = playlist.type === 'smart';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
            <GlassCard
                onClick={onClick}
                className="group relative flex h-full cursor-pointer flex-col overflow-hidden p-4 transition-colors hover:bg-white/10 ring-1 ring-white/5 hover:ring-white/20"
                image={coverImages.length > 0 ? coverImages[0] : null}
            >
                <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-white/5 shadow-lg transition-all duration-300 group-hover:shadow-2xl">
                    {coverImages.length >= 4 ? (
                        <div className="grid h-full w-full grid-cols-2">
                            {coverImages.map((img, index) => (
                                <img key={index} src={img} alt="" className="h-full w-full object-cover" />
                            ))}
                        </div>
                    ) : coverImages.length > 0 ? (
                        <img src={coverImages[0]} alt={playlist.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                            <Music className="h-16 w-16 text-white/10" />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-0 flex scale-90 items-center justify-center opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-spotify-green text-black shadow-xl shadow-black/40">
                            <Play className="ml-1 h-6 w-6 fill-current" />
                        </div>
                    </div>

                    {isSmart && (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-purple-500/30 bg-black/60 px-2 py-1 shadow-sm backdrop-blur-md">
                            <Sparkles className="h-3 w-3 text-purple-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white">Smart</span>
                        </div>
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                        <h3 className="mb-1 truncate text-lg font-bold leading-tight text-white transition-colors group-hover:text-spotify-green">
                            {playlist.name}
                        </h3>
                        {playlist.description && <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-spotify-grey">{playlist.description}</p>}
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-3 text-xs uppercase tracking-wider text-spotify-grey">
                        <span className="flex items-center gap-1">
                            <Music className="h-3 w-3" />
                            {playlist.song_count}
                        </span>
                        <span>{new Date(playlist.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                    </div>
                </div>

                <button
                    onClick={(event) => initiateDelete(playlist.id, event)}
                    className="absolute right-3 top-3 z-10 transform rounded-full bg-black/60 p-2 text-white/70 opacity-0 shadow-lg transition-all duration-200 hover:scale-110 hover:bg-red-500 hover:text-white group-hover:translate-y-0 group-hover:opacity-100"
                    title="Delete Playlist"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </GlassCard>
        </motion.div>
    );
}
