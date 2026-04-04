export function StatHero({ label, value, hint, accent = 'text-white' }) {
    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spotify-grey">{label}</p>
            <div className={`mt-3 text-3xl font-semibold tracking-tight ${accent}`}>{value}</div>
            {hint ? <p className="mt-2 text-sm text-spotify-grey">{hint}</p> : null}
        </div>
    );
}
