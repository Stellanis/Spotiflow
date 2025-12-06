import { cn } from "../utils";

export function SkeletonCard({ className, type = 'horizontal' }) {
    if (type === 'vertical') {
        return (
            <div className={cn("glass-panel p-4 flex flex-col gap-3 aspect-square justify-between animate-pulse", className)}>
                <div className="w-full aspect-square bg-white/5 rounded-md mb-2" />
                <div className="space-y-2 w-full">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
            </div>
        )
    }

    return (
        <div className={cn("glass-panel p-4 flex items-center justify-between animate-pulse gap-4", className)}>
            <div className="flex items-center gap-4 w-full">
                <div className="w-16 h-16 bg-white/5 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-5 bg-white/10 rounded w-1/3" />
                    <div className="h-4 bg-white/5 rounded w-1/4" />
                </div>
            </div>
            <div className="w-10 h-10 bg-white/5 rounded-full flex-shrink-0" />
        </div>
    );
}
