import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRef, useCallback } from 'react';

import { cn } from './utils';
import { SettingsModal } from './SettingsModal';
import { TutorialModal } from './TutorialModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { Playlists } from './components/Playlists';
import { FilterDropdown } from './components/FilterDropdown';
import { Download, Music, Disc, Search, CheckCircle, Loader2, Settings, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Hourglass, Trophy, Plus, Play, Trash2, ArrowLeft, Info, Menu, X, Ticket, Heart } from 'lucide-react';
import { GlassCard } from './components/GlassCard';
import Jobs from './Jobs';
import Stats from './components/Stats';
import { TrackStatsModal } from './components/TrackStatsModal';
import { SkeletonCard } from './components/SkeletonCard';
import Concerts from './pages/Concerts';




import { Toaster, toast } from 'react-hot-toast';

import { PlayerProvider, usePlayer } from './contexts/PlayerContext';
import { PlayerBar } from './components/PlayerBar';

const API_URL = '/api';

function AppContent() {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();

  // Derive view from URL
  const view = location.pathname === '/' ? 'scrobbles' : location.pathname.slice(1);
  // Valid views for safety, though existing logic handles most cases
  // const [view, setView] = useState('scrobbles'); // REMOVED
  const [username, setUsername] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoDownload, setAutoDownload] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  const [hiddenFeatures, setHiddenFeatures] = useState(new Set());

  // Favorites State
  const [favoriteArtists, setFavoriteArtists] = useState(new Set());


  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Playlist State
  const [playlistTrackToAdd, setPlaylistTrackToAdd] = useState(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  useEffect(() => {
    // Fetch settings on mount to get the username
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/settings`);
        if (response.data.LASTFM_USER) {
          setUsername(response.data.LASTFM_USER);
        }
        setAutoDownload(response.data.AUTO_DOWNLOAD !== 'false');

        // Check if tutorial has been seen
        if (response.data.TUTORIAL_SEEN !== 'true') {
          setShowTutorial(true);
        }

        const hidden = response.data.HIDDEN_FEATURES ? response.data.HIDDEN_FEATURES.split(',') : [];
        setHiddenFeatures(new Set(hidden));
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await axios.get(`${API_URL}/concerts/favorites`);
      setFavoriteArtists(new Set(response.data));
    } catch (err) {
      console.error("Error fetching favorites:", err);
    }
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset search and pagination when view changes
  useEffect(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setCurrentPage(1);
    setDownloadedTracks([]); // Clear tracks to prevent showing stale data while loading
  }, [view]);

  // Fetch scrobbles whenever username changes (if not empty)
  useEffect(() => {
    const controller = new AbortController();
    if (username && view === 'scrobbles') {
      fetchScrobbles(controller.signal);
    }
    return () => controller.abort();
  }, [username]);

  const fetchScrobbles = async (signal, userOverride) => {
    const userToFetch = userOverride || username;
    if (!userToFetch) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/scrobbles/${userToFetch}`, { signal });
      setTracks(response.data);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Error fetching scrobbles:", error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Filters
  const [artistFilter, setArtistFilter] = useState('');
  const [albumFilter, setAlbumFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState({ artists: [], albums: [] });

  // Fetch filters when artist filter changes or on mount
  useEffect(() => {
    if (view === 'library') {
      const fetchFilters = async () => {
        try {
          const params = {};
          if (artistFilter) params.artist = artistFilter;
          const response = await axios.get(`${API_URL}/filters`, { params });
          setFilterOptions(prev => ({
            // artists: response.data.artists, // Always get full artist list? Or filtered? Let's use full list effectively but maybe backend logic needs tweak if we want to narrow down artists. For now, keeping full artist list is fine or maybe only filtered albums. 
            // Wait, if I select an Artist, I want to see their Albums.
            // If I select nothing, I see all Artists and all Albums.
            // Backend `get_filters` returns { artists: get_all_artists(), albums: get_all_albums(artist) }
            // So if artist is set, artists list is still FULL list (good for switching), but albums are filtered.
            artists: response.data.artists,
            albums: response.data.albums
          }));
        } catch (error) {
          console.error("Error fetching filters:", error);
        }
      };
      fetchFilters();
    }
  }, [view, artistFilter]);

  const fetchDownloads = async (signal) => {
    setLoading(true);
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
      if (!signal?.aborted) setLoading(false);
    }
  };

  const prefetchStats = async (userOverride) => {
    const user = userOverride || username;
    if (!user) return;

    const periods = ['overall', '1month']; // Prefetch most common periods

    try {
      const promises = [
        // Top Tracks for main periods
        ...periods.map(period => axios.get(`${API_URL}/stats/top-tracks/${user}`, { params: { period, limit: 50 } })),

        // Activity Chart
        axios.get(`${API_URL}/stats/chart`, { params: { user, period: '1month' } }),

        // Listening Clock
        axios.get(`${API_URL}/stats/listening-clock/${user}`, { params: { period: 'overall' } }),

        // Genre Breakdown
        axios.get(`${API_URL}/stats/genre-breakdown/${user}`, { params: { period: 'overall' } }),

        // On This Day
        axios.get(`${API_URL}/stats/on-this-day/${user}`),

        // Streak
        axios.get(`${API_URL}/stats/streak/${user}`),

        // Diversity
        axios.get(`${API_URL}/stats/diversity/${user}`, { params: { period: 'overall' } }),

        // Mainstream
        axios.get(`${API_URL}/stats/mainstream/${user}`, { params: { period: 'overall' } }),

        // Top Artists
        axios.get(`${API_URL}/stats/top-artists/${user}`, { params: { period: 'overall', limit: 3 } })
      ];

      await Promise.all(promises);
    } catch (error) {
      console.error("Error prefetching stats:", error);
    }
  };

  const handleDownload = async (track) => {
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

      // If we are in library or undownloaded view, update the list locally
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
  };

  const handleDownloadAll = async () => {
    if (!confirm("Are you sure you want to download all pending tracks?")) return;

    // Set all current tracks to loading state to disable buttons
    const newDownloadingState = { ...downloading };
    downloadedTracks.forEach(track => {
      const query = `${track.artist} - ${track.title}`;
      newDownloadingState[query] = 'loading';
    });
    setDownloading(newDownloadingState);

    try {
      const response = await axios.post(`${API_URL}/download/all`);
      toast.success(`Started downloading ${response.data.count} tracks`);
      // Refresh list after a short delay
      setTimeout(() => {
        fetchDownloads();
      }, 1000);
    } catch (error) {
      console.error("Error downloading all:", error);
      toast.error("Failed to start bulk download");
      // Revert loading state on error
      setDownloading(prev => {
        const next = { ...prev };
        downloadedTracks.forEach(track => {
          const query = `${track.artist} - ${track.title}`;
          delete next[query];
        });
        return next;
      });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await axios.post(`${API_URL}/sync`);
      toast.success("Sync started");
      // Wait a bit to allow backend to process some items, then refresh view
      setTimeout(() => {
        if (view === 'scrobbles') fetchScrobbles();
        else if (view === 'library' || view === 'undownloaded') fetchDownloads();
      }, 2000);
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error("Failed to start sync");
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  // Infinite Scroll Observer
  const observer = useRef();
  const lastTrackElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && currentPage < totalPages) {
        setCurrentPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, totalPages, currentPage]);

  useEffect(() => {
    const controller = new AbortController();
    if (view === 'scrobbles') {
      if (username) fetchScrobbles(controller.signal);
    } else if (view === 'library' || view === 'undownloaded') {
      fetchDownloads(controller.signal);
    }
    return () => controller.abort();
  }, [view, currentPage, debouncedSearchQuery, artistFilter, albumFilter]); // Removed itemsPerPage

  const currentTracks = view === 'library' || view === 'undownloaded'
    ? downloadedTracks
    : tracks;

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFavoriteArtist = async (artist, e) => {
    e.preventDefault();
    e.stopPropagation();
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
  };

  const navItems = [
    { id: 'scrobbles', icon: Disc, label: 'Scrobbles' },
    { id: 'library', icon: CheckCircle, label: 'Library' },
    { id: 'playlists', icon: Music, label: 'Playlists' },
    { id: 'undownloaded', icon: Download, label: 'Undownloaded' },
    { id: 'jobs', icon: Hourglass, label: 'Jobs' },
    { id: 'stats', icon: Trophy, label: 'Stats' },
    { id: 'concerts', icon: Ticket, label: 'Concerts' },
  ].filter(item => !hiddenFeatures.has(item.id));

  return (
    <div className="min-h-screen bg-background text-foreground p-8 pb-32 transition-colors duration-300">
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
        },
      }} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(newUsername, newAutoDownload, newHiddenFeatures) => {
          setUsername(newUsername);
          setAutoDownload(newAutoDownload);
          setHiddenFeatures(new Set(newHiddenFeatures));
        }}
        onReplayTutorial={() => setShowTutorial(true)}
      />
      <TutorialModal
        isOpen={showTutorial}
        onClose={async () => {
          setShowTutorial(false);
          try {
            await axios.post(`${API_URL}/settings`, { tutorial_seen: true });
          } catch (error) {
            console.error("Failed to save tutorial status:", error);
          }
        }}
        onTutorialComplete={async (newUsername) => {
          setUsername(newUsername);
          // Prefetch scrobbles, downloads, AND stats
          await Promise.all([
            fetchScrobbles(null, newUsername),
            fetchDownloads(null),
            prefetchStats(newUsername)
          ]);
        }}
      />
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
      <div className="w-[95%] mx-auto space-y-8">


        {/* Header */}
        <GlassCard className="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-full transition-colors duration-300", autoDownload ? "bg-spotify-green" : "!bg-red-500")}>
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Spotiflow</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-end md:justify-center flex-1">
            {/* Desktop Navigation Tabs */}
            <div className="hidden lg:flex bg-white/10 p-1 rounded-full border border-white/5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id === 'scrobbles' ? '/' : `/${item.id}`)}
                  className={cn(
                    "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 z-10 outline-none",
                    view === item.id ? "text-white" : "text-gray-400 hover:text-white"
                  )}
                >
                  {view === item.id && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 bg-spotify-green rounded-full -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <item.icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Icons used on both Desktop and Mobile */}
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-spotify-grey hover:text-white"
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSync}
                disabled={isSyncing}
                className={cn(
                  "p-2 hover:bg-white/10 rounded-full transition-colors text-spotify-grey hover:text-white",
                  isSyncing && "animate-spin text-spotify-green"
                )}
                title="Sync with Last.fm"
              >
                <RefreshCw className="w-6 h-6" />
              </motion.button>
            </div>

            {/* Mobile Menu Toggle */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-white"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>

          </div>

          {/* Mobile Navigation Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden w-full overflow-hidden"
              >
                <div className="flex flex-col gap-2 pt-4 border-t border-white/5 mt-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(item.id === 'scrobbles' ? '/' : `/${item.id}`);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-left font-medium transition-all flex items-center gap-3",
                        view === item.id
                          ? "bg-spotify-green text-white shadow-lg shadow-spotify-green/20"
                          : "hover:bg-white/5 text-gray-400 hover:text-white"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Content */}
        {view === 'jobs' ? (
          <Jobs />
        ) : view === 'stats' ? (
          <Stats username={username} onTrackClick={setSelectedTrack} />
        ) : view === 'playlists' ? (
          <Playlists />
        ) : view === 'concerts' ? (
          <Concerts />
        ) : (

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                {view === 'scrobbles' ? <Disc className="w-5 h-5 text-spotify-green" /> :
                  view === 'library' ? <CheckCircle className="w-5 h-5 text-spotify-green" /> :
                    <Download className="w-5 h-5 text-spotify-green" />}
                {view === 'scrobbles' ? 'Recent Scrobbles' :
                  view === 'library' ? 'Downloaded Library' : 'Pending Downloads'}
              </h2>

              {view === 'undownloaded' && downloadedTracks.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 px-4 py-2 bg-spotify-green text-white rounded-full text-sm font-medium hover:scale-105 transition-transform"
                >
                  <Download className="w-4 h-4" />
                  Download All
                </motion.button>
              )}
            </div>

            {/* Search and Filters */}
            {(view === 'library' || view === 'undownloaded') && (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spotify-grey" />
                  <input
                    type="text"
                    placeholder={`Search ${view === 'library' ? 'library' : 'pending downloads'}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-white placeholder:text-spotify-grey focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors"
                  />
                </div>

                {view === 'library' && (
                  <div className="flex gap-2 text-white">
                    <FilterDropdown
                      value={artistFilter}
                      options={filterOptions.artists}
                      onChange={(val) => {
                        setArtistFilter(val);
                        setAlbumFilter('');
                      }}
                      placeholder="All Artists"
                    />

                    <FilterDropdown
                      value={albumFilter}
                      options={filterOptions.albums}
                      onChange={setAlbumFilter}
                      placeholder="All Albums"
                    />
                  </div>
                )}
              </div>
            )}

            {loading && (view === 'scrobbles' ? tracks.length === 0 : downloadedTracks.length === 0) ? (
              <div className={cn(
                "grid gap-4",
                view === 'library' || view === 'undownloaded' ? "grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5 @2xl:grid-cols-6" : "grid-cols-1"
              )}>
                {Array.from({ length: itemsPerPage }).map((_, i) => (
                  <SkeletonCard
                    key={i}
                    type={view === 'library' || view === 'undownloaded' ? 'vertical' : 'horizontal'}
                  />
                ))}
              </div>
            ) : (
              <div className="relative min-h-[200px]">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm rounded-xl transition-all duration-300">
                    <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
                  </div>
                )}

                <div className="@container">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${view}-${currentPage}`}
                      variants={{
                        hidden: { opacity: 0 },
                        show: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.03
                          }
                        },
                        exit: { opacity: 0 }
                      }}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className={cn(
                        "grid gap-4",
                        view === 'library' || view === 'undownloaded' ? "grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5 @2xl:grid-cols-6" : "grid-cols-1"
                      )}
                    >
                      {(view === 'library' || view === 'undownloaded') && currentTracks.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-spotify-grey">
                          <Music className="w-16 h-16 mb-4 opacity-50" />
                          <p className="text-xl font-semibold">
                            {view === 'library' ? "Your library is empty" : "No pending downloads"}
                          </p>
                          <p className="text-sm mt-2">
                            {view === 'library' ? "Download songs from your scrobbles to see them here." : "Disable auto-download to see pending items here."}
                          </p>
                        </div>
                      ) : (
                        (view === 'scrobbles' ? tracks : currentTracks).map((track, index) => {
                          const query = `${track.artist} - ${track.title}`;
                          const isLibraryItemDownloaded = (view === 'library' || view === 'undownloaded') && track.status === 'completed';
                          const status = isLibraryItemDownloaded || track.downloaded ? 'success' : downloading[query];
                          const imageSrc = view === 'scrobbles' ? track.image : track.image_url;
                          const isQueued = downloading[query] === 'loading' || downloading[query] === 'success';

                          // Use a more stable key strategy.
                          // Ideally track.timestamp for scrobbles (unique event) and track.id for library.
                          const uniqueKey = track.timestamp || track.id || `${track.artist}-${track.title}-${index}`;

                          return (
                            <motion.div
                              key={uniqueKey}
                              variants={{
                                hidden: { opacity: 0, y: 10, scale: 0.95 },
                                show: { opacity: 1, y: 0, scale: 1 },
                                exit: { opacity: 0, scale: 0.95 }
                              }}
                              transition={{ duration: 0.2 }}
                              whileHover={{ scale: 1.02 }}
                            >
                              <GlassCard
                                whileTap={{ scale: 0.98 }}
                                image={imageSrc}
                                // Add ref to the last element
                                ref={index === currentTracks.length - 1 && (view === 'library' || view === 'undownloaded') ? lastTrackElementRef : null}
                                onClick={() => {
                                  // If downloaded, try to play
                                  if (isLibraryItemDownloaded || track.downloaded) {
                                    playTrack(track); // Need to get playTrack from context
                                  } else {
                                    setSelectedTrack(track);
                                  }
                                }}
                                className={cn(
                                  "hover:bg-white/10 transition-colors relative overflow-hidden perspective-1000 cursor-pointer",
                                  view === 'library' || view === 'undownloaded' ? "p-4 flex flex-col gap-3 aspect-square justify-between" : "p-4 flex items-center justify-between"
                                )}
                              >

                                <div className={cn("flex gap-4", view === 'library' || view === 'undownloaded' ? "flex-col items-start w-full h-full" : "items-center")}>
                                  <div className={cn(
                                    "rounded-md overflow-hidden bg-spotify-dark relative flex items-center justify-center text-spotify-grey shadow-lg transition-transform duration-500 ease-out group-hover:rotate-x-6 group-hover:rotate-y-6 group-hover:scale-105",
                                    view === 'library' || view === 'undownloaded' ? "w-full aspect-square mb-2" : "w-16 h-16",
                                    isQueued && track.status !== 'completed' && "opacity-50 pointer-events-none"
                                  )}>
                                    {imageSrc ? (
                                      <img src={imageSrc} alt={track.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-spotify-dark to-spotify-grey/20 p-2 text-center">
                                        {view === 'library' || view === 'undownloaded' ? (
                                          <>
                                            <span className="font-bold text-white text-sm line-clamp-2">{track.title}</span>
                                            <span className="text-xs text-spotify-grey line-clamp-1 mt-1">{track.artist}</span>
                                          </>
                                        ) : (
                                          <Music className="w-8 h-8 text-spotify-grey/50" />
                                        )}
                                      </div>
                                    )}

                                    {(view === 'library' || view === 'undownloaded') && (
                                      <div className={cn(
                                        "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center",
                                        isQueued && track.status !== 'completed' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                      )}>
                                        {track.status === 'completed' ? (
                                          <CheckCircle className="w-8 h-8 text-spotify-green" />
                                        ) : isQueued ? (
                                          <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
                                        ) : (
                                          <motion.button
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDownload(track);
                                            }}
                                            className="p-3 bg-spotify-green rounded-full text-white shadow-lg shadow-black/40"
                                          >
                                            <Download className="w-6 h-6" />
                                          </motion.button>
                                        )}
                                      </div>
                                    )}

                                    {/* Actions for Library/Undownloaded Items */}
                                    {((view === 'library' || view === 'undownloaded') && track.status === 'completed') && (
                                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <motion.button
                                          whileTap={{ scale: 0.9 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTrack(track);
                                          }}
                                          className="p-2 bg-black/50 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm"
                                          title="View Info"
                                        >
                                          <Info className="w-4 h-4" />
                                        </motion.button>
                                        <motion.button
                                          whileTap={{ scale: 0.9 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPlaylistTrackToAdd(track);
                                          }}
                                          className="p-2 bg-black/50 hover:bg-spotify-green rounded-full text-white transition-colors backdrop-blur-sm"
                                          title="Add to Playlist"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </motion.button>
                                      </div>
                                    )}
                                  </div>

                                  <div className={cn("w-full", view === 'library' || view === 'undownloaded' ? "text-left" : "")}>
                                    <h3 className={cn("font-semibold truncate w-full", view === 'library' || view === 'undownloaded' ? "text-sm" : "text-lg")}>
                                      {track.title}
                                    </h3>
                                    <div className="flex items-center justify-between w-full">
                                      <p className={cn("text-spotify-grey truncate", view === 'library' || view === 'undownloaded' ? "text-xs flex-1" : "")}>
                                        {track.artist}
                                      </p>
                                      {view === 'library' && (
                                        <button
                                          onClick={(e) => toggleFavoriteArtist(track.artist, e)}
                                          className="hover:scale-110 transition-transform p-1 -mr-1"
                                          title={favoriteArtists.has(track.artist) ? "Unfavorite Artist" : "Favorite Artist"}
                                        >
                                          <Heart className={cn("w-4 h-4", favoriteArtists.has(track.artist) ? "fill-spotify-green text-spotify-green" : "text-spotify-grey hover:text-white")} />
                                        </button>
                                      )}
                                    </div>
                                    {view !== 'library' && view !== 'undownloaded' && (
                                      <p className="text-xs text-spotify-grey/60 mt-1">{track.album}</p>
                                    )}
                                  </div>
                                </div>

                                {view !== 'library' && view !== 'undownloaded' && (
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDownload(track)}
                                    disabled={status === 'loading' || status === 'success'}
                                    className={cn(
                                      "p-3 rounded-full transition-all duration-300",
                                      status === 'success' ? "bg-spotify-green text-white" :
                                        status === 'loading' ? "bg-spotify-grey/20 text-spotify-green" :
                                          "bg-white/10 text-white hover:bg-spotify-green hover:scale-110"
                                    )}
                                  >
                                    {status === 'success' ? (
                                      <CheckCircle className="w-6 h-6" />
                                    ) : status === 'loading' ? (
                                      <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                      <Download className="w-6 h-6" />
                                    )}
                                  </motion.button>
                                )}
                              </GlassCard>
                            </motion.div>
                          );
                        })
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Infinite Scroll Loading Indicator */}
            {(view === 'library' || view === 'undownloaded') && loading && downloadedTracks.length > 0 && (
              <div className="py-4 flex justify-center w-full">
                <Loader2 className="w-6 h-6 animate-spin text-spotify-green" />
              </div>
            )}
          </div>
        )}
      </div>
      <PlayerBar />
    </div >
  );
}

function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}

export default App;
