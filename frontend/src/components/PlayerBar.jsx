import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, Maximize2, Download, Mic2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../contexts/PlayerContext';
import { cn } from '../utils';
import { isFirefox } from '../utils/browser';
import { useNavigate } from 'react-router-dom';

function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlayerBar() {
    const { currentTrack, isPlaying, togglePlay, progress, duration, seek, volume, updateVolume, isReady, activeDownloads, nextTrack, prevTrack, showLyrics, toggleLyrics } = usePlayer();
    const navigate = useNavigate();

    // Show nothing if no track and no downloads
    if (!currentTrack && activeDownloads.length === 0) return null;

    // Collapsed Status Bar (Only Downloads)
    if (!currentTrack) {
        return (
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className={cn(
                    "fixed bottom-0 left-0 right-0 h-12 border-t border-white/10 px-4 md:px-8 flex items-center justify-center z-50 text-white cursor-pointer transition-colors",
                    isFirefox ? "bg-black/95 hover:bg-black" : "bg-black/60 backdrop-blur-xl hover:bg-black/70"
                )}
                onClick={() => navigate('/jobs')}
            >
                <div className="flex items-center gap-3 text-sm font-medium text-spotify-green animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{activeDownloads.length} item{activeDownloads.length !== 1 && 's'} downloading...</span>
                </div>
            </motion.div>
        );
    }

    // Full Player Bar
    return (
        <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className={cn(
                "fixed bottom-0 left-0 right-0 h-24 border-t border-white/10 px-4 md:px-8 flex items-center justify-between z-[9000] text-white",
                isFirefox ? "bg-black/95" : "bg-black/40 backdrop-blur-xl"
            )}
        >
            {/* Track Info */}
            <div className="flex items-center gap-4 w-[30%]">
                <div className="w-14 h-14 rounded-md overflow-hidden bg-white/10 relative group">
                    {currentTrack.image || currentTrack.image_url ? (
                        <img src={currentTrack.image || currentTrack.image_url} alt={currentTrack.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-spotify-grey/20">
                            <Maximize2 className="w-6 h-6 text-white/50" />
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate hover:underline cursor-pointer">{currentTrack.title}</h4>
                    <p className="text-xs text-spotify-grey truncate hover:underline cursor-pointer">{currentTrack.artist}</p>
                </div>
            </div>

            {/* Controls & Scrubber */}
            <div className="flex flex-col items-center gap-2 w-[40%] max-w-xl">
                <div className="flex items-center gap-6">
                    <button onClick={prevTrack} className="text-spotify-grey hover:text-white transition-colors">
                        <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                        disabled={!isReady}
                    >
                        {!isReady ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isPlaying ? (
                            <Pause className="w-5 h-5 fill-current" />
                        ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                    </button>

                    <button onClick={nextTrack} className="text-spotify-grey hover:text-white transition-colors">
                        <SkipForward className="w-5 h-5" />
                    </button>
                </div>

                <div className="w-full flex items-center gap-2 text-xs font-mono text-spotify-grey">
                    <span>{formatDuration(progress)}</span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={progress}
                        onChange={(e) => seek(Number(e.target.value))}
                        className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                    />
                    <span>{formatDuration(duration)}</span>
                </div>
            </div>

            {/* Volume & Extra */}
            <div className="flex items-center justify-end gap-2 md:gap-3 w-auto md:w-[30%]">
                {/* Global Download Status */}
                {activeDownloads.length > 0 && (
                    <motion.button
                        layoutId="download-status"
                        onClick={() => navigate('/jobs')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium animate-pulse hover:bg-blue-500/30 transition-colors"
                    >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="hidden md:inline">{activeDownloads.length} Downloading</span>
                        <span className="md:hidden">{activeDownloads.length}</span>
                    </motion.button>
                )}

                <div className="h-8 w-px bg-white/10 mx-1 md:mx-2" />

                <button
                    onClick={toggleLyrics}
                    className={`text-spotify-grey hover:text-white transition-colors p-2 ${showLyrics ? 'text-spotify-green' : ''}`}
                    title="Lyrics"
                >
                    <Mic2 className="w-5 h-5" />
                </button>

                <div className="hidden md:flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-spotify-grey" />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => updateVolume(Number(e.target.value))}
                        className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                </div>
            </div>
        </motion.div>
    );
}
