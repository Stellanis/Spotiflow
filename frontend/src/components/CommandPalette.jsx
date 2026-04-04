import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, FolderOpen, Home, ListMusic, RefreshCw, Search, Settings, Sparkles, Terminal, Ticket, Workflow } from 'lucide-react';
import { cn } from '../utils';

export function CommandPalette({ isOpen, onClose, onSync, onSettingsOpen }) {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const items = useMemo(
        () => [
            { id: 'home', label: 'Go to Home', icon: Home, action: () => navigate('/') },
            { id: 'library', label: 'Go to Library', icon: FolderOpen, action: () => navigate('/library') },
            { id: 'discover', label: 'Go to Explore: Discover', icon: Compass, action: () => navigate('/explore/discover') },
            { id: 'stats', label: 'Go to Explore: Stats', icon: Sparkles, action: () => navigate('/explore/stats') },
            { id: 'playlists', label: 'Go to Playlists', icon: ListMusic, action: () => navigate('/playlists') },
            { id: 'concerts', label: 'Go to Concerts', icon: Ticket, action: () => navigate('/concerts') },
            { id: 'queue', label: 'Go to Queue', icon: Workflow, action: () => navigate('/jobs') },
            { id: 'sync', label: 'Sync recent listening', icon: RefreshCw, action: () => onSync() },
            { id: 'settings', label: 'Open settings', icon: Settings, action: () => onSettingsOpen() },
        ],
        [navigate, onSettingsOpen, onSync]
    );

    const filteredItems = useMemo(
        () => items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
        [items, query]
    );

    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        setSelectedIndex(0);
        window.setTimeout(() => inputRef.current?.focus(), 30);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((current) => (filteredItems.length ? (current + 1) % filteredItems.length : 0));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((current) => (filteredItems.length ? (current - 1 + filteredItems.length) % filteredItems.length : 0));
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const current = filteredItems[selectedIndex];
                if (current) {
                    current.action();
                    onClose();
                }
            } else if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredItems, isOpen, onClose, selectedIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh]">
            <button type="button" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close command palette" />

            <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#121212] shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                    <Search className="h-5 w-5 text-spotify-grey" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search pages and actions..."
                        className="w-full bg-transparent text-lg text-white outline-none placeholder:text-spotify-grey"
                    />
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {filteredItems.length === 0 ? (
                        <div className="px-4 py-10 text-center text-spotify-grey">
                            <Terminal className="mx-auto mb-3 h-8 w-8 opacity-40" />
                            <p>No actions match “{query}”.</p>
                        </div>
                    ) : (
                        filteredItems.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    item.action();
                                    onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors',
                                    index === selectedIndex ? 'bg-white text-black' : 'text-spotify-grey hover:bg-white/5 hover:text-white'
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
