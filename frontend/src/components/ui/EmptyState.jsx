export function EmptyState({ icon: Icon, title, description, action }) {
    return (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            {Icon ? <Icon className="mx-auto mb-4 h-10 w-10 text-white/20" /> : null}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description ? <p className="mx-auto mt-2 max-w-md text-sm text-spotify-grey">{description}</p> : null}
            {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
        </div>
    );
}
