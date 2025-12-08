import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Music, Play, Trash2, ArrowLeft, Loader2, MoreVertical, Edit2, GripVertical, Settings, Sparkles, BarChart3, ListMusic } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';
import { usePlayer } from '../contexts/PlayerContext';
import { toast } from 'react-hot-toast';
import { EditPlaylistModal } from './EditPlaylistModal';
import { PlaylistInsights } from './PlaylistInsights';
import { PlaylistRecommendations } from './PlaylistRecommendations';
import { PlaylistCreator } from './PlaylistCreator';
import { ConfirmationModal } from './ConfirmationModal';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableSongRow({ song, index, playTrack, handleRemoveSong, selectedPlaylist }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: song.query });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center gap-4 p-3 rounded-md hover:bg-white/5 transition-colors touch-none select-none",
                isDragging ? "bg-white/10 shadow-xl opacity-90" : "bg-transparent"
            )}
        >
            <div className="flex items-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab hover:text-white text-spotify-grey p-1">
                    <GripVertical className="w-5 h-5" />
                </div>
                <span className="text-spotify-grey w-6 text-center tabular-nums">{index + 1}</span>
            </div>

            <div className="w-10 h-10 bg-white/10 rounded overflow-hidden shrink-0">
                {song.image_url && <img src={song.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />}
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
    );
}

