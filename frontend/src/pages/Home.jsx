import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc, Loader2, Music, RefreshCw } from 'lucide-react';
import { useLibrary } from '../hooks/useLibrary';
import { usePlayer } from '../contexts/PlayerContext';
import { GlassCard } from '../components/GlassCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { cn } from '../utils';

import { TrackStatsModal } from '../components/TrackStatsModal';
import { SonicDiary } from '../components/SonicDiary';

export default function Home() {
    const { username, isSyncing } = useOutletContext();
    const { playTrack } = usePlayer();
    const [selectedTrack, setSelectedTrack] = useState(null);

    const {
        scrobbles,
        loadingScrobbles,
        fetchScrobbles,
    } = useLibrary(username);

    // Initial Fetch when username is available
    useEffect(() => {
        if (username) {
            fetchScrobbles();
        }
    }, [username, fetchScrobbles]);

    // Refetch when sync finishes?
    useEffect(() => {
        if (!isSyncing && username) {
            fetchScrobbles();
        }
    }, [isSyncing, username, fetchScrobbles]);

    return (
        <div className="space-y-6">
            <TrackStatsModal
                isOpen={!!selectedTrack}
                onClose={() => setSelectedTrack(null)}
                track={selectedTrack}
                username={username}
            />

            <SonicDiary username={username} />

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Disc className="w-5 h-5 text-spotify-green" />
                    Recent Scrobbles
                </h2>
            </div>

            {loadingScrobbles && scrobbles.length === 0 ? (
                <div className="grid gap-4 grid-cols-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonCard key={i} type="horizontal" />
                    ))}
                </div>
            ) : (
                <div className="relative min-h-[200px]">
                    {loadingScrobbles && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm rounded-xl transition-all duration-300">
                            <Loader2 className="w-10 h-10 animate-spin text-spotify-green" />
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        <div className="grid gap-4 grid-cols-1">
                            {scrobbles.length === 0 ? (
                                <div className="py-20 text-center text-spotify-grey">
                                    <Disc className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>No scrobbles found. Play some music!</p>
                                </div>
                            ) : (
                                scrobbles.map((track, index) => (
                                    <motion.div
                                        key={`${track.timestamp || index}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        layout
                                    >
                                        <GlassCard
                                            whileTap={{ scale: 0.98 }}
                                            className="p-4 flex items-center justify-between hover:bg-white/10 cursor-pointer group"
                                            onClick={() => {
                                                if (track.downloaded) {
                                                    playTrack(track); // If downloaded
                                                } else {
                                                    setSelectedTrack(track);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-md overflow-hidden bg-spotify-dark shrink-0 relative">
                                                    {track.image ? (
                                                        <img src={track.image} alt={track.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                            <Music className="w-6 h-6 text-spotify-grey" />
                                                        </div>
                                                    )}

                                                    {/* Overlay for not-downloaded items? Or just keep simple */}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold truncate text-white text-lg leading-tight mb-1">{track.title}</h3>
                                                    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                                        {track.artist.split(/[\/,]/).map((a, i, arr) => {
                                                            const name = a.trim();
                                                            return (
                                                                <span key={name} className="flex items-center gap-1 group/artist">
                                                                    <span
                                                                        className="text-spotify-grey text-sm hover:text-white hover:underline transition-all cursor-pointer truncate max-w-[150px]"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            window.dispatchEvent(new CustomEvent('open-artist-deep-dive', { detail: name }));
                                                                        }}
                                                                    >
                                                                        {name}
                                                                    </span>
                                                                    {i < arr.length - 1 && <span className="text-spotify-grey/40 text-xs text-center font-normal">/</span>}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                    <p className="text-xs text-spotify-grey/60 mt-1">{track.album}</p>
                                                </div>
                                            </div>

                                            {/* Status / Action */}
                                            {track.downloaded && (
                                                <div className="p-2">
                                                    <CheckCircleIcon className="w-6 h-6 text-spotify-green" />
                                                </div>
                                            )}
                                        </GlassCard>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

function CheckCircleIcon({ className }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}
