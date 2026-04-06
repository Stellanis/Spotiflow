import { Loader2, Radio } from 'lucide-react';

import { ArtistRadarCard } from '../../components/discover/ArtistRadarCard';

function EmptyState({ icon: Icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            {Icon ? <Icon className="mb-4 h-14 w-14 text-white/10" /> : null}
            <p className="max-w-xs text-sm text-spotify-grey">{message}</p>
        </div>
    );
}

export function ArtistRadarPanel({ loading, radar, onDownload }) {
    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-spotify-green" /></div>;
    }
    if (radar.length === 0) {
        return <EmptyState icon={Radio} message="No artist radar data yet. Check back after building more listening history." />;
    }
    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {radar.map((artist) => (
                <ArtistRadarCard key={artist.name} artist={artist} onDownload={onDownload} />
            ))}
        </div>
    );
}