export function Playlists({ onPlayPlaylist }) {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { playTrack } = usePlayer();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    const [deleteModal, setDeleteModal] = useState({ isOpen: false, playlistId: null });

    const initiateDelete = (id, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteModal({ isOpen: true, playlistId: id });
    };

    const confirmDelete = async () => {
        const id = deleteModal.playlistId;
        if (!id) return;

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
        const firstSong = selectedPlaylist.songs[0];
        playTrack(firstSong, selectedPlaylist.songs);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setSelectedPlaylist((prev) => {
                const oldIndex = prev.songs.findIndex((item) => item.query === active.id);
                const newIndex = prev.songs.findIndex((item) => item.query === over.id);

                const newSongs = arrayMove(prev.songs, oldIndex, newIndex);

                // Update positions locally
                const updatedSongs = newSongs.map((song, idx) => ({ ...song, position: idx }));

                // Call backend to update positions
                // We'll prepare the list of items with their new positions
                const reorderItems = updatedSongs.map((song, index) => ({
                    song_query: song.query,
                    new_position: index
                }));

                // Optimistic update done, now sync with backend
                fetch(`/api/playlists/${prev.id}/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reorderItems)
                }).catch(err => {
                    console.error("Failed to reorder playlist", err);
                    toast.error("Failed to save order");
                    // Revert? For now, we trust.
                });

                return {
                    ...prev,
                    songs: updatedSongs
                };
            });
        }
    };

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('songs'); // 'songs' | 'insights'

    const fetchStats = async (id) => {
        setStatsLoading(true);
        try {
            const res = await fetch(`/api/playlists/${id}/stats`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to load stats", error);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedPlaylist && activeTab === 'insights') {
            fetchStats(selectedPlaylist.id);
        }
    }, [selectedPlaylist, activeTab]);
    const handlePlaylistUpdate = (updatedPlaylist) => {
        setSelectedPlaylist(updatedPlaylist);
        setPlaylists(prev => prev.map(p => p.id === updatedPlaylist.id ? { ...p, name: updatedPlaylist.name, song_count: updatedPlaylist.songs.length } : p));
    };

    if (selectedPlaylist) {
        const isSmart = selectedPlaylist.type === 'smart';

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <EditPlaylistModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    playlist={selectedPlaylist}
                    onUpdate={handlePlaylistUpdate}
                />

                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setSelectedPlaylist(null)}
                        className="flex items-center gap-2 text-spotify-grey hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Playlists
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-full md:w-64 aspect-square bg-gradient-to-br from-spotify-green/20 to-spotify-dark rounded-lg flex items-center justify-center shadow-2xl relative group shrink-0 overflow-hidden">
                        {selectedPlaylist.images && selectedPlaylist.images.length >= 4 ? (
                            <div className="w-full h-full grid grid-cols-2">
                                {selectedPlaylist.images.slice(0, 4).map((img, i) => (
                                    <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                                ))}
                            </div>
                        ) : selectedPlaylist.images && selectedPlaylist.images.length > 0 ? (
                            <img src={selectedPlaylist.images[0]} alt={selectedPlaylist.name} className="w-full h-full object-cover" />
                        ) : (
                            <Music className="w-24 h-24 text-white/50" />
                        )}
                        <button
                            onClick={handlePlayPlaylist}
                            className="absolute bottom-4 right-4 p-4 bg-spotify-green rounded-full text-black shadow-lg hover:scale-105 transition-transform opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 duration-300 z-10"
                        >
                            <Play className="w-6 h-6 fill-current" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 min-w-0">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                {isSmart && (
                                    <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-purple-500/30">
                                        <Sparkles className="w-3 h-3" />
                                        Smart Playlist
                                    </span>
                                )}
                            </div>
                            <div onClick={() => setIsEditModalOpen(true)} className="group cursor-pointer">
                                <h2 className="text-4xl md:text-5xl font-bold mb-4 break-words group-hover:text-spotify-green transition-colors flex items-center gap-4">
                                    {selectedPlaylist.name}
                                    <Edit2 className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-spotify-grey" />
                                </h2>
                            </div>
                            <p className="text-spotify-grey text-lg line-clamp-3 whitespace-pre-wrap">{selectedPlaylist.description || "No description"}</p>
                            <div className="flex items-center gap-2 text-sm text-spotify-grey mt-4">
                                <span>{selectedPlaylist.song_count} songs</span>
                                <span>•</span>
                                <span>Created {new Date(selectedPlaylist.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-4 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('songs')}
                        className={cn(
                            "px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors",
                            activeTab === 'songs'
                                ? "border-spotify-green text-spotify-green"
                                : "border-transparent text-spotify-grey hover:text-white"
                        )}
                    >
                        <ListMusic className="w-4 h-4" />
                        Songs
                    </button>
                    <button
                        onClick={() => setActiveTab('insights')}
                        className={cn(
                            "px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors",
                            activeTab === 'insights'
                                ? "border-spotify-green text-spotify-green"
                                : "border-transparent text-spotify-grey hover:text-white"
                        )}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Insights
                    </button>
                </div>

                {activeTab === 'insights' ? (
                    <PlaylistInsights stats={stats} loading={statsLoading} />
                ) : (
                    <div className="space-y-8">
                        {selectedPlaylist.songs.length === 0 ? (
                            <div className="text-center py-10 text-spotify-grey">
                                {isSmart ? (
                                    <p>No songs match your rules.</p>
                                ) : (
                                    <p>This playlist is empty. Add songs from your Library or check suggestions below.</p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {isSmart ? (
                                    // Smart playlists are read-only for ordering
                                    selectedPlaylist.songs.map((song, index) => (
                                        <div
                                            key={song.query}
                                            className="group flex items-center gap-4 p-3 rounded-md hover:bg-white/5 transition-colors"
                                        >
                                            <span className="text-spotify-grey w-6 text-center tabular-nums">{index + 1}</span>
                                            <div className="w-10 h-10 bg-white/10 rounded overflow-hidden shrink-0">
                                                {song.image_url && <img src={song.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate text-white">{song.title}</div>
                                                <div className="text-sm text-spotify-grey truncate">{song.artist}</div>
                                            </div>
                                            <button
                                                onClick={() => playTrack(song, selectedPlaylist.songs)}
                                                className="p-2 opacity-0 group-hover:opacity-100 hover:text-spotify-green transition-all"
                                            >
                                                <Play className="w-4 h-4 fill-current" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    // Manual lists use DnD
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={selectedPlaylist.songs.map(s => s.query)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {selectedPlaylist.songs.map((song, index) => (
                                                <SortableSongRow
                                                    key={song.query}
                                                    song={song}
                                                    index={index}
                                                    playTrack={playTrack}
                                                    handleRemoveSong={handleRemoveSong}
                                                    selectedPlaylist={selectedPlaylist}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        )}

                        {!isSmart && (
                            <div className="pt-8 border-t border-white/5">
                                <PlaylistRecommendations
                                    playlistId={selectedPlaylist.id}
                                    onAdd={(song) => {
                                        // Refresh playlist details to show new song
                                        fetchPlaylistDetails(selectedPlaylist.id);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
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
        <>
            <PlaylistCreator
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={(newPlaylist) => setPlaylists([newPlaylist, ...playlists])}
            />

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, playlistId: null })}
                onConfirm={confirmDelete}
                title="Delete Playlist"
                message="Are you sure you want to delete this playlist? This action cannot be undone."
                isDangerous={true}
            />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in duration-500">
                <GlassCard
                    onClick={() => setIsCreateModalOpen(true)}
                    className="aspect-square p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors group border-dashed border-2 border-white/10 hover:border-spotify-green/50"
                >
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-spotify-green/20">
                        <Plus className="w-8 h-8 text-spotify-grey group-hover:text-spotify-green transition-colors" />
                    </div>
                    <h3 className="font-bold text-center group-hover:text-white transition-colors">Create Playlist</h3>
                </GlassCard>

                {playlists.map(playlist => (
                    <GlassCard
                        key={playlist.id}
                        onClick={() => fetchPlaylistDetails(playlist.id)}
                        className="aspect-square p-4 flex flex-col cursor-pointer hover:bg-white/10 transition-colors group relative overflow-hidden"
                    >
                        <div className="w-full aspect-square bg-white/5 rounded-md mb-4 overflow-hidden relative shadow-lg">
                            {playlist.images && playlist.images.length >= 4 ? (
                                <div className="grid grid-cols-2 h-full">
                                    {playlist.images.slice(0, 4).map((img, i) => (
                                        <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                                    ))}
                                </div>
                            ) : playlist.images && playlist.images.length > 0 ? (
                                <img src={playlist.images[0]} alt={playlist.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
                                    <Music className="w-12 h-12 text-white/20" />
                                </div>
                            )}

                            {/* Type Badge */}
                            {playlist.type === 'smart' && (
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 shadow-sm">
                                    <Sparkles className="w-3 h-3 text-purple-400" />
                                </div>
                            )}

                            {/* Hover Play Button */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {/* Only show if not empty */}
                            </div>
                        </div>

                        <div className="min-w-0 w-full">
                            <h3 className="font-bold truncate text-white mb-1 group-hover:text-spotify-green transition-colors">{playlist.name}</h3>
                            <p className="text-sm text-spotify-grey truncate">
                                {playlist.song_count} songs
                                {playlist.type === 'smart' && ' • Smart'}
                            </p>
                        </div>

                        <button
                            onClick={(e) => initiateDelete(playlist.id, e)}
                            className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white text-white/70 transition-all transform translate-y-[-10px] group-hover:translate-y-0"
                            title="Delete Playlist"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </GlassCard>
                ))}
            </div>
        </>
    );
}
