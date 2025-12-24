import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'; // Add useOutletContext export for convenience if needed, but usually we import from rrd
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import {
    Disc, CheckCircle, Music, Download, Hourglass, Trophy, Ticket,
    Settings, RefreshCw, Menu, X, Calendar
} from 'lucide-react';
import axios from 'axios';

import { useSettings } from '../hooks/useSettings';
import { GlassCard } from '../components/GlassCard';
import { SettingsModal } from '../SettingsModal';
import { TutorialModal } from '../TutorialModal';
import { PlayerBar } from '../components/PlayerBar';
import { LyricsModal } from '../components/LyricsModal';
import { CommandPalette } from '../components/CommandPalette';
import { ArtistModal } from '../components/ArtistModal';
import { usePlayer } from '../contexts/PlayerContext';
import { MobileMenu } from '../components/MobileMenu';
import { cn } from '../utils';

// Helper to access common context in pages
export function useLayoutContext() {
    return useOutletContext();
}

const API_URL = '/api';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();

    // Global Settings State
    const {
        username,
        setUsername,
        autoDownload,
        setAutoDownload,
        hiddenFeatures,
        setHiddenFeatures,
        showTutorial,
        setShowTutorial,
        fetchSettings,
        closeTutorial
    } = useSettings();

    // Player Context (for global LyricsModal)
    // Layout is inside PlayerProvider so we can use usePlayer
    const { showLyrics, setShowLyrics, currentTrack, progress, playTrack } = usePlayer();

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [selectedArtist, setSelectedArtist] = useState(null);

    // Derived view for highlighting
    const currentPath = location.pathname === '/' ? 'scrobbles' : location.pathname.slice(1);

    // Sync Logic (Global)
    const handleSync = async () => {
        if (!username) return;
        setIsSyncing(true);
        try {
            // Trigger sync
            await axios.post(`${API_URL}/scrobbles/sync`);

            // If we are on concerts, maybe sync concerts?
            // Original App.jsx had a unified handleSync in useLibrary that seemingly handled scrobbles.
            // But Concerts page has its own sync button usually?
            // The header button in App.jsx called onSync which called handleSync from useLibrary.

            // We'll expose a refresh trigger to the pages via context
            // For now, let's just wait a bit to simulate
            await new Promise(r => setTimeout(r, 2000));

            // In a real app we might want to invalidate queries/reload data
            // We will pass a "syncTrigger" timestamp to pages so they can refetch
        } catch (error) {
            console.error("Sync failed", error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Prefetch Stats (Moved from App.jsx)
    const prefetchStats = async (userOverride) => {
        const user = userOverride || username;
        if (!user) return;
        const periods = ['overall', '1month'];
        try {
            const promises = [
                ...periods.map(period => axios.get(`${API_URL}/stats/top-tracks/${user}`, { params: { period, limit: 50 } })),
                axios.get(`${API_URL}/stats/chart`, { params: { user, period: '1month' } }),
                axios.get(`${API_URL}/stats/listening-clock/${user}`, { params: { period: 'overall' } }),
                axios.get(`${API_URL}/stats/genre-breakdown/${user}`, { params: { period: 'overall' } }),
                axios.get(`${API_URL}/stats/on-this-day/${user}`),
                axios.get(`${API_URL}/stats/streak/${user}`),
                axios.get(`${API_URL}/stats/diversity/${user}`, { params: { period: 'overall' } }),
                axios.get(`${API_URL}/stats/mainstream/${user}`, { params: { period: 'overall' } }),
                axios.get(`${API_URL}/stats/top-artists/${user}`, { params: { period: 'overall', limit: 3 } })
            ];
            await Promise.all(promises);
        } catch (error) {
            console.error("Error prefetching stats:", error);
        }
    };

    const navItems = [
        { id: 'scrobbles', icon: Disc, label: 'Scrobbles', path: '/' },
        { id: 'library', icon: CheckCircle, label: 'Library', path: '/library' },
        { id: 'playlists', icon: Music, label: 'Playlists', path: '/playlists' },
        { id: 'undownloaded', icon: Download, label: 'Undownloaded', path: '/undownloaded' },
        { id: 'jobs', icon: Hourglass, label: 'Jobs', path: '/jobs' },
        { id: 'stats', icon: Trophy, label: 'Stats', path: '/stats' },
        { id: 'concerts', icon: Ticket, label: 'Concerts', path: '/concerts' },
    ].filter(item => !hiddenFeatures.has(item.id));

    useEffect(() => {
        fetchSettings();

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };

        const handleOpenArtist = (e) => {
            setSelectedArtist(e.detail);
        };

        // Swipe Gesture for Mobile Menu
        let touchStartX = 0;
        let touchStartY = 0;

        const handleTouchStart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        };

        const handleTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Check if it's a swipe from the left edge (first 40px)
            // And mostly horizontal
            if (touchStartX < 40 && diffX > 75 && Math.abs(diffY) < 50) {
                setIsMobileMenuOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-artist-deep-dive', handleOpenArtist);
        // Passive listener for better scrolling performance check
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-artist-deep-dive', handleOpenArtist);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground p-8 pb-32 transition-colors duration-300">
            <Toaster position="bottom-right" toastOptions={{
                style: { background: '#333', color: '#fff' },
            }} />

            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                navItems={navItems}
                currentPath={currentPath}
                onNavigate={(path) => {
                    navigate(path);
                    setIsMobileMenuOpen(false);
                }}
                username={username}
                onSync={handleSync}
                isSyncing={isSyncing}
                onSettingsOpen={() => setIsSettingsOpen(true)}
            />

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
                onClose={closeTutorial}
                onTutorialComplete={async (newUsername) => {
                    setUsername(newUsername);
                    await prefetchStats(newUsername);
                }}
            />

            <div className="w-full px-0 md:w-[95%] md:px-0 mx-auto space-y-4 md:space-y-8">
                {/* Header */}
                <GlassCard className="flex flex-col md:flex-row items-center justify-between p-3 md:p-6 gap-4 rounded-none md:rounded-2xl border-x-0 border-t-0 md:border md:border-white/10">
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
                                    onClick={() => navigate(item.path)}
                                    className={cn(
                                        "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 z-10 outline-none",
                                        currentPath === item.id ? "text-white" : "text-gray-400 hover:text-white"
                                    )}
                                >
                                    {currentPath === item.id && (
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

                        {/* Icons */}
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
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                        >
                            <Menu className="w-6 h-6" />
                        </motion.button>
                    </div>
                </GlassCard>

                {/* Page Content */}
                <Outlet context={{
                    username,
                    isSyncing,
                    handleSync, // Allow pages to trigger sync?
                    autoDownload,
                }} />
            </div>

            <PlayerBar />

            <LyricsModal
                isOpen={showLyrics}
                onClose={() => setShowLyrics(false)}
                track={currentTrack}
                progress={progress}
            />

            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                username={username}
                onSync={handleSync}
                onSettingsOpen={() => setIsSettingsOpen(true)}
            />

            <ArtistModal
                isOpen={!!selectedArtist}
                onClose={() => setSelectedArtist(null)}
                artist={selectedArtist}
                username={username}
                onTrackClick={playTrack}
            />
        </div>
    );
}
