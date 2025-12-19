import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = '/api';

export function useLibrary(username) {
    const [scrobbles, setScrobbles] = useState([]);
    const [loadingScrobbles, setLoadingScrobbles] = useState(false);
    const [favoriteArtists, setFavoriteArtists] = useState(new Set());
    const [filterOptions, setFilterOptions] = useState({ artists: [], albums: [] });
    const [isSyncing, setIsSyncing] = useState(false);

    // Fetch Favorites
    const fetchFavorites = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/concerts/favorites`);
            setFavoriteArtists(new Set(response.data));
        } catch (err) {
            console.error("Error fetching favorites:", err);
        }
    }, []);

    // Fetch Scrobbles
    const fetchScrobbles = useCallback(async (signal, userOverride) => {
        const userToFetch = userOverride || username;
        if (!userToFetch) return;
        setLoadingScrobbles(true);
        try {
            const response = await axios.get(`${API_URL}/scrobbles/${userToFetch}`, { signal });
            setScrobbles(response.data);
        } catch (error) {
            if (axios.isCancel(error)) return;
            console.error("Error fetching scrobbles:", error);
        } finally {
            if (!signal?.aborted) setLoadingScrobbles(false);
        }
    }, [username]);

    // Fetch Filters
    const fetchFilters = useCallback(async (artistFilter) => {
        try {
            const params = {};
            if (artistFilter) params.artist = artistFilter;
            const response = await axios.get(`${API_URL}/filters`, { params });
            setFilterOptions({
                artists: response.data.artists,
                albums: response.data.albums
            });
        } catch (error) {
            console.error("Error fetching filters:", error);
        }
    }, []);

    // Toggle Favorite
    const toggleFavoriteArtist = useCallback(async (artist, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            const response = await axios.post(`${API_URL}/concerts/favorites`, { artist });
            if (response.data.status === 'added') {
                setFavoriteArtists(prev => new Set([...prev, artist]));
            } else {
                setFavoriteArtists(prev => {
                    const next = new Set(prev);
                    next.delete(artist);
                    return next;
                });
            }
            toast.success(response.data.status === 'added' ? `Added ${artist} to favorites` : `Removed ${artist} from favorites`);
        } catch (err) {
            console.error("Error toggling favorite:", err);
            toast.error("Failed to update favorites");
        }
    }, []);

    // Sync
    const handleSync = useCallback(async (refreshCallback) => {
        setIsSyncing(true);
        try {
            await axios.post(`${API_URL}/sync`);
            toast.success("Sync started");
            // Wait a bit to allow backend to process some items, then refresh view
            setTimeout(() => {
                if (refreshCallback) refreshCallback();
            }, 2000);
        } catch (error) {
            console.error("Error syncing:", error);
            toast.error("Failed to start sync");
        } finally {
            setTimeout(() => setIsSyncing(false), 1000);
        }
    }, []);

    return {
        scrobbles,
        setScrobbles, // Exposed if needed for direct updates
        loadingScrobbles,
        favoriteArtists,
        filterOptions,
        isSyncing,
        fetchScrobbles,
        fetchFavorites,
        fetchFilters,
        toggleFavoriteArtist,
        handleSync
    };
}
