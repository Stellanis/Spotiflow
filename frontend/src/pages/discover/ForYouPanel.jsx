import { AlertCircle, Compass } from 'lucide-react';

import { DiscoverTrackCard } from '../../components/discover/DiscoverTrackCard';
import { SkeletonCard } from '../../components/SkeletonCard';

function SkeletonGrid({ count = 12 }) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} type="vertical" />
            ))}
        </div>
    );
}

function EmptyState({ icon: Icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            {Icon ? <Icon className="mb-4 h-14 w-14 text-white/10" /> : null}
            <p className="max-w-xs text-sm text-spotify-grey">{message}</p>
        </div>
    );
}

function TrackGrid({ tracks, downloading, currentTrack, onDownload, onPlay, onDismiss, onFeedback, onPlayNext, onAddToQueue }) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {tracks.map((track, index) => {
                const query = `${track.artist} - ${track.title}`;
                return (
                    <DiscoverTrackCard
                        key={`${track.artist}-${track.title}-${index}`}
                        track={track}
                        status={downloading[query] || 'idle'}
                        onDownload={onDownload}
                        onPlay={track.audio_url || track.is_streamable ? onPlay : undefined}
                        onPlayNext={track.audio_url || track.is_streamable ? onPlayNext : undefined}
                        onAddToQueue={track.audio_url || track.is_streamable ? onAddToQueue : undefined}
                        onDismiss={onDismiss}
                        onFeedback={onFeedback}
                        isCurrentlyPlaying={currentTrack?.title === track.title && currentTrack?.artist === track.artist}
                    />
                );
            })}
        </div>
    );
}

export function ForYouPanel(props) {
    if (props.loading) return <SkeletonGrid count={12} />;
    if (props.error) return <EmptyState icon={AlertCircle} message="Could not load recommendations. Check your Last.fm settings." />;
    if (props.tracks.length === 0) return <EmptyState icon={Compass} message="No recommendations yet. Listen to more tracks to build your profile." />;
    return <TrackGrid {...props} />;
}
