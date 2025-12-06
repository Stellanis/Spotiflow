import React from 'react';
import { GlassCard } from './GlassCard';
import { cn } from '../utils';

export function InsightCard({ title, icon: Icon, score, label, description, color = "green" }) {
    if (score === undefined || score === null) return null;

    const getColor = (c) => {
        if (c === "purple") return "text-purple-400";
        if (c === "blue") return "text-blue-400";
        if (c === "orange") return "text-orange-400";
        return "text-spotify-green";
    };

    const getBgColor = (c) => {
        if (c === "purple") return "bg-purple-500";
        if (c === "blue") return "bg-blue-500";
        if (c === "orange") return "bg-orange-500";
        return "bg-spotify-green";
    };

    return (
        <GlassCard className="p-6 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-spotify-grey uppercase tracking-wide flex items-center gap-2">
                    {Icon && <Icon className={cn("w-5 h-5", getColor(color))} />}
                    {title}
                </h3>
                <div className={cn("text-2xl font-bold", getColor(color))}>
                    {score}<span className="text-sm text-spotify-grey font-normal">/100</span>
                </div>
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-2xl font-bold text-white tracking-tight">{label}</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-1000 ease-out", getBgColor(color))}
                        style={{ width: `${score}%` }}
                    />
                </div>

                <p className="text-xs text-spotify-grey mt-3 leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Background Decor */}
            <div className={cn("absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20", getBgColor(color))} />
        </GlassCard>
    );
}
