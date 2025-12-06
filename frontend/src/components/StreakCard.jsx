import React from 'react';
import { Flame } from 'lucide-react';
import { GlassCard } from './GlassCard';

export function StreakCard({ streak }) {
    if (streak === undefined || streak === null) return null;

    return (
        <GlassCard className="p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-orange-500/10 blur-3xl rounded-full transform scale-150 opacity-50 group-hover:opacity-75 transition-opacity" />

            <h3 className="text-lg font-semibold mb-2 text-spotify-grey uppercase tracking-wide z-10">Current Streak</h3>

            <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                    <Flame className={`w-16 h-16 ${streak > 0 ? 'text-orange-500 animate-pulse' : 'text-spotify-grey'}`} />
                    {streak > 0 && (
                        <div className="absolute inset-0 bg-orange-500 blur-lg opacity-40 animate-pulse" />
                    )}
                </div>

                <div className="mt-2 text-4xl font-bold text-white tracking-tighter">
                    {streak} <span className="text-lg font-normal text-spotify-grey">days</span>
                </div>
            </div>

            <p className="text-xs text-spotify-grey mt-2 z-10 text-center">
                {streak > 0 ? "Keep the flame alive!" : "Start listening to build a streak!"}
            </p>
        </GlassCard>
    );
}
