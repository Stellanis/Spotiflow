import { cn } from '../../../utils';

export function GenrePlaylistForm({ genreTag, setGenreTag, availableTags }) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-spotify-grey">Genre Tag</label>
            <input
                type="text"
                value={genreTag}
                onChange={(event) => setGenreTag(event.target.value)}
                className="mb-2 w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:border-pink-500 focus:outline-none"
                required
                placeholder="e.g. Rock, Indie, 90s..."
            />
            <div className="custom-scrollbar flex max-h-[100px] flex-wrap gap-2 overflow-y-auto p-1">
                {availableTags.map((tag) => (
                    <button
                        key={tag}
                        type="button"
                        onClick={() => setGenreTag(tag)}
                        className={cn(
                            'rounded-full border px-2 py-1 text-xs transition-colors',
                            genreTag.toLowerCase() === tag.toLowerCase()
                                ? 'border-pink-500 bg-pink-500 text-white'
                                : 'border-white/10 bg-white/5 text-spotify-grey hover:border-pink-500/50 hover:text-white'
                        )}
                    >
                        {tag}
                    </button>
                ))}
            </div>
        </div>
    );
}
