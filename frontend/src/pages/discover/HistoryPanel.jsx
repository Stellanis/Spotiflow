import { History, Loader2 } from 'lucide-react';

import { HistoryWeekCard } from '../../components/discover/HistoryWeekCard';

function EmptyState({ icon: Icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            {Icon ? <Icon className="mb-4 h-14 w-14 text-white/10" /> : null}
            <p className="max-w-xs text-sm text-spotify-grey">{message}</p>
        </div>
    );
}

export function HistoryPanel({ loading, history }) {
    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-spotify-green" /></div>;
    }
    if (history.length === 0) {
        return <EmptyState icon={History} message="No historical data found. Start scrobbling to see this!" />;
    }
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {history.map((entry, index) => (
                <HistoryWeekCard key={entry.year} entry={entry} index={index} />
            ))}
        </div>
    );
}
