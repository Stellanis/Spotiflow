import { AnimatePresence, motion } from 'framer-motion';
import { Compass, RefreshCw, Sparkles, Radio, Smile, History } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import { usePlayer } from '../../contexts/PlayerContext';
import { cn } from '../../utils';
import { ArtistRadarPanel } from './ArtistRadarPanel';
import { DiscoverTabNav } from './DiscoverTabNav';
import { ForYouPanel } from './ForYouPanel';
import { HistoryPanel } from './HistoryPanel';
import { MoodStationsPanel } from './MoodStationsPanel';
import { useDiscoverData } from './useDiscoverData';

const TABS = [
    { id: 'foryou', label: 'For You', Icon: Sparkles },
    { id: 'radar', label: 'Artist Radar', Icon: Radio },
    { id: 'moods', label: 'Mood Stations', Icon: Smile },
    { id: 'history', label: 'This Week in History', Icon: History },
];

export default function DiscoverShell() {
    const { username } = useOutletContext();
    const { currentTrack, resolveAndPlayTrack, sendPlaybackEvent, addToQueueNext, addToQueueEnd } = usePlayer();
    const discover = useDiscoverData({ username, currentTrack, resolveAndPlayTrack, sendPlaybackEvent });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Compass className="h-5 w-5 text-spotify-green" />
                    Discover
                </h2>

                {discover.activeTab === 'foryou' && (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={discover.fetchRecommendations}
                        disabled={discover.recLoading}
                        className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                        <RefreshCw className={cn('h-4 w-4', discover.recLoading && 'animate-spin')} />
                        Refresh
                    </motion.button>
                )}
            </div>

            <DiscoverTabNav tabs={TABS} activeTab={discover.activeTab} setActiveTab={discover.setActiveTab} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={discover.activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                >
                    {discover.activeTab === 'foryou' && (
                        <ForYouPanel
                            loading={discover.recLoading}
                            error={discover.recError}
                            tracks={discover.visibleRecs}
                            downloading={discover.downloading}
                            currentTrack={currentTrack}
                            onDownload={discover.handleDownload}
                            onPlay={discover.handlePlay}
                            onDismiss={discover.handleDismiss}
                            onFeedback={discover.handleFeedback}
                            onPlayNext={addToQueueNext}
                            onAddToQueue={addToQueueEnd}
                        />
                    )}

                    {discover.activeTab === 'radar' && (
                        <ArtistRadarPanel loading={discover.radarLoading} radar={discover.radar} onDownload={discover.handleDownloadByParts} />
                    )}

                    {discover.activeTab === 'moods' && (
                        <MoodStationsPanel
                            loading={discover.moodsLoading}
                            stations={discover.stations}
                            selectedMood={discover.selectedMood}
                            setSelectedMood={discover.setSelectedMood}
                            currentMoodTracks={discover.currentMoodTracks}
                            downloading={discover.downloading}
                            currentTrack={currentTrack}
                            onDownload={discover.handleDownload}
                            onPlay={discover.handlePlay}
                            onFeedback={discover.handleFeedback}
                            onPlayNext={addToQueueNext}
                            onAddToQueue={addToQueueEnd}
                        />
                    )}

                    {discover.activeTab === 'history' && (
                        <HistoryPanel loading={discover.historyLoading} history={discover.history} />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
