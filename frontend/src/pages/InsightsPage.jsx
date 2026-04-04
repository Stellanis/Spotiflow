import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, RefreshCw } from 'lucide-react';

import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatusBadge } from '../components/ui/StatusBadge';

function MetricCard({ label, value, hint }) {
    return (
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm text-spotify-grey">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
            {hint ? <div className="mt-2 text-sm text-spotify-grey">{hint}</div> : null}
        </div>
    );
}

export default function InsightsPage() {
    const [overview, setOverview] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [albums, setAlbums] = useState(null);
    const [timecapsule, setTimecapsule] = useState(null);
    const [gaps, setGaps] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [overviewRes, sessionsRes, albumsRes, capsuleRes, gapsRes] = await Promise.all([
                axios.get('/api/insights/overview'),
                axios.get('/api/insights/sessions'),
                axios.get('/api/insights/albums'),
                axios.get('/api/insights/timecapsule'),
                axios.get('/api/gaps'),
            ]);
            setOverview(overviewRes.data);
            setSessions(sessionsRes.data.items || []);
            setAlbums(albumsRes.data);
            setTimecapsule(capsuleRes.data);
            setGaps(gapsRes.data);
        } catch (error) {
            console.error('Failed to load insights', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Insights"
                title="Personal listening intelligence"
                description="Sessions, album journeys, listening memory, and collection gaps now live together as your reflective layer."
                actions={
                    <button
                        type="button"
                        onClick={load}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
                    >
                        <span className="inline-flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Refresh insights
                        </span>
                    </button>
                }
            />

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                </div>
            ) : !overview ? (
                <EmptyState title="Insights unavailable" description="Configure Last.fm and run a sync to generate your first sessions and album journeys." />
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <MetricCard label="Sessions" value={overview.session_count || 0} hint="Auto-detected listening sessions from your scrobbles" />
                        <MetricCard label="Longest recent session" value={`${overview.longest_session?.duration_minutes || 0} min`} hint={overview.longest_session?.dominant_artist || 'No recent session'} />
                        <MetricCard label="Discovery ratio leader" value={`${Math.round((overview.best_discovery_session?.discovery_ratio || 0) * 100)}%`} hint={overview.best_discovery_session?.summary || 'No discovery sessions yet'} />
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                        <SectionHeader title="Weekly digest" description={overview.digest?.summary} />
                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                            {(overview.digest?.highlights || []).map((item) => (
                                <div key={item} className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/85">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                            <SectionHeader title="Recent sessions" description="Grouped automatically using your scrobble timeline." />
                            <div className="mt-5 space-y-3">
                                {sessions.slice(0, 8).map((session) => (
                                    <div key={`${session.started_at}-${session.finished_at}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="font-medium text-white">{session.dominant_artist || 'Mixed session'}</div>
                                                <div className="text-sm text-spotify-grey">{session.summary}</div>
                                            </div>
                                            <StatusBadge status={session.album_focused ? 'complete' : session.shuffle_heavy ? 'warning' : 'active'}>
                                                {session.album_focused ? 'Album-focused' : session.shuffle_heavy ? 'Shuffle-heavy' : 'Balanced'}
                                            </StatusBadge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-spotify-grey">
                                            <span>{session.scrobble_count} scrobbles</span>
                                            <span>{session.duration_minutes} minutes</span>
                                            <span>Discovery {Math.round((session.discovery_ratio || 0) * 100)}%</span>
                                            <span>Repeat {Math.round((session.repeat_ratio || 0) * 100)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                            <SectionHeader title="Album journeys" description="Albums you revisit heavily, half-finish, or likely play front to back." />
                            <div className="mt-5 grid gap-4">
                                <div>
                                    <div className="mb-2 text-sm font-medium text-white">Most revisited</div>
                                    <div className="space-y-2">
                                        {(albums?.most_revisited || []).slice(0, 5).map((item) => (
                                            <div key={`${item.artist}-${item.album}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                                                {item.artist} - {item.album}
                                                <span className="ml-2 text-spotify-grey">{item.playcount} plays</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-2 text-sm font-medium text-white">Abandoned early</div>
                                    <div className="space-y-2">
                                        {(albums?.abandoned_early || []).slice(0, 5).map((item) => (
                                            <div key={`${item.artist}-${item.album}-abandoned`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                                                {item.artist} - {item.album}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                            <SectionHeader title="Time capsule" description="Past eras and seasonal patterns resurfacing from your library." />
                            <div className="mt-5 space-y-3">
                                {(timecapsule?.eras || []).slice(0, 5).map((era) => (
                                    <div key={era.year} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                        <div className="font-medium text-white">{era.year}</div>
                                        <div className="mt-2 text-sm text-spotify-grey">
                                            {(era.top_artists || []).map((artist) => `${artist.artist} (${artist.plays})`).join(' · ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                            <SectionHeader title="Vanished artists" description="Artists who once dominated your listening but have faded from the current rotation." />
                            <div className="mt-5 space-y-2">
                                {(timecapsule?.vanished_artists || []).slice(0, 8).map((artist) => (
                                    <div key={artist.artist} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                                        {artist.artist}
                                        <span className="ml-2 text-spotify-grey">{artist.historical_plays} historical plays</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                        <SectionHeader title="Gap finder" description="Top missing tracks, thin artist coverage, and likely collection holes." />
                        <div className="mt-5 grid gap-6 xl:grid-cols-3">
                            <div>
                                <div className="mb-2 text-sm font-medium text-white">Missing top tracks</div>
                                <div className="space-y-2">
                                    {(gaps?.missing_top_tracks || []).slice(0, 5).map((item) => (
                                        <div key={`${item.artist}-${item.title}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                                            {item.artist} - {item.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="mb-2 text-sm font-medium text-white">Weak artist coverage</div>
                                <div className="space-y-2">
                                    {(gaps?.weak_artist_coverage || []).slice(0, 5).map((item) => (
                                        <div key={item.artist} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                                            {item.artist}
                                            <span className="ml-2 text-spotify-grey">{item.local_tracks} local tracks</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="mb-2 text-sm font-medium text-white">Sparse albums</div>
                                <div className="space-y-2">
                                    {(gaps?.sparse_albums || []).slice(0, 5).map((item) => (
                                        <div key={`${item.artist}-${item.album}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                                            {item.artist} - {item.album}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
