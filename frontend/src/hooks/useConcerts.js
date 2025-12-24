import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { EUROPE_COUNTRIES, AMERICAS_COUNTRIES } from '../utils/constants';

export function useConcerts() {
    const [allConcerts, setAllConcerts] = useState([]);
    const [topArtists, setTopArtists] = useState([]);
    const [reminders, setReminders] = useState(new Set());

    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterTopOnly, setFilterTopOnly] = useState(false);
    const [filterRemindersOnly, setFilterRemindersOnly] = useState(false);
    const [filterContinent, setFilterContinent] = useState('ALL'); // ALL, EU, AM

    useEffect(() => {
        fetchAllConcerts();
        fetchTopArtists();
        fetchReminders();
    }, []);

    const fetchAllConcerts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('/api/concerts');
            setAllConcerts(response.data);
        } catch (err) {
            console.error("Error fetching concerts:", err);
            setError("Failed to load concerts.");
        } finally {
            setLoading(false);
        }
    };

    const fetchTopArtists = async () => {
        try {
            const response = await axios.get('/api/concerts/top-artists');
            setTopArtists(response.data);
        } catch (err) {
            console.error("Error fetching top artists:", err);
        }
    };

    const fetchReminders = async () => {
        try {
            const response = await axios.get('/api/concerts/reminders');
            setReminders(new Set(response.data));
        } catch (err) {
            console.error("Error fetching reminders:", err);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            await axios.post('/api/concerts/sync');
            setTimeout(() => {
                fetchAllConcerts();
                setSyncing(false);
            }, 3000);
        } catch (err) {
            console.error("Sync error:", err);
            setSyncing(false);
        }
    };

    const toggleReminder = async (concertId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            const response = await axios.post('/api/concerts/reminders', { concert_id: concertId });
            if (response.data.status === 'added') {
                setReminders(prev => new Set([...prev, concertId]));
            } else {
                setReminders(prev => {
                    const next = new Set(prev);
                    next.delete(concertId);
                    return next;
                });
            }
        } catch (err) {
            console.error("Error toggling reminder:", err);
        }
    };

    // Filtering Logic
    const filteredConcerts = useMemo(() => {
        let result = allConcerts;

        // 1. Filter by Continent
        if (filterContinent !== 'ALL') {
            result = result.filter(concert => {
                const code = concert.country;
                if (!code) return false;
                if (filterContinent === 'EU') return EUROPE_COUNTRIES.has(code);
                else if (filterContinent === 'AM') return AMERICAS_COUNTRIES.has(code);
                return true;
            });
        }

        // 2. Filter by Top Artists
        if (filterTopOnly && topArtists.length > 0) {
            const topSet = new Set(topArtists.map(a => a.toLowerCase()));
            result = result.filter(concert => topSet.has(concert.artist.toLowerCase()));
        }

        // 3. Filter by Reminders
        if (filterRemindersOnly) {
            result = result.filter(concert => reminders.has(concert.id));
        }

        // 4. Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(concert =>
                concert.city?.toLowerCase().includes(lowerTerm) ||
                concert.artist?.toLowerCase().includes(lowerTerm) ||
                concert.venue?.toLowerCase().includes(lowerTerm)
            );
        }

        return result;
    }, [allConcerts, searchTerm, filterTopOnly, topArtists, filterContinent, filterRemindersOnly, reminders]);

    const mapConcerts = useMemo(() => {
        return filteredConcerts.filter(c => c.lat && c.lng);
    }, [filteredConcerts]);

    return {
        allConcerts,
        filteredConcerts,
        mapConcerts,
        reminders,
        loading,
        syncing,
        error,
        searchTerm,
        setSearchTerm,
        filterTopOnly,
        setFilterTopOnly,
        filterRemindersOnly,
        setFilterRemindersOnly,
        filterContinent,
        setFilterContinent,
        handleSync,
        toggleReminder
    };
}
