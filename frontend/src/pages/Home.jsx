import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Disc3, Download, FolderOpen, Loader2, RefreshCw, Settings2, Sparkles, Ticket, TriangleAlert } from 'lucide-react';

import { useLibrary } from '../hooks/useLibrary';
import { usePlayer } from '../contexts/PlayerContext';
import { SonicDiary } from '../components/SonicDiary';
import { TrackStatsModal } from '../components/TrackStatsModal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatHero } from '../components/ui/StatHero';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ActionBar } from '../components/ui/ActionBar';

function QuickAction({ to, label, description, icon: Icon, onClick }) {
    const content = (
        <div className="flex min-w-[180px] flex-1 items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]">
            <div className="rounded-2xl bg-white/10 p-3 text-white">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <div className="font-medium text-white">{label}</div>
                {description ? <div className="mt-1 text-sm text-spotify-grey">{description}</div> : null}
            </div>
        </div>
    );

    if (to) {
        return <Link to={to}>{content}</Link>;
    }

    return (
        <button type="button" onClick={onClick} className="text-left">
            {content}
        </button>
    );
}

export default function Home() {
    const { username, handleSync, isSyncing, openSettings, autoDownload } = useOutletContext();
    const { playTrack, addToQueueNext, addToQueueEnd } = usePlayer();
    const { scrobbles, loadingScrobbles, fetchScrobbles } = useLibrary(username);
    const [summary, setSummary] = useState(null);
    const [checklist, setChecklist] = useState(null);
    const [insights, setInsights] = useState(null);
    const [gaps, setGaps] = useState(null);
    const [selectedTrack, setSelectedTrack] = useState(null);

    useEffect(() => {
        if (username) {
            fetchScrobbles();
        }
    }, [fetchScrobbles, username]);

    useEffect(() => {
        const load = async () => {
            try {
                const [summaryRes, checklistRes, insightsRes, gapsRes] = await Promise.all([
                    axios.get('/api/dashboard/summary'),
                    axios.get('/api/health/checklist'),
                    axios.get('/api/insights/overview').catch(() => ({ data: null })),
                    axios.get('/api/gaps').catch(() => ({ data: null })),
                ]);
                setSummary(summaryRes.data);
                setChecklist(checklistRes.data);
                setInsights(insightsRes.data);
                setGaps(gapsRes.data);
            } catch (error) {
                console.error('Failed to load dashboard summary', error);
            }
        };

        load();
    }, [username, isSyncing]);

    const attentionItems = useMemo(
        () => (checklist?.items || []).filter((item) => item.status !== 'complete'),
        [checklist]
    );

    return (
        <div className="space-y-8">
            <TrackStatsModal
                isOpen={!!selectedTrack}
                onClose={() => setSelectedTrack(null)}
                track={selectedTrack}
                username={username}
            />

            <PageHeader
                title="Home"
                actions={
                    <>
                        <button
                            type="button"
                            onClick={handleSync}
                            disabled={!username || isSyncing}
                            className="rounded-full bg-spotify-green px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
                        >
                            <span className="inline-flex items-center gap-2">
                                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                Sync recent listening
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={openSettings}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
                        >
                            Open setup
                        </button>
                    </>
                }
            />

            {!checklist?.ready ? (
                <div className="rounded-[2rem] border border-amber-400/20 bg-amber-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-300" />
                        <div className="space-y-3">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Setup still needs attention</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {attentionItems.map((item) => (
                                    <StatusBadge key={item.id} status={item.status}>
                                        {item.label}
                                    </StatusBadge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatHero
                    label="Library"
                    value={summary?.library?.total_downloaded ?? 0}
                    hint="Downloaded tracks ready for playback"
                    accent="text-spotify-green"
                />
                <StatHero
                    label="Pending"
                    value={summary?.downloads?.pending ?? 0}
                    hint="Tracks waiting to be queued or processed"
                    accent="text-amber-300"
                />
                <StatHero
                    label="Failed"
                    value={summary?.downloads?.failed ?? 0}
                    hint="Tracks needing manual retry or investigation"
                    accent="text-red-300"
                />
                <StatHero
                    label="Highlights"
                    value={summary?.highlights?.recommendation_count ?? 0}
                    hint={`${summary?.highlights?.upcoming_concert_count ?? 0} upcoming concerts available`}
                    accent="text-sky-300"
                />
            </div>

            <ActionBar>
                <QuickAction to="/library?tab=pending" label="Review pending" icon={Download} />
                <QuickAction to="/jobs" label="Open queue" icon={Loader2} />
                <QuickAction to="/explore/discover" label="Explore taste" icon={Sparkles} />
                <QuickAction to="/concerts" label="See concerts" icon={Ticket} />
                <QuickAction onClick={openSettings} label="Fix setup" icon={Settings2} />
            </ActionBar>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                        <SectionHeader
                            title="Recent listening"
                        />

                        <div className="mt-5 space-y-3">
                            {loadingScrobbles ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                                </div>
                            ) : scrobbles.length === 0 ? (
                                <EmptyState
                                    icon={Disc3}
                                    title="No listening imported yet"
                                    action={
                                        <button
                                            type="button"
                                            onClick={handleSync}
                                            className="rounded-full bg-spotify-green px-4 py-2 text-sm font-medium text-black"
                                        >
                                            Start first sync
                                        </button>
                                    }
                                />
                            ) : (
                                scrobbles.slice(0, 8).map((track, index) => (
                                    <div
                                        key={`${track.timestamp || index}-${track.title}`}
                                        className="flex w-full items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                                    >
                                        <div className="flex min-w-0 items-center gap-4">
                                            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/5">
                                                {track.image ? (
                                                    <img src={track.image} alt={track.title} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center">
                                                        <Disc3 className="h-5 w-5 text-white/30" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate font-medium text-white">{track.title}</div>
                                                <div className="truncate text-sm text-spotify-grey">{track.artist}</div>
                                                {track.album ? <div className="truncate text-xs text-white/35">{track.album}</div> : null}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={track.downloaded ? 'completed' : 'warning'}>
                                                {track.downloaded ? 'Ready' : 'Needs download'}
                                            </StatusBadge>
                                            {track.downloaded ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => playTrack(track)}
                                                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/[0.06]"
                                                    >
                                                        Play now
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => addToQueueNext(track)}
                                                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/[0.06]"
                                                    >
                                                        Next
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => addToQueueEnd(track)}
                                                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/[0.06]"
                                                    >
                                                        Queue
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTrack(track)}
                                                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/[0.06]"
                                                >
                                                    Inspect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                        <SectionHeader title="System health" />
                        <div className="mt-5 space-y-3">
                            {(checklist?.items || []).map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/20 px-4 py-3">
                                    <div className="min-w-0">
                                        <div className="font-medium text-white">{item.label}</div>
                                        <div className="text-sm text-spotify-grey">
                                            {item.status === 'complete' ? 'Ready' : item.status === 'warning' ? 'Optional but useful' : 'Required for core flows'}
                                        </div>
                                    </div>
                                    <StatusBadge status={item.status} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                        <SectionHeader title="Overview" />
                        <div className="mt-5 grid gap-3">
                            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm font-medium text-white">Library pipeline</div>
                                <p className="mt-2 text-sm text-spotify-grey">
                                    Auto-download is <span className="text-white">{autoDownload ? 'enabled' : 'disabled'}</span>. There are{' '}
                                    <span className="text-white">{summary?.downloads?.pending ?? 0}</span> pending items and{' '}
                                    <span className="text-white">{summary?.downloads?.active ?? 0}</span> active downloads.
                                </p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm font-medium text-white">Taste intelligence</div>
                                <p className="mt-2 text-sm text-spotify-grey">
                                    Explore currently has <span className="text-white">{summary?.highlights?.recommendation_count ?? 0}</span> recommendation candidates waiting.
                                </p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm font-medium text-white">Listening digest</div>
                                <p className="mt-2 text-sm text-spotify-grey">
                                    {insights?.digest?.highlights?.[0] || 'Run a sync to generate a stronger personal digest.'}
                                </p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                <div className="text-sm font-medium text-white">Gap finder</div>
                                <p className="mt-2 text-sm text-spotify-grey">
                                    There are <span className="text-white">{gaps?.missing_top_tracks?.length ?? 0}</span> top missing tracks and{' '}
                                    <span className="text-white">{gaps?.weak_artist_coverage?.length ?? 0}</span> artists with weak local coverage.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <SectionHeader
                    title="Sonic diary"
                />
                <div className="mt-6">
                    {username ? (
                        <SonicDiary username={username} />
                    ) : (
                        <EmptyState
                            icon={AlertTriangle}
                            title="Add your Last.fm account first"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
