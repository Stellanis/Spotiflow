import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = '/api';

export function useDownloads() {
    const [downloadedTracks, setDownloadedTracks] = useState([]);
    const [loadingDownloads, setLoadingDownloads] = useState(false);
    const [downloading, setDownloading] = useState({});

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalPages, setTotalPages] = useState(1);

    // Filters state (managed here as they affect downloads fetching)
    const [artistFilter, setArtistFilter] = useState('');
    const [albumFilter, setAlbumFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    const fetchDownloads = useCallback(async (view, signal) => {
        setLoadingDownloads(true);
        try {
            const params = {
                page: currentPage,
                limit: itemsPerPage
            };

            if (view === 'library') {
                params.status = 'completed';
                if (artistFilter) params.artist = artistFilter;
                if (albumFilter) params.album = albumFilter;
            } else if (view === 'undownloaded') {
                params.status = 'pending';
            }

            if (debouncedSearchQuery) {
                params.search = debouncedSearchQuery;
            }

            const response = await axios.get(`${API_URL}/downloads`, { params, signal });

            if (currentPage === 1) {
                setDownloadedTracks(response.data.items);
            } else {
                setDownloadedTracks(prev => [...prev, ...response.data.items]);
            }

            setTotalPages(response.data.total_pages);
        } catch (error) {
            if (axios.isCancel(error)) return;
            console.error("Error fetching downloads:", error);
            toast.error("Failed to fetch library");
        } finally {
            if (!signal?.aborted) setLoadingDownloads(false);
        }
    }, [currentPage, itemsPerPage, artistFilter, albumFilter, debouncedSearchQuery]);

    const handleDownload = useCallback(async (track, view) => {
        const query = `${track.artist} - ${track.title}`;
        setDownloading(prev => ({ ...prev, [query]: 'loading' }));
        try {
            await axios.post(`${API_URL}/download`, {
                query,
                artist: track.artist,
                title: track.title,
                album: track.album,
                image: track.image || track.image_url
            });
            setDownloading(prev => ({ ...prev, [query]: 'success' }));
            toast.success(`Downloading "${track.title}"`);

            // If in library/undownloaded, update local state
            if (view === 'library' || view === 'undownloaded') {
                setDownloadedTracks(prev => prev.map(t => {
                    if (t.artist === track.artist && t.title === track.title) {
                        return { ...t, status: 'completed' };
                    }
                    return t;
                }));
            }
        } catch (error) {
            console.error("Error downloading:", error);
            setDownloading(prev => ({ ...prev, [query]: 'error' }));
            const errorMessage = error.response?.data?.detail || error.message || "Unknown error";
            toast.error(`Failed to download "${track.title}": ${errorMessage}`);
        }
    }, []);

    const handleDownloadAll = useCallback(async () => {
        if (!confirm("Are you sure you want to download all pending tracks?")) return;

        // Optimistic loading state using generic query keys from current list
        const newDownloadingState = {};
        downloadedTracks.forEach(track => {
            const query = `${track.artist} - ${track.title}`;
            newDownloadingState[query] = 'loading';
        });
        setDownloading(prev => ({ ...prev, ...newDownloadingState }));

        try {
            const response = await axios.post(`${API_URL}/download/all`);
            toast.success(`Started downloading ${response.data.count} tracks`);
            // Refresh will be triggered by caller or effect
        } catch (error) {
            console.error("Error downloading all:", error);
            toast.error("Failed to start bulk download");
            // Revert loading state
            setDownloading(prev => {
                const next = { ...prev };
                downloadedTracks.forEach(track => {
                    const query = `${track.artist} - ${track.title}`;
                    delete next[query];
                });
                return next;
            });
        }
    }, [downloadedTracks]);

    return {
        downloadedTracks,
        setDownloadedTracks, // Exposed for clear on view change
        loadingDownloads,
        downloading,
        setDownloading,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
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
        handleDownload,
        handleDownloadAll
    };
}
