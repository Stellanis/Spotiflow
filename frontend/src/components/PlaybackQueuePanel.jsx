import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListMusic, Radio, Trash2, X } from 'lucide-react';

import { usePlayer } from '../contexts/PlayerContext';
import { cn } from '../utils';

function QueueRow({ item, isCurrent, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.track_key,
        disabled: isCurrent,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3',
                isDragging && 'opacity-80 shadow-lg',
                isCurrent && 'border-spotify-green/40 bg-spotify-green/10'
            )}
        >
            <button
                type="button"
                className={cn('text-spotify-grey', isCurrent ? 'cursor-default opacity-40' : 'cursor-grab hover:text-white')}
                {...(!isCurrent ? attributes : {})}
                {...(!isCurrent ? listeners : {})}
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/5">
                {item.image ? (
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                ) : null}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{item.title}</div>
                <div className="truncate text-xs text-spotify-grey">{item.artist}</div>
            </div>
            <div className="flex items-center gap-2">
                {item.queue_source === 'radio' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-spotify-green/15 px-2 py-1 text-[10px] text-spotify-green">
                        <Radio className="h-3 w-3" />
                        Radio
                    </span>
                ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">Manual</span>
                )}
                {!isCurrent ? (
                    <button type="button" onClick={() => onRemove(item.track_key)} className="text-spotify-grey hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export function PlaybackQueuePanel() {
    const {
        showQueuePanel,
        setShowQueuePanel,
        queue,
        queueIndex,
        queueSummary,
        hasSuspendedRadio,
        reorderQueue,
        removeFromQueue,
        clearUpcoming,
        restartRadio,
    } = usePlayer();
    const sensors = useSensors(useSensor(PointerSensor));
    const [localOrder, setLocalOrder] = useState(null);

    const currentTrack = queue[queueIndex] || null;
    const upcoming = useMemo(() => (queueIndex >= 0 ? queue.slice(queueIndex + 1) : queue), [queue, queueIndex]);
    const displayedUpcoming = localOrder || upcoming;

    const handleDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = displayedUpcoming.findIndex((item) => item.track_key === active.id);
        const newIndex = displayedUpcoming.findIndex((item) => item.track_key === over.id);
        const nextOrder = arrayMove(displayedUpcoming, oldIndex, newIndex);
        setLocalOrder(nextOrder);
        await reorderQueue(nextOrder.map((item) => item.track_key));
        setLocalOrder(null);
    };

    const handleRemove = async (trackKey) => {
        await removeFromQueue(trackKey);
    };

    return (
        <AnimatePresence>
            {showQueuePanel ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9100] bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowQueuePanel(false)}
                >
                    <motion.div
                        initial={{ x: 380 }}
                        animate={{ x: 0 }}
                        exit={{ x: 380 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-[#0c0c0d] p-5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-white">
                                    <ListMusic className="h-5 w-5 text-spotify-green" />
                                    <h2 className="text-lg font-semibold">Playback Queue</h2>
                                </div>
                                <p className="mt-1 text-sm text-spotify-grey">
                                    {queueSummary?.remaining ?? 0} upcoming tracks
                                </p>
                            </div>
                            <button type="button" onClick={() => setShowQueuePanel(false)} className="text-spotify-grey hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-5 space-y-3">
                            {currentTrack ? (
                                <div>
                                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-spotify-grey">Now Playing</div>
                                    <QueueRow item={currentTrack} isCurrent onRemove={() => {}} />
                                </div>
                            ) : null}

                            <div className="flex items-center justify-between">
                                <div className="text-xs uppercase tracking-[0.2em] text-spotify-grey">Up Next</div>
                                <div className="flex items-center gap-2">
                                    {hasSuspendedRadio ? (
                                        <button
                                            type="button"
                                            onClick={() => restartRadio(currentTrack)}
                                            className="rounded-full border border-spotify-green/30 bg-spotify-green/10 px-3 py-1 text-xs text-spotify-green"
                                        >
                                            Restart radio
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={clearUpcoming}
                                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
                                    >
                                        Clear upcoming
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
                                {displayedUpcoming.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-spotify-grey">
                                        No upcoming tracks queued.
                                    </div>
                                ) : (
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext items={displayedUpcoming.map((item) => item.track_key)} strategy={verticalListSortingStrategy}>
                                            {displayedUpcoming.map((item) => (
                                                <QueueRow key={item.track_key} item={item} onRemove={handleRemove} />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
