import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Music, Disc, Search, CheckCircle, Loader2, Settings, ChevronLeft, ChevronRight, RefreshCw, Hourglass } from 'lucide-react';
import { cn } from './utils';
import { SettingsModal } from './SettingsModal';
import { TutorialModal } from './TutorialModal';
import { GlassCard } from './components/GlassCard';
import Jobs from './Jobs';

import { ThemeProvider } from './contexts/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { Toaster, toast } from 'react-hot-toast';

const API_URL = '/api';

function App() {
  const [view, setView] = useState('scrobbles'); // 'scrobbles', 'library', 'undownloaded', 'jobs'
  const [username, setUsername] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoDownload, setAutoDownload] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

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
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset search when view changes
  useEffect(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
  }, [view]);

  // Fetch scrobbles whenever username changes (if not empty)
  useEffect(() => {
    const controller = new AbortController();
    if (username && view === 'scrobbles') {
      fetchScrobbles(controller.signal);
    }
    return () => controller.abort();
  }, [username]);

  const fetchScrobbles = async (signal) => {
    if (!username) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/scrobbles/${username}`, { signal });
      setTracks(response.data);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Error fetching scrobbles:", error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const fetchDownloads = async (signal) => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };

      if (view === 'library') {
        params.status = 'completed';
      } else if (view === 'undownloaded') {
        params.status = 'pending';
      }

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      const response = await axios.get(`${API_URL}/downloads`, { params, signal });
      setDownloadedTracks(response.data.items);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Error fetching downloads:", error);
      toast.error("Failed to fetch library");
    } finally {
      if (!signal?.aborted) setLoading(false);
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

      // If we are in library or undownloaded view, refresh the list
      if (view === 'library' || view === 'undownloaded') {
        fetchDownloads();
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

  useEffect(() => {
    const controller = new AbortController();
    if (view === 'scrobbles') {
      if (username) fetchScrobbles(controller.signal);
    } else if (view === 'library' || view === 'undownloaded') {
      fetchDownloads(controller.signal);
    }
    return () => controller.abort();
  }, [view, currentPage, itemsPerPage, debouncedSearchQuery]);

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

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground p-8 transition-colors duration-300">
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
        }} />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(newUsername, newAutoDownload) => {
            setUsername(newUsername);
            setAutoDownload(newAutoDownload);
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

            <div className="flex items-center gap-4">
              {/* Navigation Tabs */}
              <div className="flex bg-black/5 dark:bg-white/10 p-1 rounded-full border border-border">
                <button
                  onClick={() => setView('scrobbles')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                    view === 'scrobbles' ? "bg-spotify-green text-white" : "text-spotify-grey hover:text-black dark:text-white/70 dark:hover:text-white"
                  )}
                >
                  <Disc className="w-4 h-4" />
                  Scrobbles
                </button>
                <button
                  onClick={() => setView('library')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                    view === 'library' ? "bg-spotify-green text-white" : "text-spotify-grey hover:text-black dark:text-white/70 dark:hover:text-white"
                  )}
                >
                  <CheckCircle className="w-4 h-4" />
                  Library
                </button>
                <button
                  onClick={() => setView('undownloaded')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                    view === 'undownloaded' ? "bg-spotify-green text-white" : "text-spotify-grey hover:text-black dark:text-white/70 dark:hover:text-white"
                  )}
                >
                  <Download className="w-4 h-4" />
                  Undownloaded
                </button>
                <button
                  onClick={() => setView('jobs')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                    view === 'jobs' ? "bg-spotify-green text-white" : "text-spotify-grey hover:text-black dark:text-white/70 dark:hover:text-white"
                  )}
                >
                  <Hourglass className="w-4 h-4" />
                  Jobs
                </button>
              </div>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-spotify-grey hover:text-white"
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </button>

              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={cn(
                  "p-2 hover:bg-white/10 rounded-full transition-colors text-spotify-grey hover:text-white",
                  isSyncing && "animate-spin text-spotify-green"
                )}
                title="Sync with Last.fm"
              >
                <RefreshCw className="w-6 h-6" />
              </button>

              <div className="h-6 w-px bg-white/10 mx-2" />
              <ThemeToggle />
            </div>
          </GlassCard>

          {/* Content */}
          {view === 'jobs' ? (
            <Jobs />
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
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 px-4 py-2 bg-spotify-green text-white rounded-full text-sm font-medium hover:scale-105 transition-transform"
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </button>
                )}
              </div>

              {/* Search Bar */}
              {(view === 'library' || view === 'undownloaded') && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spotify-grey" />
                  <input
                    type="text"
                    placeholder={`Search ${view === 'library' ? 'library' : 'pending downloads'}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-white placeholder:text-spotify-grey focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors"
                  />
                </div>
              )}

              {loading && (view === 'scrobbles' ? tracks.length === 0 : downloadedTracks.length === 0) ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
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
                        key={view}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
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
                          <AnimatePresence>
                            {(view === 'scrobbles' ? tracks : currentTracks).map((track, index) => {
                              const query = `${track.artist} - ${track.title}`;
                              const isLibraryItemDownloaded = (view === 'library' || view === 'undownloaded') && track.status === 'completed';
                              const status = isLibraryItemDownloaded || track.downloaded ? 'success' : downloading[query];
                              const imageSrc = view === 'scrobbles' ? track.image : track.image_url;
                              const isQueued = downloading[query] === 'loading' || downloading[query] === 'success';

                              return (
                                <GlassCard
                                  key={`${track.timestamp || track.id}-${index}`}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -20 }}
                                  transition={{ delay: index * 0.05 }}
                                  image={imageSrc}
                                  className={cn(
                                    "hover:bg-white/10 transition-colors relative overflow-hidden perspective-1000",
                                    view === 'library' || view === 'undownloaded' ? "p-4 flex flex-col gap-3 aspect-square justify-between" : "p-4 flex items-center justify-between"
                                  )}
                                >
                                  <div className={cn("flex gap-4", view === 'library' || view === 'undownloaded' ? "flex-col items-start w-full h-full" : "items-center")}>
                                    <div className={cn(
                                      "rounded-md overflow-hidden bg-black/5 dark:bg-spotify-dark relative flex items-center justify-center text-spotify-grey shadow-lg transition-transform duration-500 ease-out group-hover:rotate-x-6 group-hover:rotate-y-6 group-hover:scale-105",
                                      view === 'library' || view === 'undownloaded' ? "w-full aspect-square mb-2" : "w-16 h-16",
                                      isQueued && track.status !== 'completed' && "opacity-50 pointer-events-none"
                                    )}>
                                      {imageSrc ? (
                                        <img src={imageSrc} alt={track.title} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-transparent dark:bg-linear-to-br dark:from-spotify-dark dark:to-spotify-grey/20 p-2 text-center">
                                          {view === 'library' || view === 'undownloaded' ? (
                                            <>
                                              <span className="font-bold text-black dark:text-white text-sm line-clamp-2">{track.title}</span>
                                              <span className="text-xs text-black/70 dark:text-spotify-grey line-clamp-1 mt-1">{track.artist}</span>
                                            </>
                                          ) : (
                                            <Music className="w-8 h-8 text-black/50 dark:text-spotify-grey/50" />
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
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(track);
                                              }}
                                              className="p-2 bg-spotify-green rounded-full text-white hover:scale-110 transition-transform"
                                            >
                                              <Download className="w-6 h-6" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className={cn("w-full", view === 'library' || view === 'undownloaded' ? "text-left" : "")}>
                                      <h3 className={cn("font-semibold truncate w-full", view === 'library' || view === 'undownloaded' ? "text-sm" : "text-lg")}>
                                        {track.title}
                                      </h3>
                                      <p className={cn("text-spotify-grey truncate w-full", view === 'library' || view === 'undownloaded' ? "text-xs" : "")}>
                                        {track.artist}
                                      </p>
                                      {view !== 'library' && view !== 'undownloaded' && (
                                        <p className="text-xs text-spotify-grey/60 mt-1">{track.album}</p>
                                      )}
                                    </div>
                                  </div>

                                  {view !== 'library' && view !== 'undownloaded' && (
                                    <button
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
                                    </button>
                                  )}
                                </GlassCard>
                              );
                            })}
                          </AnimatePresence>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              {
                (view === 'library' || view === 'undownloaded') && !loading && downloadedTracks.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 p-4 glass-panel">
                    <div className="flex items-center gap-2 text-sm text-spotify-grey">
                      <span>Rows per page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        className="bg-spotify-dark border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-spotify-green"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="ml-2">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          // Logic to show current page and surrounding pages
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={cn(
                                "w-8 h-8 rounded-full text-sm font-medium transition-colors",
                                currentPage === pageNum
                                  ? "bg-spotify-green text-white"
                                  : "hover:bg-white/10 text-spotify-grey hover:text-white"
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )
              }
            </div>
          )}
      </div>
    </div>
    </ThemeProvider>
  );
}

export default App;
