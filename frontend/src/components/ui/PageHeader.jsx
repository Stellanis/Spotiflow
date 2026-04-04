export function PageHeader({ eyebrow, title, description, actions }) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
                {eyebrow ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-spotify-green/80">
                        {eyebrow}
                    </p>
                ) : null}
                <div className="space-y-1">
                    <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{title}</h1>
                    {description ? <p className="max-w-2xl text-sm text-spotify-grey md:text-base">{description}</p> : null}
                </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
    );
}
