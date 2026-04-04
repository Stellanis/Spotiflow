export function ActionBar({ children }) {
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            {children}
        </div>
    );
}
