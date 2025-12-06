import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { toast } from 'react-hot-toast';

export function AddToPlaylistModal({ isOpen, onClose, track }) {
    const [playlists, setPlaylists] = useState([]);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPlaylists();
        }
    }, [isOpen]);

    const fetchPlaylists = async () => {
        try {
            const res = await axios.get('/api/playlists');
            setPlaylists(res.data);
        } catch (error) {
            console.error("Error fetching playlists:", error);
        }
    };

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) return;
        try {
            const res = await axios.post('/api/playlists', { name: newPlaylistName });
            setPlaylists([res.data, ...playlists]);
            setNewPlaylistName('');
            setIsCreating(false);
            toast.success('Playlist created');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create playlist');
        }
    };

    const handleAddToPlaylist = async (playlistId) => {
        try {
            const query = `${track.artist} - ${track.title}`;
            await axios.post(`/api/playlists/${playlistId}/add`, {
                playlist_id: playlistId,
                song_query: query
            });
            toast.success('Added to playlist');
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to add to playlist');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md"
                    >
                        <GlassCard className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Add to Playlist</h2>
                                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto mb-4 custom-scrollbar">
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left group"
                                >
                                    <div className="w-12 h-12 bg-white/10 rounded items-center justify-center flex group-hover:bg-spotify-green transition-colors">
                                        <Plus className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="font-medium text-white">Create New Playlist</span>
                                </button>

                                {isCreating && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="bg-white/5 p-4 rounded-lg space-y-3"
                                    >
                                        <input
                                            type="text"
                                            placeholder="Playlist Name"
                                            value={newPlaylistName}
                                            onChange={(e) => setNewPlaylistName(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-spotify-green focus:outline-none"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setIsCreating(false)}
                                                className="px-3 py-1 text-sm hover:text-white text-spotify-grey"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCreatePlaylist}
                                                className="px-3 py-1 bg-spotify-green text-white text-sm rounded hover:bg-spotify-green/80"
                                            >
                                                Create
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {playlists.map(playlist => (
                                    <button
                                        key={playlist.id}
                                        onClick={() => handleAddToPlaylist(playlist.id)}
                                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors text-left group"
                                    >
                                        <div className="w-12 h-12 bg-white/5 rounded items-center justify-center flex">
                                            <Music className="w-6 h-6 text-spotify-grey group-hover:text-white" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{playlist.name}</div>
                                            <div className="text-xs text-spotify-grey">{playlist.song_count} songs</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
