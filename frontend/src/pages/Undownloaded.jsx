import { useEffect, useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Search, Loader2, Music, CheckCircle, Info, Plus } from 'lucide-react';
import { useDownloads } from '../hooks/useDownloads';
import { usePlayer } from '../contexts/PlayerContext';
import { GlassCard } from '../components/GlassCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { TrackStatsModal } from '../components/TrackStatsModal';
import { cn } from '../utils';

export default function Undownloaded() {
    const { username } = useOutletContext();
    const { playTrack } = usePlayer();

    // Local State
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [playlistTrackToAdd, setPlaylistTrackToAdd] = useState(null);

    // Hooks
    const {
        downloadedTracks,
        loadingDownloads,
        downloading,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        totalPages,
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        setDebouncedSearchQuery,
        fetchDownloads,
        handleDownload,
        handleDownloadAll
    } = useDownloads();

    // Initial Fetch
    useEffect(() => {
        fetchDownloads('undownloaded');
    }, []);

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

    // Refetch logic
    useEffect(() => {
        const controller = new AbortController();
        fetchDownloads('undownloaded', controller.signal);
        return () => controller.abort();
    }, [currentPage, debouncedSearchQuery, fetchDownloads]);

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

    const onDownloadAll = async () => {
        await handleDownloadAll();
        // Give time for backend to queue?
        setTimeout(() => fetchDownloads('undownloaded'), 1000);
    };

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
                    <Download className="w-5 h-5 text-spotify-green" />
                    Pending Downloads
                </h2>

                {downloadedTracks.length > 0 && (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={onDownloadAll}
                        className="flex items-center gap-2 px-4 py-2 bg-spotify-green text-white rounded-full text-sm font-medium hover:scale-105 transition-transform shadow-lg"
                    >
                        <Download className="w-4 h-4" />
                        Download All
                    </motion.button>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spotify-grey" />
                <input
                    type="text"
                    placeholder="Search pending downloads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-white placeholder:text-spotify-grey focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors"
                />
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
                                <p className="text-xl font-semibold">No pending downloads</p>
                                <p className="text-sm mt-2">Disable auto-download to see pending items here.</p>
                            </div>
                        ) : (
                            downloadedTracks.map((track, index) => {
                                const query = `${track.artist} - ${track.title}`;
                                const status = track.status === 'completed' ? 'success' : downloading[query];
                                const isQueued = status === 'loading' || status === 'success';

                                return (
                                    <motion.div
                                        key={`${track.artist}-${track.title}-${index}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <GlassCard
                                            className="p-4 flex flex-col gap-3 aspect-square justify-between hover:bg-white/10 relative group overflow-hidden cursor-pointer"
                                            ref={index === downloadedTracks.length - 1 ? lastTrackElementRef : null}
                                            onClick={() => {
                                                // If downloaded play, else modal info? 
                                                // Undownloaded view items are mostly NOT downloaded, but might become so dynamically
                                                if (track.status === 'completed') playTrack(track);
                                                else setSelectedTrack(track);
                                            }}
                                            image={track.image_url}
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

                                                {/* Download Overlay */}
                                                <div className={cn(
                                                    "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center",
                                                    isQueued ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}>
                                                    {status === 'success' ? (
                                                        <CheckCircle className="w-8 h-8 text-spotify-green" />
                                                    ) : status === 'loading' ? (
                                                        <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
                                                    ) : (
                                                        <motion.button
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownload(track, 'undownloaded');
                                                            }}
                                                            className="p-3 bg-spotify-green rounded-full text-white shadow-lg shadow-black/40"
                                                        >
                                                            <Download className="w-6 h-6" />
                                                        </motion.button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="w-full text-left">
                                                <h3 className="font-semibold truncate w-full text-sm text-white">{track.title}</h3>
                                                <div className="flex items-center justify-between w-full">
                                                    <p className="text-spotify-grey truncate text-xs flex-1">{track.artist}</p>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    </motion.div>
                                );
                            })
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
