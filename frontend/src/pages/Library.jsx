import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, Download, Loader2, Music2, Play, RefreshCw, Search } from 'lucide-react';

import { usePlayer } from '../contexts/PlayerContext';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { GlassCard } from '../components/GlassCard';
import { TrackStatsModal } from '../components/TrackStatsModal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StatusBadge } from '../components/ui/StatusBadge';

const TABS = [
    { value: 'downloaded', label: 'Downloaded' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
];

const SORTS = [
    { value: 'recent', label: 'Most recent' },
    { value: 'artist', label: 'Artist' },
    { value: 'album', label: 'Album' },
    { value: 'title', label: 'Title' },
];

function normalizeStatus(tab) {
    if (tab === 'pending') return 'pending';
    if (tab === 'failed') return 'failed';
    return 'completed';
}

export default function Library() {
    const { username } = useOutletContext();
    const { playTrack, addToQueueNext, addToQueueEnd } = usePlayer();
    const [searchParams, setSearchParams] = useSearchParams();
    const [tracks, setTracks] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [sort, setSort] = useState(searchParams.get('sort') || 'recent');
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [playlistTrackToAdd, setPlaylistTrackToAdd] = useState(null);

    const activeTab = searchParams.get('tab') || 'downloaded';

    useEffect(() => {
        const timeout = window.setTimeout(async () => {
            setLoading(true);
            try {
                const [downloadsRes, summaryRes] = await Promise.all([
                    axios.get('/api/downloads', {
                        params: {
                            status: normalizeStatus(activeTab),
                            search: search || undefined,
                            limit: 200,
                        },
                    }),
                    axios.get('/api/dashboard/summary'),
                ]);
                setTracks(downloadsRes.data.items || []);
                setSummary(summaryRes.data);
            } catch (error) {
                console.error('Failed to load library', error);
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [activeTab, search]);

    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        if (search) next.set('q', search);
        else next.delete('q');
        if (sort !== 'recent') next.set('sort', sort);
        else next.delete('sort');
        setSearchParams(next, { replace: true });
    }, [search, searchParams, setSearchParams, sort]);

    const sortedTracks = useMemo(() => {
        const copy = [...tracks];
        if (sort === 'artist') copy.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
        if (sort === 'album') copy.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
        if (sort === 'title') copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        return copy;
    }, [sort, tracks]);

    const tabCounts = useMemo(
        () => ({
            downloaded: summary?.library?.total_downloaded ?? 0,
            pending: summary?.downloads?.pending ?? 0,
            failed: summary?.downloads?.failed ?? 0,
        }),
        [summary]
    );

    const handleBatchAction = async () => {
        try {
            if (activeTab === 'pending') {
                await axios.post('/api/download/all');
            } else if (activeTab === 'failed') {
                await axios.post('/api/download/retry-failed');
            }
            const response = await axios.get('/api/downloads', {
                params: { status: normalizeStatus(activeTab), search: search || undefined, limit: 200 },
            });
            setTracks(response.data.items || []);
        } catch (error) {
            console.error('Failed to run batch action', error);
        }
    };

    return (
        <div className="space-y-8">
            <TrackStatsModal isOpen={!!selectedTrack} onClose={() => setSelectedTrack(null)} track={selectedTrack} username={username} />
            <AddToPlaylistModal isOpen={!!playlistTrackToAdd} onClose={() => setPlaylistTrackToAdd(null)} track={playlistTrackToAdd} />

            <PageHeader
                title="Library"
                actions={
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white">
                        <span>{tabCounts[activeTab] ?? 0} items in this view</span>
                    </div>
                }
            />

            <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <SegmentedControl
                        items={TABS.map((tab) => ({ value: tab.value, label: `${tab.label} (${tabCounts[tab.value] ?? 0})` }))}
                        value={activeTab}
                        onChange={(value) => setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set('tab', value);
                            return next;
                        })}
                    />
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="relative min-w-[260px]">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-spotify-grey" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={`Search ${activeTab} tracks`}
                                className="w-full rounded-full border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-spotify-grey focus:border-white/25"
                            />
                        </label>
                        <select
                            value={sort}
                            onChange={(event) => setSort(event.target.value)}
                            className="rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors hover:bg-white/[0.06] focus:border-white/25"
                        >
                            {SORTS.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                        {(activeTab === 'pending' || activeTab === 'failed') && (
                            <button
                                type="button"
                                onClick={handleBatchAction}
                                className="rounded-full bg-spotify-green px-4 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01]"
                            >
                                {activeTab === 'pending' ? 'Queue all pending' : 'Retry failed'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <div className="pointer-events-none absolute inset-x-8 top-0 h-32 rounded-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_72%)] blur-3xl" />
                <SectionHeader
                    title={activeTab === 'downloaded' ? 'Downloaded library' : activeTab === 'pending' ? 'Pending downloads' : 'Failed downloads'}
                    actions={
                        activeTab === 'pending' ? <Link className="text-sm text-spotify-green" to="/jobs">Open queue</Link> : null
                    }
                />

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                    </div>
                ) : sortedTracks.length === 0 ? (
                    <div className="mt-6">
                        <EmptyState
                            icon={activeTab === 'failed' ? AlertCircle : Music2}
                            title={`No ${activeTab} tracks`}
                            action={
                                activeTab === 'pending' ? (
                                    <button
                                        type="button"
                                        onClick={handleBatchAction}
                                        className="rounded-full bg-spotify-green px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.01]"
                                    >
                                        Queue pending tracks
                                    </button>
                                ) : null
                            }
                        />
                    </div>
                ) : (
                    <div className="relative z-10 mt-6 space-y-3">
                        {sortedTracks.map((track, index) => {
                            const canPlay = activeTab === 'downloaded' && Boolean(track.audio_url);
                            return (
                                <GlassCard
                                    key={`${track.query || `${track.artist}-${track.title}`}-${index}`}
                                    image={track.image_url}
                                    className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/30 px-4 py-4 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="relative z-10 flex min-w-0 items-center gap-4">
                                        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white/5">
                                            {track.image_url ? (
                                                <img src={track.image_url} alt={track.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <Music2 className="h-5 w-5 text-white/25" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-base font-medium text-white">{track.title}</div>
                                            <div className="truncate text-sm text-spotify-grey">{track.artist}</div>
                                            <div className="truncate text-xs text-white/35">{track.album || 'No album metadata'}</div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex flex-wrap items-center gap-2 md:justify-end">
                                        <StatusBadge status={track.status || normalizeStatus(activeTab)} />
                                        {canPlay ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => playTrack(track, sortedTracks)}
                                                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.08]"
                                                >
                                                    <Play className="h-4 w-4" />
                                                    Play now
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => addToQueueNext(track)}
                                                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.08]"
                                                >
                                                    Play next
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => addToQueueEnd(track)}
                                                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.08]"
                                                >
                                                    Add to queue
                                                </button>
                                            </>
                                        ) : null}
                                        {activeTab === 'downloaded' ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTrack(track)}
                                                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.08]"
                                                >
                                                    Inspect
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPlaylistTrackToAdd(track)}
                                                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.08]"
                                                >
                                                    Add to playlist
                                                </button>
                                            </>
                                        ) : null}
                                        {activeTab === 'pending' ? (
                                            <button
                                                type="button"
                                                onClick={() => axios.post('/api/download', {
                                                    query: track.query,
                                                    artist: track.artist,
                                                    title: track.title,
                                                    album: track.album,
                                                    image: track.image_url,
                                                })}
                                                className="inline-flex items-center gap-2 rounded-full bg-spotify-green px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.01]"
                                            >
                                                <Download className="h-4 w-4" />
                                                Queue
                                            </button>
                                        ) : null}
                                        {activeTab === 'failed' ? (
                                            <button
                                                type="button"
                                                onClick={handleBatchAction}
                                                className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/20"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Retry
                                            </button>
                                        ) : null}
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
