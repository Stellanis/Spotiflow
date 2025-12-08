import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket, ExternalLink, Loader2, Music, Search, Star } from 'lucide-react';

// Define Country Sets
const EUROPE_COUNTRIES = new Set([
    'GB', 'FR', 'DE', 'ES', 'IT', 'CH', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'AT', 'PL', 'CZ', 'HU', 'GR', 'TR', 'RU', 'UA', 'RO', 'BG', 'HR', 'SI', 'SK', 'EE', 'LV', 'LT', 'IS'
]);

const AMERICAS_COUNTRIES = new Set([
    'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'BO', 'EC'
]);

export default function Concerts() {
    const [allConcerts, setAllConcerts] = useState([]);
    const [topArtists, setTopArtists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterTopOnly, setFilterTopOnly] = useState(false);
    const [filterContinent, setFilterContinent] = useState('ALL'); // ALL, EU, AM

    useEffect(() => {
        fetchAllConcerts();
        fetchTopArtists();
    }, []);

    const fetchAllConcerts = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all cached concerts (full repository)
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

    // Client-side filtering
    const filteredConcerts = useMemo(() => {
        let result = allConcerts;

        // 1. Filter by Continent
        if (filterContinent !== 'ALL') {
            result = result.filter(concert => {
                const code = concert.country; // This might be "US", "GB", etc. or undefined if waiting for sync
                if (!code) return false; // Hide if no country data

                if (filterContinent === 'EU') {
                    return EUROPE_COUNTRIES.has(code);
                } else if (filterContinent === 'AM') {
                    return AMERICAS_COUNTRIES.has(code);
                }
                return true;
            });
        }

        // 2. Filter by Top Artists if enabled
        if (filterTopOnly && topArtists.length > 0) {
            const topSet = new Set(topArtists.map(a => a.toLowerCase()));
            result = result.filter(concert => {
                // Check if concert artist is in top artists (fuzzy or exact?)
                // API returns exact names from DB. Concert artist should match.
                return topSet.has(concert.artist.toLowerCase());
            });
        }

        // 2. Filter by Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(concert =>
                concert.city?.toLowerCase().includes(lowerTerm) ||
                concert.artist?.toLowerCase().includes(lowerTerm) ||
                concert.venue?.toLowerCase().includes(lowerTerm)
            );
        }

        return result;
    }, [allConcerts, searchTerm, filterTopOnly, topArtists, filterContinent]);

    const formatDate = (dateString) => {
        if (!dateString) return 'TBA';
        return new Date(dateString).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading && allConcerts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                <p className="text-spotify-grey">Loading concerts from library...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
                    <Music className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-white">Oops!</h2>
                <p className="text-spotify-grey max-w-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 pb-24">
            <div className="flex flex-col space-y-4">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Concerts Repository</h1>
                    <p className="text-spotify-grey">Global tour dates for your library (Synced Daily at 3 AM)</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 bg-white/5 p-4 rounded-xl border border-white/10 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spotify-grey" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter by City, Artist, or Venue..."
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* Continent Toggles */}
                        <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setFilterContinent('ALL')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterContinent === 'ALL' ? 'bg-white/10 text-white' : 'text-spotify-grey hover:text-white'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilterContinent('EU')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterContinent === 'EU' ? 'bg-white/10 text-white' : 'text-spotify-grey hover:text-white'
                                    }`}
                            >
                                Europe
                            </button>
                            <button
                                onClick={() => setFilterContinent('AM')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterContinent === 'AM' ? 'bg-white/10 text-white' : 'text-spotify-grey hover:text-white'
                                    }`}
                            >
                                Americas
                            </button>
                        </div>

                        <button
                            onClick={() => setFilterTopOnly(!filterTopOnly)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${filterTopOnly
                                ? 'bg-spotify-green text-black border-spotify-green font-bold'
                                : 'bg-white/5 text-spotify-grey border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <Star className={`w-4 h-4 ${filterTopOnly ? 'fill-black' : ''}`} />
                            <span>Top 50 Only</span>
                        </button>

                        <div className="text-sm text-spotify-grey whitespace-nowrap min-w-[100px] text-right">
                            {filteredConcerts.length} events
                        </div>
                    </div>
                </div>
            </div>

            {filteredConcerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                        <MapPin className="w-8 h-8 text-spotify-grey" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Concerts Found</h3>
                    <p className="text-spotify-grey">
                        {searchTerm || filterTopOnly || filterContinent !== 'ALL' ? "No matches for your filter." : "Your library has no upcoming concerts."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredConcerts.map((concert) => (
                        <motion.div
                            key={concert.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group bg-spotify-light-grey rounded-xl overflow-hidden hover:bg-white/10 transition-colors border border-white/5 hover:border-white/20 flex flex-col"
                        >
                            <div className="relative aspect-video bg-black/40">
                                {concert.image_url ? (
                                    <img
                                        src={concert.image_url}
                                        alt={concert.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify-dark to-spotify-light-grey">
                                        <Ticket className="w-12 h-12 text-white/20" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-medium border border-white/10">
                                    {concert.source}
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col space-y-3">
                                <div>
                                    <h3 className="font-bold text-white text-lg leading-tight line-clamp-1 group-hover:text-spotify-green transition-colors">
                                        {concert.artist}
                                    </h3>
                                    <p className="text-spotify-grey text-sm line-clamp-1">{concert.title}</p>
                                </div>

                                <div className="space-y-2 text-sm text-spotify-grey flex-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 shrink-0" />
                                        <span>{formatDate(concert.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 shrink-0" />
                                        <span className="line-clamp-1">
                                            {concert.venue}, {concert.city}
                                        </span>
                                    </div>
                                </div>

                                <a
                                    href={concert.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 flex items-center justify-center gap-2 bg-white text-black font-bold py-2 px-4 rounded-full hover:scale-105 transition-transform w-full"
                                >
                                    <span>Get Tickets</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
