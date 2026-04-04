export function SectionHeader({ title, description, actions }) {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
                <h2 className="text-lg font-semibold text-white md:text-xl">{title}</h2>
                {description ? <p className="mt-1 text-sm text-spotify-grey">{description}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    );
}
