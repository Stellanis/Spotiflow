import { AnimatePresence, motion } from 'framer-motion';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowLeft, Calendar, Clock, MoreHorizontal, Music, Play, Sparkles } from 'lucide-react';

import { cn } from '../../utils';
import { EditPlaylistModal } from '../EditPlaylistModal';
import { PlaylistInsights } from '../PlaylistInsights';
import { PlaylistRecommendations } from '../PlaylistRecommendations';
import { SortableSongRow } from './SortableSongRow';

export function PlaylistDetail({
    selectedPlaylist,
    activeTab,
    setActiveTab,
    isEditModalOpen,
    setIsEditModalOpen,
    onBack,
    onPlayPlaylist,
    playTrack,
    addToQueueNext,
    addToQueueEnd,
    handleRemoveSong,
    handleDragEnd,
    stats,
    statsLoading,
    onPlaylistUpdate,
    refreshPlaylistDetails,
}) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    return (
        <motion.div
            key="detail-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 p-3 pb-20 md:p-0"
        >
            <EditPlaylistModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                playlist={selectedPlaylist}
                onUpdate={onPlaylistUpdate}
            />

            <div className="relative z-20 flex items-center justify-between">
                <button onClick={onBack} className="group flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 transition-colors hover:bg-white/10">
                    <ArrowLeft className="h-4 w-4 text-spotify-grey transition-colors group-hover:text-white" />
                    <span className="text-sm font-medium text-spotify-grey transition-colors group-hover:text-white">Back</span>
                </button>

                <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="rounded-full p-2 text-spotify-grey transition-colors hover:bg-white/10 hover:text-white"
                    title="Edit Playlist Details"
                >
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </div>

            <div className="group relative overflow-hidden rounded-2xl p-6 shadow-2xl ring-1 ring-white/5 md:rounded-3xl md:p-12">
                <div
                    className="absolute inset-0 z-0 scale-110 bg-cover bg-center opacity-40 blur-3xl transition-transform duration-1000 group-hover:scale-105"
                    style={{
                        backgroundImage: selectedPlaylist.images?.length > 0 ? `url(${selectedPlaylist.images[0]})` : undefined,
                        backgroundColor: !selectedPlaylist.images?.length ? '#1e1e1e' : undefined,
                    }}
                />
                <div className="absolute inset-0 z-0 bg-black/40" />

                <div className="relative z-10 flex flex-col items-end gap-8 md:flex-row">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="h-52 w-52 shrink-0 overflow-hidden rounded-xl bg-spotify-dark shadow-[0_8px_30px_rgb(0,0,0,0.5)] ring-1 ring-white/10"
                    >
                        {selectedPlaylist.images?.length >= 4 ? (
                            <div className="grid h-full grid-cols-2">
                                {selectedPlaylist.images.slice(0, 4).map((img, index) => (
                                    <img key={index} src={img} alt="" className="h-full w-full object-cover" />
                                ))}
                            </div>
                        ) : selectedPlaylist.images?.length > 0 ? (
                            <img src={selectedPlaylist.images[0]} alt={selectedPlaylist.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
                                <Music className="h-20 w-20 text-white/20" />
                            </div>
                        )}
                    </motion.div>

                    <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                                    {selectedPlaylist.type === 'smart' ? 'Smart Playlist' : 'Playlist'}
                                </span>
                                {selectedPlaylist.type === 'smart' && <Sparkles className="h-4 w-4 animate-pulse text-purple-400" />}
                            </div>
                            <h1 className="text-5xl font-bold leading-none tracking-tight text-white drop-shadow-lg shadow-black md:text-7xl">
                                {selectedPlaylist.name}
                            </h1>
                            <p className="max-w-2xl text-lg leading-relaxed text-white/70 line-clamp-2">
                                {selectedPlaylist.description || 'No description provided.'}
                            </p>
                        </div>

                        <div className="flex items-center gap-6 pt-2">
                            <button
                                onClick={onPlayPlaylist}
                                className="flex items-center gap-2 rounded-full bg-spotify-green px-8 py-3 font-bold text-black shadow-xl shadow-green-900/20 transition-all hover:scale-105 hover:bg-green-400"
                            >
                                <Play className="h-5 w-5 fill-current" />
                                Play
                            </button>

                            <div className="flex items-center gap-4 text-sm font-medium text-white/60">
                                <span className="flex items-center gap-1.5">
                                    <Music className="h-4 w-4" />
                                    {selectedPlaylist.song_count} songs
                                </span>
                                <span className="h-1 w-1 rounded-full bg-white/20" />
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(selectedPlaylist.created_at).getFullYear()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6 px-2">
                <div className="flex items-center gap-8 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('songs')}
                        className={cn(
                            'relative py-4 text-sm font-bold uppercase tracking-wider transition-colors',
                            activeTab === 'songs' ? 'text-white' : 'text-spotify-grey hover:text-white'
                        )}
                    >
                        Songs
                        {activeTab === 'songs' && <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-spotify-green" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('insights')}
                        className={cn(
                            'relative py-4 text-sm font-bold uppercase tracking-wider transition-colors',
                            activeTab === 'insights' ? 'text-white' : 'text-spotify-grey hover:text-white'
                        )}
                    >
                        Insights
                        {activeTab === 'insights' && <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-spotify-green" />}
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'insights' ? (
                        <motion.div key="insights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <PlaylistInsights stats={stats} loading={statsLoading} />
                        </motion.div>
                    ) : (
                        <motion.div key="songs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                            <div className="grid grid-cols-[auto_1fr_auto] gap-4 border-b border-white/5 px-4 pb-2 text-xs font-medium uppercase tracking-wider text-spotify-grey">
                                <div className="w-12 text-center text-base">#</div>
                                <div>Title</div>
                                <div className="w-12"><Clock className="mx-auto h-4 w-4" /></div>
                            </div>

                            {selectedPlaylist.songs.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 py-20 text-center text-spotify-grey">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                        <Music className="h-8 w-8 opacity-50" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-medium text-white">Playlist is empty</h3>
                                    <p className="mx-auto max-w-md">
                                        {selectedPlaylist.type === 'smart' ? 'No songs match your rules yet.' : 'Add songs from your Library or check suggestions below.'}
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
                                                addToQueueNext={addToQueueNext}
                                                addToQueueEnd={addToQueueEnd}
                                                handleRemoveSong={handleRemoveSong}
                                                selectedPlaylist={selectedPlaylist}
                                            />
                                        ))
                                    ) : (
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={selectedPlaylist.songs.map((song) => song.query)} strategy={verticalListSortingStrategy}>
                                                {selectedPlaylist.songs.map((song, index) => (
                                                    <SortableSongRow
                                                        key={song.query}
                                                        song={song}
                                                        index={index}
                                                        playTrack={playTrack}
                                                        addToQueueNext={addToQueueNext}
                                                        addToQueueEnd={addToQueueEnd}
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
                                <div className="border-t border-white/5 pt-12">
                                    <PlaylistRecommendations playlistId={selectedPlaylist.id} onAdd={() => refreshPlaylistDetails(selectedPlaylist.id)} />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
