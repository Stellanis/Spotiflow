import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Smile } from 'lucide-react';

import { MoodPill } from '../../components/discover/MoodPill';
import { ForYouPanel } from './ForYouPanel';

function EmptyState({ icon: Icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            {Icon ? <Icon className="mb-4 h-14 w-14 text-white/10" /> : null}
            <p className="max-w-xs text-sm text-spotify-grey">{message}</p>
        </div>
    );
}

export function MoodStationsPanel({
    loading,
    stations,
    selectedMood,
    setSelectedMood,
    currentMoodTracks,
    downloading,
    currentTrack,
    onDownload,
    onPlay,
    onFeedback,
    onPlayNext,
    onAddToQueue,
}) {
    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-spotify-green" /></div>;
    }
    if (stations.length === 0) {
        return <EmptyState icon={Smile} message="Mood stations will appear here once we know your genre preferences." />;
    }
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                {stations.map((station) => (
                    <MoodPill
                        key={station.mood}
                        mood={station.mood}
                        count={station.tracks.length}
                        selected={selectedMood === station.mood}
                        onClick={() => setSelectedMood(station.mood)}
                    />
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={selectedMood} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {currentMoodTracks.length === 0 ? (
                        <EmptyState icon={Smile} message="No tracks found for this mood." />
                    ) : (
                        <ForYouPanel
                            tracks={currentMoodTracks}
                            downloading={downloading}
                            currentTrack={currentTrack}
                            onDownload={onDownload}
                            onPlay={onPlay}
                            onFeedback={onFeedback}
                            onPlayNext={onPlayNext}
                            onAddToQueue={onAddToQueue}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
