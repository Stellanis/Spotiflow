import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Music, Play, Trash2, ArrowLeft, Loader2, Edit2, GripVertical, Sparkles, BarChart3, ListMusic, Clock, Calendar, MoreHorizontal } from 'lucide-react';
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

// --- Sub-components for cleaner code ---

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
                "group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 touch-none select-none border border-transparent hover:border-white/5",
                isDragging ? "bg-white/10 shadow-xl opacity-90 scale-[1.02]" : "bg-transparent"
            )}
        >
            <div className="flex items-center gap-3 w-12 text-spotify-grey">
                <div {...attributes} {...listeners} className="cursor-grab hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4" />
                </div>
                <span className="text-sm font-mono w-4 text-center tabular-nums group-hover:hidden">{index + 1}</span>
                <button
                    onClick={() => playTrack(song, selectedPlaylist.songs)}
                    className="hidden group-hover:block text-white hover:text-spotify-green transition-colors -ml-1"
                >
                    <Play className="w-4 h-4 fill-current" />
                </button>
            </div>

            <div className="w-12 h-12 bg-white/10 rounded-lg overflow-hidden shrink-0 shadow-sm relative">
                {song.image_url ? (
                    <img src={song.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-spotify-grey/20">
                        <Music className="w-5 h-5 text-spotify-grey" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="font-medium truncate text-white text-base group-hover:text-spotify-green transition-colors">{song.title}</div>
                <div className="flex items-center gap-2 text-sm text-spotify-grey truncate">
                    <span>{song.artist}</span>
                    {song.album && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-spotify-grey/40" />
                            <span className="truncate opacity-80">{song.album}</span>
                        </>
                    )}
                </div>
            </div>

            <button
                onClick={() => handleRemoveSong(song.query)}
                className="p-2 text-spotify-grey hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                title="Remove from playlist"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}

function PlaylistCard({ playlist, onClick, initiateDelete }) {
    // Generate grid of images for cover
    const coverImages = playlist.images ? playlist.images.slice(0, 4) : [];
    const isSmart = playlist.type === 'smart';

    return (
        <motion.div

            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            <GlassCard
                onClick={onClick}
                className="h-full p-4 flex flex-col cursor-pointer hover:bg-white/10 transition-colors group relative overflow-hidden ring-1 ring-white/5 hover:ring-white/20"
                image={coverImages.length > 0 ? coverImages[0] : null}
            >
                {/* Cover Art Area */}
                <div className="w-full aspect-square bg-white/5 rounded-xl mb-4 overflow-hidden relative shadow-lg group-hover:shadow-2xl transition-all duration-300">
                    {coverImages.length >= 4 ? (
                        <div className="grid grid-cols-2 h-full w-full">
                            {coverImages.map((img, i) => (
                                <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                            ))}
                        </div>
                    ) : coverImages.length > 0 ? (
                        <img src={coverImages[0]} alt={playlist.name} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                            <Music className="w-16 h-16 text-white/10" />
                        </div>
                    )}

                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                        <div className="w-12 h-12 bg-spotify-green rounded-full flex items-center justify-center shadow-xl shadow-black/40 text-black">
                            <Play className="w-6 h-6 fill-current ml-1" />
                        </div>
                    </div>

                    {/* Smart Badge */}
                    {isSmart && (
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded-full px-2 py-1 shadow-sm border border-purple-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Smart</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="min-w-0 w-full flex-1 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold truncate text-white text-lg mb-1 group-hover:text-spotify-green transition-colors leading-tight">
                            {playlist.name}
                        </h3>
                        {playlist.description && (
                            <p className="text-xs text-spotify-grey line-clamp-2 mb-2 leading-relaxed">
                                {playlist.description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-spotify-grey uppercase tracking-wider mt-2 pt-3 border-t border-white/5">
                        <span className="flex items-center gap-1">
                            <Music className="w-3 h-3" />
                            {playlist.song_count}
                        </span>
                        <span>
                            {new Date(playlist.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>

                {/* Delete Action - Top Right */}
                <button
                    onClick={(e) => initiateDelete(playlist.id, e)}
                    className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white text-white/70 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 hover:scale-110 shadow-lg z-10"
                    title="Delete Playlist"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </GlassCard>
        </motion.div>
    );
}

export function Playlists({ onPlayPlaylist }) {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creatorMode, setCreatorMode] = useState('menu');
    const { playTrack } = usePlayer();

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchPlaylists();

        const handleOpenVibe = () => {
            setCreatorMode('vibe');
            setIsCreateModalOpen(true);
        };

        window.addEventListener('open-vibe-generator', handleOpenVibe);
        return () => window.removeEventListener('open-vibe-generator', handleOpenVibe);
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
                const updatedSongs = newSongs.map((song, idx) => ({ ...song, position: idx }));

                const reorderItems = updatedSongs.map((song, index) => ({
                    song_query: song.query,
                    new_position: index
                }));

                fetch(`/api/playlists/${prev.id}/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reorderItems)
                }).catch(err => {
                    console.error("Failed to reorder playlist", err);
                    toast.error("Failed to save order");
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
    const [activeTab, setActiveTab] = useState('songs');

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

    // --- Main Render Logic with AnimatePresence ---
    return (
        <>
            <PlaylistCreator
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); setCreatorMode('menu'); }}
                onCreate={(newPlaylist) => setPlaylists([newPlaylist, ...playlists])}
                initialMode={creatorMode}
            />

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, playlistId: null })}
                onConfirm={confirmDelete}
                title="Delete Playlist"
                message="Are you sure you want to delete this playlist? This action cannot be undone."
                isDangerous={true}
            />

            <AnimatePresence mode="wait">
                {selectedPlaylist ? (
                    <motion.div
                        key="detail-view"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6 pb-20"
                    >
                        <EditPlaylistModal
                            isOpen={isEditModalOpen}
                            onClose={() => setIsEditModalOpen(false)}
                            playlist={selectedPlaylist}
                            onUpdate={handlePlaylistUpdate}
                        />

                        <div className="flex items-center justify-between z-20 relative">
                            <button
                                onClick={() => setSelectedPlaylist(null)}
                                className="flex items-center gap-2 group px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 text-spotify-grey group-hover:text-white transition-colors" />
                                <span className="text-sm font-medium text-spotify-grey group-hover:text-white transition-colors">Back</span>
                            </button>

                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-2 rounded-full hover:bg-white/10 text-spotify-grey hover:text-white transition-colors"
                                title="Edit Playlist Details"
                            >
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Hero Section */}
                        <div className="relative rounded-3xl overflow-hidden p-8 md:p-12 shadow-2xl group ring-1 ring-white/5">
                            {/* Background Blur */}
                            <div
                                className="absolute inset-0 z-0 bg-cover bg-center blur-3xl opacity-40 scale-110 transition-transform duration-1000 group-hover:scale-105"
                                style={{ backgroundImage: selectedPlaylist.images && selectedPlaylist.images.length > 0 ? `url(${selectedPlaylist.images[0]})` : undefined, backgroundColor: !selectedPlaylist.images || selectedPlaylist.images.length === 0 ? '#1e1e1e' : undefined }}
                            />
                            <div className="absolute inset-0 z-0 bg-black/40" />

                            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-end">
                                {/* Cover Art */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-52 h-52 shrink-0 rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.5)] bg-spotify-dark ring-1 ring-white/10"
                                >
                                    {selectedPlaylist.images && selectedPlaylist.images.length >= 4 ? (
                                        <div className="grid grid-cols-2 h-full">
                                            {selectedPlaylist.images.slice(0, 4).map((img, i) => (
                                                <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                                            ))}
                                        </div>
                                    ) : selectedPlaylist.images && selectedPlaylist.images.length > 0 ? (
                                        <img src={selectedPlaylist.images[0]} alt={selectedPlaylist.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
                                            <Music className="w-20 h-20 text-white/20" />
                                        </div>
                                    )}
                                </motion.div>

                                {/* Metadata */}
                                <div className="flex-1 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                                                {selectedPlaylist.type === 'smart' ? 'Smart Playlist' : 'Playlist'}
                                            </span>
                                            {selectedPlaylist.type === 'smart' && <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />}
                                        </div>
                                        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-none shadow-black drop-shadow-lg">
                                            {selectedPlaylist.name}
                                        </h1>
                                        <p className="text-white/70 text-lg max-w-2xl line-clamp-2 leading-relaxed">
                                            {selectedPlaylist.description || "No description provided."}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-6 pt-2">
                                        <button
                                            onClick={handlePlayPlaylist}
                                            className="px-8 py-3 bg-spotify-green hover:bg-green-400 text-black font-bold rounded-full transition-all hover:scale-105 shadow-xl shadow-green-900/20 flex items-center gap-2"
                                        >
                                            <Play className="w-5 h-5 fill-current" />
                                            Play
                                        </button>

                                        <div className="flex items-center gap-4 text-sm font-medium text-white/60">
                                            <span className="flex items-center gap-1.5">
                                                <Music className="w-4 h-4" />
                                                {selectedPlaylist.song_count} songs
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(selectedPlaylist.created_at).getFullYear()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs & Content */}
                        <div className="space-y-6 px-2">
                            <div className="flex items-center gap-8 border-b border-white/10">
                                <button
                                    onClick={() => setActiveTab('songs')}
                                    className={cn(
                                        "py-4 text-sm font-bold uppercase tracking-wider relative transition-colors",
                                        activeTab === 'songs' ? "text-white" : "text-spotify-grey hover:text-white"
                                    )}
                                >
                                    Songs
                                    {activeTab === 'songs' && (
                                        <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-spotify-green" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('insights')}
                                    className={cn(
                                        "py-4 text-sm font-bold uppercase tracking-wider relative transition-colors",
                                        activeTab === 'insights' ? "text-white" : "text-spotify-grey hover:text-white"
                                    )}
                                >
                                    Insights
                                    {activeTab === 'insights' && (
                                        <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-spotify-green" />
                                    )}
                                </button>
                            </div>

                            <AnimatePresence mode="wait">
                                {activeTab === 'insights' ? (
                                    <motion.div
                                        key="insights"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <PlaylistInsights stats={stats} loading={statsLoading} />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="songs"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-8"
                                    >
                                        {/* Song Header */}
                                        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 pb-2 text-xs font-medium uppercase tracking-wider text-spotify-grey border-b border-white/5">
                                            <div className="w-12 text-center text-base">#</div>
                                            <div>Title</div>
                                            <div className="w-12"><Clock className="w-4 h-4 mx-auto" /></div>
                                        </div>

                                        {selectedPlaylist.songs.length === 0 ? (
                                            <div className="text-center py-20 text-spotify-grey bg-white/5 rounded-2xl border border-dashed border-white/10">
                                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Music className="w-8 h-8 opacity-50" />
                                                </div>
                                                <h3 className="text-lg font-medium text-white mb-2">Playlist is empty</h3>
                                                <p className="max-w-md mx-auto">
                                                    {selectedPlaylist.type === 'smart' ? "No songs match your rules yet." : "Add songs from your Library or check suggestions below."}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {selectedPlaylist.type === 'smart' ? (
                                                    selectedPlaylist.songs.map((song, index) => (
                                                        <SortableSongRow
                                                            key={song.query}
                                                            song={song}
                                                            index={index}
                                                            playTrack={playTrack}
                                                            handleRemoveSong={handleRemoveSong}
                                                            selectedPlaylist={selectedPlaylist}
                                                        />
                                                    ))
                                                ) : (
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

                                        {selectedPlaylist.type !== 'smart' && (
                                            <div className="pt-12 border-t border-white/5">
                                                <PlaylistRecommendations
                                                    playlistId={selectedPlaylist.id}
                                                    onAdd={(song) => fetchPlaylistDetails(selectedPlaylist.id)}
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="grid-view"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                                    <ListMusic className="w-6 h-6 text-spotify-green" />
                                    Your Playlists
                                </h2>
                                <p className="text-spotify-grey text-sm mt-1">Manage and curate your collections</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-[50vh]">
                                <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {/* Create New Card */}
                                <motion.div
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="h-full"
                                >
                                    <div className="h-full rounded-2xl border border-dashed border-white/20 bg-white/5 hover:border-spotify-green/50 hover:bg-white/10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group p-4 shadow-lg">
                                        <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-spotify-green/20 flex items-center justify-center transition-colors">
                                            <Plus className="w-8 h-8 text-spotify-grey group-hover:text-spotify-green transition-colors" />
                                        </div>
                                        <span className="font-bold text-spotify-grey group-hover:text-white transition-colors">Create Playlist</span>
                                    </div>
                                </motion.div>


                                <AnimatePresence mode="popLayout">
                                    {playlists.map(playlist => (
                                        <PlaylistCard
                                            key={playlist.id}
                                            playlist={playlist}
                                            onClick={() => fetchPlaylistDetails(playlist.id)}
                                            initiateDelete={initiateDelete}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default Playlists;
