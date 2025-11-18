import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Music, Disc, Search, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from './utils';

const API_URL = 'http://localhost:8000';

function App() {
  const [view, setView] = useState('scrobbles'); // 'scrobbles' or 'library'
  const [username, setUsername] = useState('wife5711'); // Default from user request
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [downloadedTracks, setDownloadedTracks] = useState([]);

  const fetchScrobbles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/scrobbles/${username}`);
      setTracks(response.data);
    } catch (error) {
      console.error("Error fetching scrobbles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDownloads = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/downloads`);
      setDownloadedTracks(response.data);
    } catch (error) {
      console.error("Error fetching downloads:", error);
    } finally {
      setLoading(false);
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
        image: track.image
      });
      setDownloading(prev => ({ ...prev, [query]: 'success' }));
      // If we are in library view, maybe refresh? But usually we download from scrobbles view.
    } catch (error) {
      console.error("Error downloading:", error);
      setDownloading(prev => ({ ...prev, [query]: 'error' }));
    }
  };

  useEffect(() => {
    if (view === 'scrobbles') {
      fetchScrobbles();
    } else {
      fetchDownloads();
    }
  }, [view]);

  return (
    <div className="min-h-screen bg-spotify-black text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between glass-panel p-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-spotify-green rounded-full">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Spotify Downloader</h1>
              <p className="text-spotify-grey text-sm">Powered by Last.fm & yt-dlp</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Navigation Tabs */}
            <div className="flex bg-spotify-dark/50 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setView('scrobbles')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                  view === 'scrobbles' ? "bg-spotify-green text-white" : "text-spotify-grey hover:text-white"
                )}
              >
                <Disc className="w-4 h-4" />
                Scrobbles
              </button>
              <button
                onClick={() => setView('library')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                  view === 'library' ? "bg-spotify-green text-white" : "text-spotify-grey hover:text-white"
                )}
              >
                <CheckCircle className="w-4 h-4" />
                Library
              </button>
            </div>

            {view === 'scrobbles' && (
              <div className="flex items-center gap-2 bg-spotify-dark/50 p-2 rounded-lg border border-white/5">
                <Search className="w-5 h-5 text-spotify-grey" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchScrobbles()}
                  className="bg-transparent border-none outline-none text-sm w-32 placeholder:text-spotify-grey"
                  placeholder="Last.fm User"
                />
                <button
                  onClick={fetchScrobbles}
                  className="bg-spotify-green hover:bg-green-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  Fetch
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {view === 'scrobbles' ? <Disc className="w-5 h-5 text-spotify-green" /> : <CheckCircle className="w-5 h-5 text-spotify-green" />}
            {view === 'scrobbles' ? 'Recent Scrobbles' : 'Downloaded Library'}
          </h2>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              view === 'library' ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
            )}>
              <AnimatePresence mode="wait">
                {(view === 'scrobbles' ? tracks : downloadedTracks).map((track, index) => {
                  const query = `${track.artist} - ${track.title}`;
                  const status = view === 'library' || track.downloaded ? 'success' : downloading[query];

                  // Determine image source: track.image (scrobbles) or track.image_url (library)
                  const imageSrc = view === 'scrobbles' ? track.image : track.image_url;

                  return (
                    <motion.div
                      key={`${track.timestamp || track.id}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "glass-panel group hover:bg-white/10 transition-colors relative overflow-hidden",
                        view === 'library' ? "p-4 flex flex-col gap-3 aspect-square justify-between" : "p-4 flex items-center justify-between"
                      )}
                    >
                      <div className={cn("flex gap-4", view === 'library' ? "flex-col items-start w-full h-full" : "items-center")}>
                        <div className={cn(
                          "rounded-md overflow-hidden bg-spotify-dark relative flex items-center justify-center text-spotify-grey shadow-lg",
                          view === 'library' ? "w-full aspect-square mb-2" : "w-16 h-16"
                        )}>
                          {imageSrc ? (
                            <img src={imageSrc} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-spotify-dark to-spotify-grey/20 p-2 text-center">
                              {view === 'library' ? (
                                <>
                                  <span className="font-bold text-white text-sm line-clamp-2">{track.title}</span>
                                  <span className="text-xs text-spotify-grey line-clamp-1 mt-1">{track.artist}</span>
                                </>
                              ) : (
                                <Music className="w-8 h-8 text-spotify-grey/50" />
                              )}
                            </div>
                          )}

                          {/* Overlay Play/Check Icon for Library Grid */}
                          {view === 'library' && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <CheckCircle className="w-8 h-8 text-spotify-green" />
                            </div>
                          )}
                        </div>

                        <div className={cn("w-full", view === 'library' ? "text-left" : "")}>
                          <h3 className={cn("font-semibold truncate w-full", view === 'library' ? "text-sm" : "text-lg")}>
                            {track.title}
                          </h3>
                          <p className={cn("text-spotify-grey truncate w-full", view === 'library' ? "text-xs" : "")}>
                            {track.artist}
                          </p>
                          {view !== 'library' && (
                            <p className="text-xs text-spotify-grey/60 mt-1">{track.album}</p>
                          )}
                        </div>
                      </div>

                      {view !== 'library' && (
                        <button
                          onClick={() => view === 'scrobbles' && handleDownload(track)}
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
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
