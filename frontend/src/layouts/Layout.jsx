import { useState } from 'react';
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
import { usePlayer } from '../contexts/PlayerContext';
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
    const { showLyrics, setShowLyrics, currentTrack, progress } = usePlayer();

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

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

    // Cleanup initial load (fetch settings)
    // useSettings usually does this? No, App.jsx called fetchSettings in useEffect.
    useState(() => {
        fetchSettings();
    });

    return (
        <div className="min-h-screen bg-background text-foreground p-8 pb-32 transition-colors duration-300">
            <Toaster position="bottom-right" toastOptions={{
                style: { background: '#333', color: '#fff' },
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
                onClose={closeTutorial}
                onTutorialComplete={async (newUsername) => {
                    setUsername(newUsername);
                    await prefetchStats(newUsername);
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
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                        >
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </motion.button>
                    </div>

                    {/* Mobile Menu */}
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
                                                navigate(item.path);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={cn(
                                                "w-full px-4 py-3 rounded-xl text-left font-medium transition-all flex items-center gap-3",
                                                currentPath === item.id
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
        </div>
    );
}
