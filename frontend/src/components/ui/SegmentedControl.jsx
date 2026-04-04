import { cn } from '../../utils';

export function SegmentedControl({ items, value, onChange, className = '' }) {
    return (
        <div className={cn('inline-flex rounded-full border border-white/10 bg-white/5 p-1', className)}>
            {items.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    onClick={() => onChange(item.value)}
                    className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                        value === item.value
                            ? 'bg-white text-black'
                            : 'text-spotify-grey hover:text-white'
                    )}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
