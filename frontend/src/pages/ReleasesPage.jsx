import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, RefreshCw } from 'lucide-react';

import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatusBadge } from '../components/ui/StatusBadge';

export default function ReleasesPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/releases');
            setItems(response.data.items || []);
        } catch (error) {
            console.error('Failed to load releases', error);
        } finally {
            setLoading(false);
        }
    };

    const refresh = async () => {
        setRefreshing(true);
        try {
            await axios.post('/api/releases/refresh');
            await load();
        } catch (error) {
            console.error('Failed to refresh releases', error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Releases"
                title="Release radar"
                description="Recent albums, EPs, and singles from artists your listening history suggests you should care about."
                actions={
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={refreshing}
                        className="rounded-full bg-spotify-green px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
                    >
                        <span className="inline-flex items-center gap-2">
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh release radar
                        </span>
                    </button>
                }
            />

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <SectionHeader title="Tracked releases" description="This surface is personal-first: it focuses on your likely artists rather than global charts." />
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="mt-6">
                        <EmptyState title="No tracked releases yet" description="Run a refresh after syncing enough listening history to seed your watchlist." />
                    </div>
                ) : (
                    <div className="mt-6 grid gap-3">
                        {items.map((item) => (
                            <div key={`${item.artist}-${item.title}-${item.release_date}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-white">{item.title}</div>
                                        <div className="text-sm text-spotify-grey">{item.artist}</div>
                                        <div className="mt-2 text-xs text-white/45">{item.release_date || 'Unknown date'} · {item.release_type || 'Release'}</div>
                                    </div>
                                    <StatusBadge status={item.listened ? 'complete' : item.downloaded ? 'active' : 'queued'}>
                                        {item.listened ? 'Listened' : item.downloaded ? 'Downloaded' : 'New'}
                                    </StatusBadge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
