import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket, ExternalLink, Loader2, Music, Search, Star, RefreshCw, Heart, Map as MapIcon, List } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Vite/Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Define Country Sets
const EUROPE_COUNTRIES = new Set([
    'GB', 'FR', 'DE', 'ES', 'IT', 'CH', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'AT', 'PL', 'CZ', 'HU', 'GR', 'TR', 'RU', 'UA', 'RO', 'BG', 'HR', 'SI', 'SK', 'EE', 'LV', 'LT', 'IS'
]);

const AMERICAS_COUNTRIES = new Set([
    'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'BO', 'EC'
]);

function MapUpdater({ concerts }) {
    const map = useMap();
    useEffect(() => {
        if (concerts.length > 0) {
            const bounds = L.latLngBounds(concerts.map(c => [c.lat, c.lng]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        }
    }, [concerts, map]);
    return null;
}

export default function Concerts() {
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

    const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'

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
            // Filter out concerts without valid dates if needed, but repo should enable keeping them.
            // For map, we need coords.
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

    // Client-side filtering
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

    // Map Data: items with lat/lng
    const mapConcerts = useMemo(() => {
        return filteredConcerts.filter(c => c.lat && c.lng);
    }, [filteredConcerts]);

    const formatDate = (dateString) => {
        if (!dateString) return 'TBA';
        return new Date(dateString).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
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
                <Music className="w-16 h-16 text-red-500/50" />
                <h2 className="text-xl font-bold text-white">Oops!</h2>
                <p className="text-spotify-grey max-w-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 pb-24 h-full flex flex-col">
            <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            Concerts Repository
                            <span className="text-xs font-normal bg-white/10 px-2 py-0.5 rounded-full text-spotify-grey">
                                {filteredConcerts.length} events
                            </span>
                        </h1>
                        <p className="text-spotify-grey mt-1">Global tour dates from Ticketmaster & Bandsintown</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggle */}
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-spotify-green text-black shadow-lg' : 'text-spotify-grey hover:text-white'}`}
                                title="List View"
                            >
                                <List className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'map' ? 'bg-spotify-green text-black shadow-lg' : 'text-spotify-grey hover:text-white'}`}
                                title="Map View"
                            >
                                <MapIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2 bg-spotify-green/10 text-spotify-green hover:bg-spotify-green/20 rounded-full transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            <span className="font-bold text-sm hidden md:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
                        </button>
                    </div>
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
                        <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                            {['ALL', 'EU', 'AM'].map(region => (
                                <button
                                    key={region}
                                    onClick={() => setFilterContinent(region)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterContinent === region ? 'bg-white/10 text-white' : 'text-spotify-grey hover:text-white'}`}
                                >
                                    {region === 'ALL' ? 'All' : region === 'EU' ? 'Europe' : 'Americas'}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setFilterTopOnly(!filterTopOnly)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${filterTopOnly ? 'bg-spotify-green text-black border-spotify-green font-bold' : 'bg-white/5 text-spotify-grey border-white/10 hover:bg-white/10'}`}
                        >
                            <Star className={`w-4 h-4 ${filterTopOnly ? 'fill-black' : ''}`} />
                            <span className="hidden sm:inline">Top 50</span>
                        </button>

                        <button
                            onClick={() => setFilterRemindersOnly(!filterRemindersOnly)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${filterRemindersOnly ? 'bg-spotify-green text-black border-spotify-green font-bold' : 'bg-white/5 text-spotify-grey border-white/10 hover:bg-white/10'}`}
                        >
                            <Heart className={`w-4 h-4 ${filterRemindersOnly ? 'fill-black' : ''}`} />
                            <span className="hidden sm:inline">Reminders</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'list' ? (
                // LIST VIEW
                filteredConcerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                            <MapPin className="w-8 h-8 text-spotify-grey" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Concerts Found</h3>
                        <p className="text-spotify-grey">Try adjusting your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredConcerts.map((concert) => (
                            <motion.div
                                key={concert.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="group bg-spotify-light-grey rounded-xl overflow-hidden hover:bg-white/10 transition-colors border border-white/5 hover:border-white/20 flex flex-col"
                            >
                                <div className="relative aspect-video bg-black/40">
                                    {concert.image_url ? (
                                        <img src={concert.image_url} alt={concert.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                                        <h3 className="font-bold text-white text-lg leading-tight line-clamp-1 group-hover:text-spotify-green transition-colors flex items-center justify-between gap-2">
                                            <span className="truncate">{concert.artist}</span>
                                            <button
                                                onClick={(e) => toggleReminder(concert.id, e)}
                                                className="focus:outline-none hover:scale-110 transition-transform shrink-0"
                                            >
                                                <Heart className={`w-5 h-5 ${reminders.has(concert.id) ? 'fill-spotify-green text-spotify-green' : 'text-spotify-grey hover:text-white'}`} />
                                            </button>
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
                                            <span className="line-clamp-1">{concert.venue}, {concert.city}</span>
                                        </div>
                                    </div>

                                    <a href={concert.url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 bg-white text-black font-bold py-2 px-4 rounded-full hover:scale-105 transition-transform w-full text-sm">
                                        <span>Get Tickets</span>
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )
            ) : (
                // MAP VIEW
                <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-white/10 relative">
                    {mapConcerts.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-spotify-dark/90 z-10">
                            <p className="text-white">No dates with coordinates found in filter.</p>
                        </div>
                    ) : (
                        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                            <MapUpdater concerts={mapConcerts} />

                            {mapConcerts.map(concert => (
                                <Marker
                                    key={concert.id}
                                    position={[concert.lat, concert.lng]}
                                >
                                    <Popup className="text-black">
                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                            <h3 className="font-bold text-sm">{concert.artist}</h3>
                                            <p className="text-xs">{concert.title}</p>
                                            <p className="text-xs text-gray-500">{formatDate(concert.date)}</p>
                                            <p className="text-xs">{concert.venue}, {concert.city}</p>
                                            <a href={concert.url} target="_blank" className="text-xs text-blue-600 hover:underline">Get Tickets</a>
                                            <button
                                                onClick={(e) => toggleReminder(concert.id, e)}
                                                className={`text-xs flex items-center gap-1 ${reminders.has(concert.id) ? 'text-green-600' : 'text-gray-400'}`}
                                            >
                                                <Heart className={`w-3 h-3 ${reminders.has(concert.id) ? 'fill-current' : ''}`} />
                                                {reminders.has(concert.id) ? 'Reminder Set' : 'Remind Me'}
                                            </button>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    )}
                </div>
            )}
        </div>
    );
}
