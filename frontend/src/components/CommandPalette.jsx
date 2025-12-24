import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search, Disc, CheckCircle, Music, Download,
    Hourglass, Trophy, Ticket, Settings, RefreshCw,
    Terminal, Command, Zap, Sparkles, History
} from 'lucide-react';
import { cn } from '../utils';

export function CommandPalette({ isOpen, onClose, username, onSync, onSettingsOpen }) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef(null);

    const items = [
        // Navigation
        { id: 'scrobbles', icon: Disc, label: 'Go to Recent Scrobbles', action: () => navigate('/') },
        { id: 'library', icon: CheckCircle, label: 'Go to Library', action: () => navigate('/library') },
        { id: 'playlists', icon: Music, label: 'Go to Playlists', action: () => navigate('/playlists') },
        { id: 'undownloaded', icon: Download, label: 'Go to Undownloaded', action: () => navigate('/undownloaded') },
        { id: 'stats', icon: Trophy, label: 'Go to Stats', action: () => navigate('/stats') },
        { id: 'concerts', icon: Ticket, label: 'Go to Concerts', action: () => navigate('/concerts') },
        { id: 'jobs', icon: Hourglass, label: 'Go to Background Jobs', action: () => navigate('/jobs') },

        // Actions
        { id: 'sync', icon: RefreshCw, label: 'Sync with Last.fm', action: () => { onSync(); onClose(); } },
        { id: 'vibe', icon: Zap, label: 'Generate Vibe Playlist', action: () => { window.dispatchEvent(new CustomEvent('open-vibe-generator')); onClose(); } },
        { id: 'gems', icon: History, label: 'Show Forgotten Gems', action: () => { navigate('/stats'); setTimeout(() => { window.dispatchEvent(new CustomEvent('scroll-to-gems')); }, 500); onClose(); } },
        { id: 'settings', icon: Settings, label: 'Open Settings', action: () => { onSettingsOpen(); onClose(); } },
    ];

    const filteredItems = items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredItems.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    filteredItems[selectedIndex].action();
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-4 border-b border-white/10 flex items-center gap-3">
                            <Search className="w-5 h-5 text-spotify-grey" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search for actions or pages..."
                                className="w-full bg-transparent border-none outline-none text-white text-lg placeholder:text-spotify-grey"
                            />
                            <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded border border-white/10 text-xs text-spotify-grey">
                                <Command className="w-3 h-3" />
                                <span>K</span>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-2">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item, index) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            item.action();
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                                            index === selectedIndex ? "bg-spotify-green text-black" : "text-spotify-grey hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                        {index === selectedIndex && (
                                            <div className="ml-auto text-xs opacity-60">Enter</div>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center text-spotify-grey">
                                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>No results found for "{query}"</p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-white/5 border-t border-white/10 flex justify-between items-center text-[10px] text-spotify-grey uppercase tracking-widest">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1"><span className="p-1 bg-white/10 rounded">↑↓</span> to navigate</span>
                                <span className="flex items-center gap-1"><span className="p-1 bg-white/10 rounded">↵</span> to select</span>
                            </div>
                            <div>Spotiflow Spotlight</div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
