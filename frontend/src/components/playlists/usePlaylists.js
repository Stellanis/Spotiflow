import { useEffect, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'react-hot-toast';

export function usePlaylists() {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creatorMode, setCreatorMode] = useState('menu');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, playlistId: null });
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('songs');

    async function fetchPlaylists() {
        setLoading(true);
        try {
            const response = await fetch('/api/playlists');
            if (!response.ok) {
                throw new Error('Failed to fetch');
            }
            setPlaylists(await response.json());
        } catch (error) {
            console.error('Error fetching playlists:', error);
            toast.error('Failed to load playlists');
        } finally {
            setLoading(false);
        }
    }

    async function fetchPlaylistDetails(id) {
        setLoading(true);
        try {
            const response = await fetch(`/api/playlists/${id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch details');
            }
            setSelectedPlaylist(await response.json());
        } catch (error) {
            console.error('Error fetching playlist details:', error);
            toast.error('Failed to load playlist details');
        } finally {
            setLoading(false);
        }
    }

    async function fetchStats(id) {
        setStatsLoading(true);
        try {
            const response = await fetch(`/api/playlists/${id}/stats`);
            if (response.ok) {
                setStats(await response.json());
            }
        } catch (error) {
            console.error('Failed to load stats', error);
        } finally {
            setStatsLoading(false);
        }
    }

    useEffect(() => {
        fetchPlaylists();

        const handleOpenVibe = () => {
            setCreatorMode('vibe');
            setIsCreateModalOpen(true);
        };

        window.addEventListener('open-vibe-generator', handleOpenVibe);
        return () => window.removeEventListener('open-vibe-generator', handleOpenVibe);
    }, []);

    useEffect(() => {
        if (selectedPlaylist && activeTab === 'insights') {
            fetchStats(selectedPlaylist.id);
        }
    }, [selectedPlaylist, activeTab]);

    function initiateDelete(id, event) {
        event.preventDefault();
        event.stopPropagation();
        setDeleteModal({ isOpen: true, playlistId: id });
    }

    async function confirmDelete() {
        const id = deleteModal.playlistId;
        if (!id) return;
        try {
            const response = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setPlaylists(playlists.filter((playlist) => playlist.id !== id));
                if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
                toast.success('Playlist deleted');
            }
        } catch (error) {
            toast.error('Failed to delete playlist');
        }
    }

    async function handleRemoveSong(songQuery) {
        try {
            const response = await fetch(`/api/playlists/${selectedPlaylist.id}/songs/${encodeURIComponent(songQuery)}`, { method: 'DELETE' });
            if (response.ok) {
                setSelectedPlaylist((prev) => ({
                    ...prev,
                    songs: prev.songs.filter((song) => song.query !== songQuery),
                    song_count: prev.song_count - 1,
                }));
                toast.success('Song removed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to remove song');
        }
    }

    async function handleDragEnd(event) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setSelectedPlaylist((prev) => {
            const oldIndex = prev.songs.findIndex((item) => item.query === active.id);
            const newIndex = prev.songs.findIndex((item) => item.query === over.id);

            const newSongs = arrayMove(prev.songs, oldIndex, newIndex);
            const updatedSongs = newSongs.map((song, index) => ({ ...song, position: index }));
            const reorderItems = updatedSongs.map((song, index) => ({
                song_query: song.query,
                new_position: index,
            }));

            fetch(`/api/playlists/${prev.id}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reorderItems),
            }).catch((error) => {
                console.error('Failed to reorder playlist', error);
                toast.error('Failed to save order');
            });

            return {
                ...prev,
                songs: updatedSongs,
            };
        });
    }

    function handlePlaylistUpdate(updatedPlaylist) {
        setSelectedPlaylist(updatedPlaylist);
        setPlaylists((prev) => prev.map((playlist) => (
            playlist.id === updatedPlaylist.id
                ? { ...playlist, name: updatedPlaylist.name, song_count: updatedPlaylist.songs.length }
                : playlist
        )));
    }

    function handlePlaylistCreated(newPlaylist) {
        setPlaylists((prev) => [newPlaylist, ...prev]);
    }

    return {
        playlists,
        loading,
        selectedPlaylist,
        setSelectedPlaylist,
        isEditModalOpen,
        setIsEditModalOpen,
        isCreateModalOpen,
        setIsCreateModalOpen,
        creatorMode,
        setCreatorMode,
        deleteModal,
        setDeleteModal,
        stats,
        statsLoading,
        activeTab,
        setActiveTab,
        fetchPlaylistDetails,
        initiateDelete,
        confirmDelete,
        handleRemoveSong,
        handleDragEnd,
        handlePlaylistUpdate,
        handlePlaylistCreated,
    };
}
