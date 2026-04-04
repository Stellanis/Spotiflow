import { cn } from '../../utils';

const STATUS_STYLES = {
    complete: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    healthy: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    incomplete: 'border-red-400/30 bg-red-500/10 text-red-300',
    active: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
    queued: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    failed: 'border-red-400/30 bg-red-500/10 text-red-300',
    completed: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
};

export function StatusBadge({ status, children, className }) {
    const normalized = String(status || '').toLowerCase();
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize tracking-wide',
                STATUS_STYLES[normalized] || 'border-white/10 bg-white/5 text-white/70',
                className
            )}
        >
            {children || normalized}
        </span>
    );
}
