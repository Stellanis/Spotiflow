import { GripVertical, Music, Play, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '../../utils';

export function SortableSongRow({ song, index, playTrack, addToQueueNext, addToQueueEnd, handleRemoveSong, selectedPlaylist }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: song.query });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={(event) => {
                if (event.target.closest('button') || event.target.closest('.cursor-grab')) return;
                playTrack(song, selectedPlaylist.songs);
            }}
            className={cn(
                'group flex cursor-pointer touch-none select-none items-center gap-3 rounded-xl border border-transparent p-2 transition-all duration-200 active:scale-[0.99] hover:border-white/5 hover:bg-white/5 md:gap-4 md:p-3',
                isDragging ? 'scale-[1.02] bg-white/10 opacity-90 shadow-xl' : 'bg-transparent'
            )}
        >
            <div className="flex w-8 items-center justify-center gap-3 text-spotify-grey md:w-12">
                <div {...attributes} {...listeners} className="cursor-grab p-2 transition-opacity hover:text-white md:p-1 md:opacity-0 md:group-hover:opacity-100">
                    <GripVertical className="h-4 w-4" />
                </div>
                <span className="hidden w-4 text-center font-mono text-sm tabular-nums group-hover:hidden md:block">{index + 1}</span>
                <button
                    onClick={(event) => {
                        event.stopPropagation();
                        playTrack(song, selectedPlaylist.songs);
                    }}
                    className="hidden text-white transition-colors hover:text-spotify-green md:hidden md:group-hover:block"
                >
                    <Play className="h-4 w-4 fill-current" />
                </button>
            </div>

            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/10 shadow-sm md:h-12 md:w-12">
                {song.image_url ? (
                    <img src={song.image_url} alt="" className="h-full w-full object-cover pointer-events-none" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-spotify-grey/20">
                        <Music className="h-5 w-5 text-spotify-grey" />
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="truncate text-sm font-medium text-white transition-colors group-hover:text-spotify-green md:text-base">{song.title}</div>
                <div className="flex items-center gap-2 truncate text-xs text-spotify-grey md:text-sm">
                    <span>{song.artist}</span>
                    {song.album && (
                        <>
                            <span className="hidden h-1 w-1 rounded-full bg-spotify-grey/40 md:inline" />
                            <span className="hidden truncate opacity-80 md:inline">{song.album}</span>
                        </>
                    )}
                </div>
            </div>

            <button
                onClick={(event) => {
                    event.stopPropagation();
                    addToQueueNext(song);
                }}
                className="hidden rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.06] md:inline-flex"
                title="Play next"
            >
                Next
            </button>
            <button
                onClick={(event) => {
                    event.stopPropagation();
                    addToQueueEnd(song);
                }}
                className="hidden rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.06] md:inline-flex"
                title="Add to queue"
            >
                Queue
            </button>
            <button
                onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveSong(song.query);
                }}
                className="transform rounded-full p-2 text-spotify-grey transition-all hover:bg-red-500/10 hover:text-red-500 md:translate-x-2 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100"
                title="Remove from playlist"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}
