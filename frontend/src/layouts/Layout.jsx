import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Compass, FolderOpen, House, ListMusic, RefreshCw, Settings2, Sparkles, Ticket, Workflow } from 'lucide-react';
import axios from 'axios';

import { useSettings } from '../hooks/useSettings';
import { TutorialModal } from '../TutorialModal';
import { PlayerBar } from '../components/PlayerBar';
import { LyricsModal } from '../components/LyricsModal';
import { CommandPalette } from '../components/CommandPalette';
import { ArtistModal } from '../components/ArtistModal';
import { usePlayer } from '../contexts/PlayerContext';
import { cn } from '../utils';

const PRIMARY_NAV = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/library', label: 'Library', icon: FolderOpen },
    { to: '/explore/discover', label: 'Explore', icon: Compass },
    { to: '/insights', label: 'Insights', icon: Sparkles },
    { to: '/playlists', label: 'Playlists', icon: ListMusic },
    { to: '/releases', label: 'Releases', icon: Ticket },
    { to: '/concerts', label: 'Concerts', icon: Ticket },
];

const SECONDARY_NAV = [
    { to: '/jobs', label: 'Queue', icon: Workflow },
    { to: '/settings', label: 'Settings', icon: Settings2 },
];

export default function Layout() {
    const navigate = useNavigate();
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
        closeTutorial,
    } = useSettings();
    const { showLyrics, setShowLyrics, currentTrack, progress, playTrack } = usePlayer();

    const [isSyncing, setIsSyncing] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [selectedArtist, setSelectedArtist] = useState(null);

    const navItems = useMemo(
        () => PRIMARY_NAV.filter((item) => !hiddenFeatures.has(item.label.toLowerCase())),
        [hiddenFeatures]
    );

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsCommandPaletteOpen((current) => !current);
            }
        };
        const handleOpenArtist = (event) => setSelectedArtist(event.detail);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-artist-deep-dive', handleOpenArtist);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-artist-deep-dive', handleOpenArtist);
        };
    }, []);

    const handleSync = async () => {
        if (!username || isSyncing) return;
        setIsSyncing(true);
        try {
            await axios.post('/api/scrobbles/sync');
        } catch (error) {
            console.error('Sync failed', error);
        } finally {
            window.setTimeout(() => setIsSyncing(false), 1200);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Toaster position="bottom-right" toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' } }} />

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1880px] gap-6 px-3 pt-4 md:px-5 lg:px-6">
                <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl lg:flex">
                    <div className="mb-8 flex items-center gap-3">
                        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-semibold', autoDownload ? 'bg-spotify-green text-black' : 'bg-red-500 text-white')}>
                            S
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-spotify-grey">Listening Hub</p>
                            <h1 className="text-2xl font-semibold text-white">Spotiflow</h1>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-spotify-grey">Primary</p>
                        {navItems.map(({ to, label, icon: Icon, end }) => (
                            <NavLink
                                key={to}
                                end={end}
                                to={to}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                                        isActive ? 'bg-spotify-green text-white shadow-lg shadow-spotify-green/20' : 'text-spotify-grey hover:bg-white/5 hover:text-white'
                                    )
                                }
                            >
                                <Icon className="h-5 w-5" />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="mt-8 space-y-2">
                        <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-spotify-grey">More</p>
                        {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                                        isActive ? 'bg-spotify-green text-white shadow-lg shadow-spotify-green/20' : 'text-spotify-grey hover:bg-white/5 hover:text-white'
                                    )
                                }
                            >
                                <Icon className="h-5 w-5" />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="mt-auto space-y-3 rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-spotify-grey">Current User</p>
                            <p className="mt-2 text-lg font-medium text-white">{username || 'Not configured'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/settings')}
                                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
                            >
                                Settings
                            </button>
                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={!username || isSyncing}
                                className="rounded-2xl bg-spotify-green px-4 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                                    Sync
                                </span>
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1 pb-32">
                    <div className="mb-6 flex items-center justify-between rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl lg:hidden">
                        <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-spotify-grey">Spotiflow</p>
                            <p className="text-base font-semibold text-white">{username || 'Setup required'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={!username || isSyncing}
                                className="rounded-full border border-white/10 p-3 text-white disabled:opacity-50"
                            >
                                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/settings')}
                                className="rounded-full border border-white/10 p-3 text-white"
                            >
                                <Settings2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <Outlet
                        context={{
                            username,
                            isSyncing,
                            handleSync,
                            autoDownload,
                            openSettings: () => navigate('/settings'),
                            onSettingsSaved: (newUsername, newAutoDownload, newHiddenFeatures) => {
                                setUsername(newUsername);
                                setAutoDownload(newAutoDownload);
                                setHiddenFeatures(new Set(newHiddenFeatures));
                            },
                            onReplayTutorial: () => setShowTutorial(true),
                        }}
                    />
                </main>
            </div>

            <div className="fixed inset-x-4 bottom-24 z-40 flex justify-center lg:hidden">
                <div className="flex w-full max-w-xl items-center justify-between rounded-full border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-2xl">
                    {navItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            end={end}
                            to={to}
                            className={({ isActive }) =>
                                cn(
                                    'flex flex-1 flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-medium transition-colors',
                                    isActive ? 'bg-spotify-green text-white shadow-lg shadow-spotify-green/20' : 'text-spotify-grey'
                                )
                            }
                        >
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </div>
            </div>

            <TutorialModal
                isOpen={showTutorial}
                onClose={closeTutorial}
                onTutorialComplete={(newUsername) => setUsername(newUsername)}
            />

            <PlayerBar />

            <LyricsModal isOpen={showLyrics} onClose={() => setShowLyrics(false)} track={currentTrack} progress={progress} />

            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                username={username}
                onSync={handleSync}
                onSettingsOpen={() => navigate('/settings')}
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
