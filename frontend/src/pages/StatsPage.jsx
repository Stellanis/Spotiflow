
// StatsPage.jsx
import Stats from '../components/Stats';
import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import { TrackStatsModal } from '../components/TrackStatsModal';

export default function StatsPage() {
    const { username } = useOutletContext();
    const [selectedTrack, setSelectedTrack] = useState(null);

    return (
        <>
            <TrackStatsModal
                isOpen={!!selectedTrack}
                onClose={() => setSelectedTrack(null)}
                track={selectedTrack}
                username={username}
            />
            <Stats username={username} onTrackClick={setSelectedTrack} />
        </>
    );
}
