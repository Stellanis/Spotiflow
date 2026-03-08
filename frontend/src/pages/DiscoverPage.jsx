import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Download, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { usePlayer } from '../contexts/PlayerContext';
import { GlassCard } from '../components/GlassCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { cn } from '../utils';

export default function DiscoverPage() {
    const { username } = useOutletContext();
    const { playTrack } = usePlayer();

    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState({});

    // Fetch recommendations
    const fetchRecommendations = async () => {
        if (!username) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await axios.get('/api/recommendations', { params: { limit: 20 } });
            setRecommendations(response.data.items || []);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
            toast.error("Failed to load recommendations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, [username]);

    const handleDownload = async (track) => {
        const query = `${track.artist} - ${track.title}`;
        if (downloading[query]) return; // prevent double click
        setDownloading(prev => ({ ...prev, [query]: 'loading' }));
        try {
            await axios.post('/api/download', {
                query,
                artist: track.artist,
                title: track.title,
                album: track.album || '',
                image: track.image || track.image_url
            });
            setDownloading(prev => ({ ...prev, [query]: 'success' }));
            toast.success(`Downloading "${track.title}"`);
        } catch (error) {
            console.error("Error downloading:", error);
            setDownloading(prev => ({ ...prev, [query]: 'error' }));
            toast.error(`Failed to download "${track.title}"`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Compass className="w-5 h-5 text-spotify-green" />
                    Discover Recommendations
                </h2>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchRecommendations}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 transition-colors shadow-lg"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    Refresh
                </motion.button>
            </div>

            {loading ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <SkeletonCard key={i} type="vertical" />
                    ))}
                </div>
            ) : recommendations.length === 0 ? (
                <div className="w-full flex justify-center py-20">
                    <div className="text-center text-spotify-grey">
                        <Compass className="w-16 h-16 mx-auto mb-4 opacity-50 text-spotify-green" />
                        <h3 className="text-xl font-semibold text-white mb-2">No Recommendations Yet</h3>
                        <p>Listen to more tracks to get personalized recommendations based on your taste.</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    <AnimatePresence>
                        {recommendations.map((track, index) => {
                            const query = `${track.artist} - ${track.title}`;
                            const status = downloading[query];
                            const isQueued = status === 'loading' || status === 'success';

                            return (
                                <motion.div
                                    key={`${track.artist}-${track.title}-${index}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    whileHover={{ scale: 1.02 }}
                                    layout
                                >
                                    <GlassCard
                                        className="p-4 flex flex-col gap-3 aspect-square justify-between hover:bg-white/10 relative group overflow-hidden cursor-pointer"
                                    >
                                        <div className="w-full aspect-square rounded-md overflow-hidden bg-spotify-dark relative shadow-lg group-hover:shadow-xl transition-all">
                                            {track.image ? (
                                                <img src={track.image} alt={track.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 p-2 text-center">
                                                    <span className="font-bold text-white text-sm line-clamp-2">{track.title}</span>
                                                    <span className="text-xs text-spotify-grey line-clamp-1 mt-1">{track.artist}</span>
                                                </div>
                                            )}

                                            {/* Download Overlay */}
                                            <div className={cn(
                                                "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center",
                                                isQueued ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}>
                                                {status === 'success' ? (
                                                    <CheckCircle className="w-8 h-8 text-spotify-green" />
                                                ) : status === 'loading' ? (
                                                    <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
                                                ) : (
                                                    <motion.button
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
                                        </div>

                                        <div className="w-full text-left">
                                            <h3 className="font-semibold truncate w-full text-sm text-white">{track.title}</h3>
                                            <div className="flex items-center justify-between w-full">
                                                <p className="text-spotify-grey truncate text-xs flex-1">{track.artist}</p>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
