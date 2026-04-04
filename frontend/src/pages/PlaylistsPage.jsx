
import { Playlists } from '../components/Playlists';
import { PageHeader } from '../components/ui/PageHeader';

export default function PlaylistsPage() {
    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Act On Listening"
                title="Playlists built for curation, not clutter"
                description="Manual playlists, smart rules, and recommendations now sit inside a more productized playlist surface."
            />
            <Playlists />
        </div>
    );
}
