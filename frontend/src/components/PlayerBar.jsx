import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, Maximize2, Mic2, Radio, ListMusic } from 'lucide-react';
import { motion } from 'framer-motion';
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
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        progress,
        duration,
        seek,
        volume,
        updateVolume,
        isReady,
        activeDownloads,
        nextTrack,
        prevTrack,
        showLyrics,
        toggleLyrics,
        playbackType,
        sourceName,
        streamStatus,
        queueMode,
        queueSummary,
        buffering,
        isPromoted,
        hasSuspendedRadio,
        showQueuePanel,
        setShowQueuePanel,
    } = usePlayer();
    const navigate = useNavigate();

    const playbackBadge = playbackType === 'local'
        ? 'Downloaded'
        : playbackType === 'preview'
            ? 'Preview'
            : playbackType === 'remote_stream'
                ? 'Streaming'
                : null;

    // Show nothing if no track and no downloads
    if (!currentTrack && activeDownloads.length === 0) return null;

    // Collapsed Status Bar (Only Downloads)
    if (!currentTrack) {
        return (
            <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 md:bottom-4">
                <div className="mx-auto w-full max-w-[1880px] px-3 md:px-5 lg:px-6">
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className={cn(
                            "pointer-events-auto flex h-12 cursor-pointer items-center justify-center rounded-full border border-white/12 px-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.38)] ring-1 ring-white/6 transition-colors lg:ml-[19.5rem]",
                            isFirefox ? "bg-black/95 hover:bg-black" : "bg-black/55 backdrop-blur-2xl hover:bg-black/65"
                        )}
                        onClick={() => navigate('/jobs')}
                    >
                        <div className="flex items-center gap-3 text-sm font-medium text-spotify-green animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{activeDownloads.length} item{activeDownloads.length !== 1 && 's'} downloading...</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Full Player Bar
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[9000] md:bottom-4">
            <div className="mx-auto w-full max-w-[1880px] px-3 md:px-5 lg:px-6">
                <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className={cn(
                        "pointer-events-auto flex min-h-24 items-center justify-between rounded-[2rem] border border-white/12 px-4 py-3 text-white shadow-[0_24px_60px_rgba(0,0,0,0.42)] ring-1 ring-white/6 md:px-8 lg:ml-[19.5rem]",
                        isFirefox ? "bg-black/95" : "bg-black/45 backdrop-blur-2xl"
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
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                {playbackBadge && (
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">
                                        {playbackBadge}
                                    </span>
                                )}
                                {queueMode === 'radio' && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-spotify-green/20 px-2 py-0.5 text-[10px] font-medium text-spotify-green">
                                        <Radio className="h-3 w-3" />
                                        Radio
                                    </span>
                                )}
                                {hasSuspendedRadio && (
                                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                                        Manual override
                                    </span>
                                )}
                                {buffering && (
                                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                                        Buffering
                                    </span>
                                )}
                                {streamStatus === 'cooldown' && (
                                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300">
                                        Cooling down
                                    </span>
                                )}
                                {streamStatus === 'degraded' && (
                                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                                        Stream degraded
                                    </span>
                                )}
                                {streamStatus === 'restored' && (
                                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                                        Session restored
                                    </span>
                                )}
                                {isPromoted && (
                                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                                        Download queued
                                    </span>
                                )}
                            </div>
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

                        {sourceName && playbackType !== 'local' && (
                            <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 md:inline-flex">
                                {sourceName}
                            </span>
                        )}

                        <button
                            onClick={() => setShowQueuePanel(!showQueuePanel)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                showQueuePanel ? 'border-spotify-green/40 bg-spotify-green/10 text-spotify-green' : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]'
                            }`}
                            title="Queue"
                        >
                            <ListMusic className="h-4 w-4" />
                            <span>{queueSummary?.remaining ?? 0}</span>
                        </button>

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
            </div>
        </div>
    );
}
