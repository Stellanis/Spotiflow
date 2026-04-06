import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic2, Loader2, Music } from 'lucide-react';

export function LyricsModal({ isOpen, onClose, track, progress }) {
    const [lyrics, setLyrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [parsedLyrics, setParsedLyrics] = useState([]);
    const activeLineRef = useRef(null);

    useEffect(() => {
        if (isOpen && track) {
            fetchLyrics();
        } else {
            setLyrics(null);
            setParsedLyrics([]);
        }
    }, [isOpen, track?.artist, track?.title]);

    const fetchLyrics = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                artist_name: track.artist,
                track_name: track.title,
                duration: track.duration
            };
            const response = await axios.get('https://lrclib.net/api/get', { params });

            setLyrics(response.data);
            if (response.data.syncedLyrics) {
                setParsedLyrics(parseLrc(response.data.syncedLyrics));
            } else {
                setParsedLyrics([]);
            }
        } catch (err) {
            console.error("Failed to fetch lyrics", err);
            // Try search fallback
            try {
                const searchRes = await axios.get('https://lrclib.net/api/search', {
                    params: { q: `${track.artist} ${track.title}` }
                });
                if (searchRes.data && searchRes.data.length > 0) {
                    setLyrics(searchRes.data[0]);
                    if (searchRes.data[0].syncedLyrics) {
                        setParsedLyrics(parseLrc(searchRes.data[0].syncedLyrics));
                    }
                } else {
                    setError("Lyrics not found.");
                }
            } catch (fallbackErr) {
                setError("Lyrics not found.");
            }
        } finally {
            setLoading(false);
        }
    };

    const parseLrc = (lrc) => {
        const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        return lrc.split('\n').map(line => {
            const match = line.match(regex);
            if (!match) return null;
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3].padEnd(3, '0'));
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = match[4].trim();
            return { time, text };
        }).filter(Boolean);
    };

    const containerRef = useRef(null);

    // Find active line
    const activeIndex = parsedLyrics.findIndex((line, i) => {
        const nextLine = parsedLyrics[i + 1];
        return progress >= line.time && (!nextLine || progress < nextLine.time);
    });

    useEffect(() => {
        if (activeLineRef.current && containerRef.current) {
            const container = containerRef.current;
            const activeLine = activeLineRef.current;

            const containerH = container.clientHeight;
            const lineRect = activeLine.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Calculate relative position
            const offset = lineRect.top - containerRect.top;

            // Current scroll position
            const currentScroll = container.scrollTop;

            // Target scroll: We want the line relative top to be (containerH / 2) - (lineH / 2)
            // The scroll change needed is: offset - (containerH / 2) + (lineH / 2)
            // But 'offset' is based on *current* view. 
            // New position would be currentScroll + (offset - targetVisualTop)

            const targetVisualTop = (containerH / 2) - (lineRect.height / 2);
            const scrollAmount = offset - targetVisualTop;

            container.scrollTo({
                top: currentScroll + scrollAmount,
                behavior: 'smooth'
            });
        }
    }, [activeIndex]);



    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                    className="fixed inset-x-3 top-3 bottom-28 z-[8500] flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-black/80 shadow-[0_30px_80px_rgba(0,0,0,0.55)] md:inset-x-5 md:top-4 md:bottom-32 lg:left-[calc(19.5rem+1.5rem)] lg:right-6"
                >
                    {/* Dynamic Background with Blended Blur */}
                    <div className="absolute inset-0 z-0">
                        {track.image || track.image_url ? (
                            <div className="absolute inset-0">
                                <img
                                    src={track.image || track.image_url}
                                    className="w-full h-full object-cover blur-3xl opacity-60 scale-125"
                                    alt="Background"
                                />
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" />
                            </div>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
                    </div>

                    <div className="absolute top-6 right-6 z-50 md:right-8">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md border border-white/5"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                    </div>

                    <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-hidden p-6 pt-20 md:p-8 md:pt-24">
                        <div className="flex h-full min-h-0 w-full max-w-2xl flex-col items-center text-center">
                            <div className="mb-6 flex shrink-0 flex-col items-center gap-4 md:mb-8">
                                {(track.image || track.image_url) && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="w-24 h-24 rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10"
                                    >
                                        <img src={track.image || track.image_url} className="w-full h-full object-cover" alt="Album Art" />
                                    </motion.div>
                                )}
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-1 drop-shadow-lg">{track.title}</h2>
                                    <p className="text-xl text-white/70 drop-shadow-md">{track.artist}</p>
                                </div>
                            </div>

                            <div ref={containerRef} className="min-h-0 flex-1 w-full overflow-y-auto px-2 no-scrollbar">
                                {loading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Loader2 className="w-12 h-12 text-spotify-green animate-spin" />
                                    </div>
                                ) : error ? (
                                    <div className="h-full flex flex-col items-center justify-center text-white/50 gap-4">
                                        <Mic2 className="w-16 h-16 opacity-50" />
                                        <p className="text-xl">{error}</p>
                                    </div>
                                ) : parsedLyrics.length > 0 ? (
                                    <div className="space-y-8 py-[30vh] md:py-[34vh]">
                                        {parsedLyrics.map((line, i) => (
                                            <p
                                                key={i}
                                                ref={i === activeIndex ? activeLineRef : null}
                                                className={`text-2xl md:text-4xl font-bold transition-all duration-500 cursor-pointer select-none ${i === activeIndex
                                                    ? 'text-white scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                                                    : i < activeIndex
                                                        ? 'text-white/20 blur-[1px]'
                                                        : 'text-white/30'
                                                    }`}
                                            >
                                                {line.text}
                                            </p>
                                        ))}
                                    </div>
                                ) : lyrics?.plainLyrics ? (
                                    <div className="whitespace-pre-line text-2xl font-medium text-white/80 leading-loose">
                                        {lyrics.plainLyrics}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-white/50">
                                        <p>No lyrics available.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
