import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Search, Loader2, Music, Info, Plus, Heart, Play, Sparkles } from 'lucide-react';
import { useDownloads } from '../hooks/useDownloads';
import { useLibrary } from '../hooks/useLibrary';
import { usePlayer } from '../contexts/PlayerContext';
import { GlassCard } from '../components/GlassCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { FilterDropdown } from '../components/FilterDropdown';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { TrackStatsModal } from '../components/TrackStatsModal';
import { cn } from '../utils';

export default function Library() {
    const { username } = useOutletContext();
    const { playTrack } = usePlayer();

    // Local Modals State
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [playlistTrackToAdd, setPlaylistTrackToAdd] = useState(null);

    // Hooks
    const {
        downloadedTracks,
        loadingDownloads,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        totalPages,
        artistFilter,
        setArtistFilter,
        albumFilter,
        setAlbumFilter,
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        setDebouncedSearchQuery,
        fetchDownloads,
    } = useDownloads();

    const {
        favoriteArtists,
        fetchFavorites,
        fetchFilters,
        filterOptions,
        toggleFavoriteArtist
    } = useLibrary(username);

    // Initial Fetch
    useEffect(() => {
        if (!downloadedTracks.length) {
            fetchDownloads('library');
        }
        fetchFavorites();
        fetchFilters();
    }, []); // Run once on mount

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            if (searchQuery !== debouncedSearchQuery) {
                setCurrentPage(1);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, setCurrentPage, debouncedSearchQuery, setDebouncedSearchQuery]);

    // Refetch on filter change
    useEffect(() => {
        const controller = new AbortController();
        fetchDownloads('library', controller.signal);

        if (artistFilter) { // Update album filters when artist changes
            fetchFilters(artistFilter);
        }

        // Prefetch first 5 artists on page load/change
        if (downloadedTracks.length > 0) {
            const uniqueArtists = [...new Set(downloadedTracks.map(t => t.artist))].slice(0, 5);
            uniqueArtists.forEach(artist => {
                axios.get(`${API_URL}/stats/artist-deep-dive/${username}?artist=${encodeURIComponent(artist)}`)
                    .catch(() => { });
            });
        }

        return () => controller.abort();
    }, [currentPage, debouncedSearchQuery, artistFilter, albumFilter, fetchDownloads]);
    const API_URL = '/api';

    // Infinite Scroll
    const observer = useRef();
    const lastTrackElementRef = useCallback(node => {
        if (loadingDownloads) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && currentPage < totalPages) {
                setCurrentPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingDownloads, totalPages, currentPage, setCurrentPage]);

    return (
        <div className="space-y-4">
            <TrackStatsModal
                isOpen={!!selectedTrack}
                onClose={() => setSelectedTrack(null)}
                track={selectedTrack}
                username={username}
            />
            <AddToPlaylistModal
                isOpen={!!playlistTrackToAdd}
                onClose={() => setPlaylistTrackToAdd(null)}
                track={playlistTrackToAdd}
            />

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-spotify-green" />
                    Downloaded Library
                </h2>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spotify-grey" />
                    <input
                        type="text"
                        placeholder="Search library..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-white placeholder:text-spotify-grey focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors"
                    />
                </div>
                <div className="flex gap-2 text-white">
                    <FilterDropdown
                        value={artistFilter}
                        options={filterOptions.artists}
                        onChange={(val) => { setArtistFilter(val); setAlbumFilter(''); }}
                        placeholder="All Artists"
                    />
                    <FilterDropdown
                        value={albumFilter}
                        options={filterOptions.albums}
                        onChange={setAlbumFilter}
                        placeholder="All Albums"
                    />
                </div>
            </div>

            {/* Grid */}
            {loadingDownloads && downloadedTracks.length === 0 ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {Array.from({ length: itemsPerPage }).map((_, i) => (
                        <SkeletonCard key={i} type="vertical" />
                    ))}
                </div>
            ) : (
                <div className="relative min-h-[200px]">
                    {loadingDownloads && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm rounded-xl transition-all duration-300">
                            <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
                        </div>
                    )}

                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {downloadedTracks.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-spotify-grey">
                                <Music className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-xl font-semibold">Your library is empty</p>
                            </div>
                        ) : (
                            downloadedTracks.map((track, index) => (
                                <motion.div
                                    key={`${track.artist}-${track.title}-${index}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.02 }}
                                >
                                    <GlassCard
                                        className="p-4 flex flex-col gap-3 aspect-square justify-between hover:bg-white/10 relative group overflow-hidden cursor-pointer"
                                        ref={index === downloadedTracks.length - 1 ? lastTrackElementRef : null}
                                        onClick={() => playTrack(track, downloadedTracks)} // Pass context for queue?
                                    >
                                        <div className="w-full aspect-square rounded-md overflow-hidden bg-spotify-dark relative shadow-lg group-hover:shadow-xl transition-all">
                                            {track.image_url ? (
                                                <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 p-2 text-center">
                                                    <span className="font-bold text-white text-sm line-clamp-2">{track.title}</span>
                                                    <span className="text-xs text-spotify-grey line-clamp-1 mt-1">{track.artist}</span>
                                                </div>
                                            )}

                                            {/* Hover Play */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button className="p-3 bg-spotify-green rounded-full text-white shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                                                    <Play className="w-6 h-6 fill-current pl-1" />
                                                </button>
                                            </div>

                                            {/* Actions */}
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedTrack(track); }}
                                                    className="p-2 bg-black/50 hover:bg-white/20 rounded-full text-white backdrop-blur-sm"
                                                >
                                                    <Info className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPlaylistTrackToAdd(track); }}
                                                    className="p-2 bg-black/50 hover:bg-spotify-green rounded-full text-white backdrop-blur-sm"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="w-full text-left">
                                            <h3 className="font-semibold truncate w-full text-sm text-white">{track.title}</h3>
                                            <div className="flex items-center justify-between w-full">
                                                <div
                                                    className="text-spotify-grey truncate text-xs flex-1 hover:text-white hover:underline transition-all cursor-pointer flex items-center gap-1 group/artist"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.dispatchEvent(new CustomEvent('open-artist-deep-dive', { detail: track.artist }));
                                                    }}
                                                >
                                                    <span className="truncate">{track.artist}</span>
                                                    <Sparkles className="w-2.5 h-2.5 opacity-0 group-hover/artist:opacity-100 transition-opacity text-spotify-green flex-shrink-0" />
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleFavoriteArtist(track.artist, e); }}
                                                    className="hover:scale-110 transition-transform p-1 -mr-1"
                                                >
                                                    <Heart className={cn("w-4 h-4", favoriteArtists.has(track.artist) ? "fill-spotify-green text-spotify-green" : "text-spotify-grey hover:text-white")} />
                                                </button>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {loadingDownloads && downloadedTracks.length > 0 && (
                        <div className="py-4 flex justify-center w-full">
                            <Loader2 className="w-6 h-6 animate-spin text-spotify-green" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
