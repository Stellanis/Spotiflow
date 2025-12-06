import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Music, Play, Trash2, ArrowLeft, Loader2, MoreVertical } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';
import { usePlayer } from '../contexts/PlayerContext';
import { toast } from 'react-hot-toast';

export function Playlists({ onPlayPlaylist }) {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const { playTrack } = usePlayer();

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/playlists');
            if (res.ok) {
                const data = await res.json();
                setPlaylists(data);
            } else {
                throw new Error("Failed to fetch");
            }
        } catch (error) {
            console.error("Error fetching playlists:", error);
            toast.error("Failed to load playlists");
        } finally {
            setLoading(false);
        }
    };

    const fetchPlaylistDetails = async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/playlists/${id}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedPlaylist(data);
            } else {
                throw new Error("Failed to fetch details");
            }
        } catch (error) {
            console.error("Error fetching playlist details:", error);
            toast.error("Failed to load playlist details");
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePlaylist = async (id, e) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this playlist?")) return;
        try {
            const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setPlaylists(playlists.filter(p => p.id !== id));
                if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
                toast.success("Playlist deleted");
            }
        } catch (error) {
            toast.error("Failed to delete playlist");
        }
    };

    const handleRemoveSong = async (songQuery) => {
        try {
            const res = await fetch(`/api/playlists/${selectedPlaylist.id}/songs/${encodeURIComponent(songQuery)}`, { method: 'DELETE' });
            if (res.ok) {
                setSelectedPlaylist(prev => ({
                    ...prev,
                    songs: prev.songs.filter(s => s.query !== songQuery),
                    song_count: prev.song_count - 1
                }));
                toast.success("Song removed");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to remove song");
        }
    };

    const handlePlayPlaylist = async () => {
        if (!selectedPlaylist?.songs?.length) return;
        // Play first song, set queue to remaining
        const firstSong = selectedPlaylist.songs[0];
        // We need to pass the FULL queue to the player context
        // PlayerContext needs to be updated to accept a queue!
        // I assumed I updated PlayerContext to handle queues. Yes I did in Step 96.
        // playTrack(track, queue)
        playTrack(firstSong, selectedPlaylist.songs);
    };

    if (selectedPlaylist) {
        return (
            <div className="space-y-6">
                <button
                    onClick={() => setSelectedPlaylist(null)}
                    className="flex items-center gap-2 text-spotify-grey hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Playlists
                </button>

                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-full md:w-64 aspect-square bg-gradient-to-br from-spotify-green/20 to-spotify-dark rounded-lg flex items-center justify-center shadow-2xl relative group">
                        <Music className="w-24 h-24 text-white/50" />
                        <button
                            onClick={handlePlayPlaylist}
                            className="absolute bottom-4 right-4 p-4 bg-spotify-green rounded-full text-black shadow-lg hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 duration-300"
                        >
                            <Play className="w-6 h-6 fill-current" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <h2 className="text-4xl font-bold mb-2">{selectedPlaylist.name}</h2>
                            <p className="text-spotify-grey">{selectedPlaylist.description || "No description"}</p>
                            <p className="text-sm text-spotify-grey mt-2">
                                {selectedPlaylist.song_count} songs • Created {new Date(selectedPlaylist.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    {selectedPlaylist.songs.map((song, index) => (
                        <div
                            key={`${song.query}-${index}`}
                            className="group flex items-center gap-4 p-3 rounded-md hover:bg-white/5 transition-colors"
                        >
                            <span className="text-spotify-grey w-6 text-center">{index + 1}</span>
                            <div className="w-10 h-10 bg-white/10 rounded overflow-hidden">
                                {song.image_url && <img src={song.image_url} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate text-white">{song.title}</div>
                                <div className="text-sm text-spotify-grey truncate">{song.artist}</div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => playTrack(song, selectedPlaylist.songs)}
                                    className="p-2 hover:text-spotify-green transition-colors"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                </button>
                                <button
                                    onClick={() => handleRemoveSong(song.query)}
                                    className="p-2 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {selectedPlaylist.songs.length === 0 && (
                        <div className="text-center py-10 text-spotify-grey">
                            This playlist is empty. Add songs from your Library.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* Create New Card (Moved to Modal or keeping pure view here? Creating handled in Modal via library) 
                Actually, user might want to create empty playlist.
            */}

            {playlists.length === 0 ? (
                <div className="col-span-full text-center py-20 text-spotify-grey">
                    <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-xl font-semibold">No Playlists</p>
                    <p className="mt-2 text-sm">Create playlists by collecting songs in your Library.</p>
                </div>
            ) : (
                playlists.map(playlist => (
                    <GlassCard
                        key={playlist.id}
                        onClick={() => fetchPlaylistDetails(playlist.id)}
                        className="aspect-square p-4 flex flex-col justify-between cursor-pointer hover:bg-white/10 transition-colors group"
                    >
                        <div className="w-full aspect-square bg-white/5 rounded-md flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                            <Music className="w-12 h-12 text-spotify-grey group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="font-bold truncate">{playlist.name}</h3>
                            <p className="text-xs text-spotify-grey mt-1">{playlist.song_count} songs</p>
                        </div>
                        <button
                            onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                            className="absolute top-2 right-2 p-2 text-spotify-grey hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </GlassCard>
                ))
            )}
        </div>
    );
}
