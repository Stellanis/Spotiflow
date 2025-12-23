import React from 'react';
import { cn } from '../../utils';

export function BehaviorConfig({ updateInterval, setUpdateInterval, limitCount, setLimitCount, autoDownload, setAutoDownload }) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-white/10 pb-2">Behavior</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-spotify-grey">Update (min)</label>
                    <input
                        type="number"
                        value={updateInterval}
                        onChange={(e) => setUpdateInterval(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                        min="1"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-spotify-grey">Check Limit</label>
                    <input
                        type="number"
                        value={limitCount}
                        onChange={(e) => setLimitCount(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                        min="1"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/10">
                <div className="space-y-0.5">
                    <label className="text-sm font-medium text-white block">Auto Download</label>
                    <p className="text-xs text-spotify-grey">Download new scrobbles</p>
                </div>
                <button
                    onClick={() => setAutoDownload(!autoDownload)}
                    className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        autoDownload ? "bg-spotify-green" : "bg-white/10"
                    )}
                >
                    <div className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                        autoDownload ? "left-7" : "left-1"
                    )} />
                </button>
            </div>
        </div>
    );
}
