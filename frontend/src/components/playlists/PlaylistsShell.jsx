import { AnimatePresence } from 'framer-motion';

import { usePlayer } from '../../contexts/PlayerContext';
import { ConfirmationModal } from '../ConfirmationModal';
import { PlaylistCreator } from '../PlaylistCreator';
import { PlaylistDetail } from './PlaylistDetail';
import { PlaylistGrid } from './PlaylistGrid';
import { usePlaylists } from './usePlaylists';

export function Playlists({ onPlayPlaylist }) {
    const { playTrack, addToQueueNext, addToQueueEnd } = usePlayer();
    const playlistState = usePlaylists();

    const handlePlayPlaylist = async () => {
        if (!playlistState.selectedPlaylist?.songs?.length) return;
        const firstSong = playlistState.selectedPlaylist.songs[0];
        playTrack(firstSong, playlistState.selectedPlaylist.songs);
    };

    return (
        <>
            <PlaylistCreator
                isOpen={playlistState.isCreateModalOpen}
                onClose={() => {
                    playlistState.setIsCreateModalOpen(false);
                    playlistState.setCreatorMode('menu');
                }}
                onCreate={playlistState.handlePlaylistCreated}
                initialMode={playlistState.creatorMode}
            />

            <ConfirmationModal
                isOpen={playlistState.deleteModal.isOpen}
                onClose={() => playlistState.setDeleteModal({ isOpen: false, playlistId: null })}
                onConfirm={playlistState.confirmDelete}
                title="Delete Playlist"
                message="Are you sure you want to delete this playlist? This action cannot be undone."
                isDangerous
            />

            <AnimatePresence mode="wait">
                {playlistState.selectedPlaylist ? (
                    <PlaylistDetail
                        selectedPlaylist={playlistState.selectedPlaylist}
                        activeTab={playlistState.activeTab}
                        setActiveTab={playlistState.setActiveTab}
                        isEditModalOpen={playlistState.isEditModalOpen}
                        setIsEditModalOpen={playlistState.setIsEditModalOpen}
                        onBack={() => playlistState.setSelectedPlaylist(null)}
                        onPlayPlaylist={onPlayPlaylist || handlePlayPlaylist}
                        playTrack={playTrack}
                        addToQueueNext={addToQueueNext}
                        addToQueueEnd={addToQueueEnd}
                        handleRemoveSong={playlistState.handleRemoveSong}
                        handleDragEnd={playlistState.handleDragEnd}
                        stats={playlistState.stats}
                        statsLoading={playlistState.statsLoading}
                        onPlaylistUpdate={playlistState.handlePlaylistUpdate}
                        refreshPlaylistDetails={playlistState.fetchPlaylistDetails}
                    />
                ) : (
                    <PlaylistGrid
                        loading={playlistState.loading}
                        playlists={playlistState.playlists}
                        onCreate={() => playlistState.setIsCreateModalOpen(true)}
                        onOpen={playlistState.fetchPlaylistDetails}
                        initiateDelete={playlistState.initiateDelete}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

export default Playlists;
