import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Plus, Users, Music, Disc, Info, ExternalLink, Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';

const API_URL = '/api';

export function ArtistModal({ isOpen, onClose, artist, username, onTrackClick }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stats');

    useEffect(() => {
        if (isOpen && artist && username) {
            fetchDeepDive();
        }
    }, [isOpen, artist, username]);

    const fetchDeepDive = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/stats/artist-deep-dive/${username}?artist=${encodeURIComponent(artist)}`);
            setData(res.data);
        } catch (error) {
            console.error("Error fetching artist deep dive:", error);
        } finally {
            setLoading(false);
        }
    };

    const [headerColor, setHeaderColor] = useState('#1DB954'); // Default Spotify Green

    useEffect(() => {
        if (data?.global_stats?.top_albums?.[0]?.image) {
            extractColor(data.global_stats.top_albums[0].image);
        } else if (data?.image) {
            extractColor(data.image);
        }
    }, [data]);

    const extractColor = (imageUrl) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1;
            canvas.height = 1;
            ctx.drawImage(img, 0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            setHeaderColor(`rgb(${r}, ${g}, ${b})`);
        };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-4xl max-h-[90vh] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative transition-colors duration-1000"
                style={{
                    background: `linear-gradient(to bottom right, ${headerColor}20, #121212 90%)`,
                    backgroundColor: '#121212' // Fallback
                }}
            >
                {/* Header with Image/Gradient */}
                <div className="relative h-48 md:h-80 flex-shrink-0 overflow-hidden">
                    {/* Dynamic Gradient Background for header specific intensity */}
                    <div
                        className="absolute inset-0 opacity-60 transition-colors duration-1000"
                        style={{ background: `linear-gradient(to bottom, ${headerColor}, transparent)` }}
                    />

                    {/* Artist Image Background (Blurred) */}
                    {data?.image && (
                        <div className="absolute inset-0 opacity-30">
                            <img
                                src={data.image}
                                alt={artist}
                                className="w-full h-full object-cover blur-2xl scale-125"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/20 to-transparent" />

                    <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors z-20">
                        <X className="w-6 h-6" />
                    </button>

                    <div className="absolute bottom-8 left-8 flex items-end gap-6 z-10 w-full pr-8">
                        {/* Artist Profile Image */}
                        {data?.image ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-32 h-32 md:w-40 md:h-40 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] border-4 border-white/10 overflow-hidden flex-shrink-0 bg-[#121212]"
                            >
                                <img
                                    src={data.image}
                                    alt={artist}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = ''; // Clear src or hide
                                        e.target.style.display = 'none';
                                        e.target.parentElement.classList.add('hidden'); // Hide the container if image fails
                                        // Ideally we would switch state to show fallback, but hiding is quick for now
                                    }}
                                />
                            </motion.div>
                        ) : (
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 border-4 border-white/5 backdrop-blur-sm">
                                <Users className="w-16 h-16 text-white/20" />
                            </div>
                        )}

                        <div className="flex-1 min-w-0 pb-2">
                            <h1 className="text-4xl md:text-7xl font-black text-white mb-2 leading-tight tracking-tight truncate drop-shadow-lg">{artist}</h1>
                            <div className="flex gap-4 text-white/80 text-sm font-bold uppercase tracking-widest shadow-black drop-shadow-md">
                                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Top Artist</span>
                                {data && (
                                    <span className="flex items-center gap-2 text-spotify-green">
                                        <Music className="w-4 h-4" /> {data.local_stats.top_tracks.length} Local Tracks
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-4 md:px-8 border-b border-white/5 bg-[#121212] overflow-x-auto no-scrollbar shrink-0">
                    {[
                        { id: 'stats', label: 'Listen Stats', icon: Music },
                        { id: 'discovery', label: 'Discovery', icon: Sparkles },
                        { id: 'bio', label: 'About', icon: Info },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2",
                                activeTab === tab.id ? "text-white border-spotify-green" : "text-spotify-grey border-transparent hover:text-white"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-32 bg-white/5 rounded-2xl" />
                            ))}
                        </div>
                    ) : data ? (
                        <AnimatePresence mode="wait">
                            {activeTab === 'stats' && (
                                <motion.div
                                    key="stats"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-8"
                                >
                                    {/* Local Top Tracks */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <Disc className="w-5 h-5 text-spotify-green" /> Your Local Library
                                        </h3>
                                        <div className="space-y-2">
                                            {data.local_stats.top_tracks.map((track, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => onTrackClick({ artist, title: track.title, image: track.image })}
                                                    className="flex items-center gap-4 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
                                                >
                                                    <span className="text-spotify-grey font-mono w-4">{idx + 1}</span>
                                                    <div className="flex-1">
                                                        <div className="text-white font-medium group-hover:text-spotify-green transition-colors">{track.title}</div>
                                                        <div className="text-xs text-spotify-grey">{track.playcount} plays</div>
                                                    </div>
                                                    <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Global Trends */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <Users className="w-5 h-5 text-blue-400" /> Global Top Tracks
                                        </h3>
                                        <div className="space-y-2">
                                            {data.global_stats.top_tracks.map((track, idx) => (
                                                <div key={idx} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl transition-colors">
                                                    <span className="text-spotify-grey font-mono w-4">{idx + 1}</span>
                                                    <div className="flex-1">
                                                        <div className="text-white font-medium">{track.title}</div>
                                                        <div className="text-xs text-spotify-grey">{Number(track.listeners).toLocaleString()} listeners</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'discovery' && (
                                <motion.div
                                    key="discovery"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    {/* Similar Artists */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white">Discovery Gaps (Similar Artists)</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {data.global_stats.similar_artists.map((s, idx) => (
                                                <div key={idx} className="group cursor-pointer">
                                                    <div className="aspect-square rounded-full overflow-hidden mb-2 bg-white/5 border border-white/10">
                                                        {s.image ? (
                                                            <img src={s.image} alt={s.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center"><Users className="w-8 h-8 text-spotify-grey" /></div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold text-center text-white truncate">{s.name}</div>
                                                    <div className="text-[10px] text-center text-spotify-grey uppercase tracking-widest">{Math.round(s.match * 100)}% Match</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Top Albums */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white">Popular Albums</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {data.global_stats.top_albums.map((album, idx) => (
                                                <div key={idx} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                                        {album.image ? (
                                                            <img src={album.image} alt={album.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center"><Disc className="w-6 h-6 text-spotify-grey" /></div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-white font-bold truncate">{album.name}</div>
                                                        <div className="text-xs text-spotify-grey">{Number(album.playcount).toLocaleString()} plays</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'bio' && (
                                <motion.div
                                    key="bio"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="prose prose-invert max-w-none"
                                >
                                    <div
                                        className="text-spotify-grey leading-relaxed text-lg"
                                        dangerouslySetInnerHTML={{ __html: data.bio || "No biography available for this artist." }}
                                    />
                                    <a
                                        href={`https://www.last.fm/music/${encodeURIComponent(artist)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-8 text-spotify-green hover:underline font-bold"
                                    >
                                        View on Last.fm <ExternalLink className="w-4 h-4" />
                                    </a>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-spotify-grey">
                            Failed to load deep dive data.
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-white/5 bg-white/5 flex justify-between items-center">
                    <div className="text-xs text-spotify-grey uppercase tracking-widest font-bold">
                        Artist Insights Powered by Last.fm
                    </div>
                    <div className="flex gap-4">
                        <button
                            className="bg-white text-black px-8 py-3 rounded-full text-sm font-black hover:scale-105 transition-transform"
                            onClick={() => window.open(`https://www.last.fm/music/${encodeURIComponent(artist)}`, '_blank')}
                        >
                            Open Artist Page
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
