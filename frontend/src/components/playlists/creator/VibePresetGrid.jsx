export function VibePresetGrid({ vibePresets, loading, onSelect }) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {vibePresets.map((vibe) => (
                <button
                    key={vibe.id}
                    type="button"
                    onClick={() => onSelect(vibe)}
                    disabled={loading}
                    className="group rounded-xl border border-white/5 bg-white/5 p-4 text-left transition-all hover:bg-white/10 disabled:opacity-50"
                >
                    <div className="mb-2 flex items-center gap-3">
                        <span className="text-2xl">{vibe.icon}</span>
                        <div className="font-bold text-white transition-colors group-hover:text-spotify-green">{vibe.label}</div>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-spotify-grey">{vibe.description}</p>
                </button>
            ))}
        </div>
    );
}
