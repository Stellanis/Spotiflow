import { useState } from 'react';
import { Loader2, Music, Search, Star, RefreshCw, Heart, Map as MapIcon, List } from 'lucide-react';
import { useConcerts } from '../hooks/useConcerts';
import { ConcertMap } from '../components/ConcertMap';
import { ConcertList } from '../components/ConcertList';

export default function Concerts() {
    const {
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
        toggleReminder,
        allConcerts
    } = useConcerts();

    const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'

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
        <div className="p-3 md:p-8 space-y-6 pb-24 h-full flex flex-col">
            <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex flex-wrap items-center gap-2 md:gap-3">
                            Concerts Repository
                            <span className="text-xs font-normal bg-white/10 px-2 py-0.5 rounded-full text-spotify-grey whitespace-nowrap">
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
                <ConcertList
                    concerts={filteredConcerts}
                    reminders={reminders}
                    onToggleReminder={toggleReminder}
                />
            ) : (
                <ConcertMap
                    concerts={mapConcerts}
                    reminders={reminders}
                    onToggleReminder={toggleReminder}
                />
            )}
        </div>
    );
}
