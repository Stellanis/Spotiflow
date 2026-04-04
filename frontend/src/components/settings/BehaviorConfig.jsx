import React from 'react';
import { cn } from '../../utils';

function ToggleRow({ label, description, value, onToggle }) {
    return (
        <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/10">
            <div className="space-y-0.5">
                <label className="text-sm font-medium text-white block">{label}</label>
                <p className="text-xs text-spotify-grey">{description}</p>
            </div>
            <button
                onClick={onToggle}
                className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    value ? "bg-spotify-green" : "bg-white/10"
                )}
            >
                <div className={cn(
                    "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                    value ? "left-7" : "left-1"
                )} />
            </button>
        </div>
    );
}

export function BehaviorConfig({
    updateInterval,
    setUpdateInterval,
    limitCount,
    setLimitCount,
    autoDownload,
    setAutoDownload,
    sessionGapMinutes,
    setSessionGapMinutes,
    recommendationAggressiveness,
    setRecommendationAggressiveness,
    enrichmentEnabled,
    setEnrichmentEnabled,
    releasesEnabled,
    setReleasesEnabled,
}) {
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
                <div className="space-y-2">
                    <label className="text-sm font-medium text-spotify-grey">Session Gap (min)</label>
                    <input
                        type="number"
                        value={sessionGapMinutes}
                        onChange={(e) => setSessionGapMinutes(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                        min="5"
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-spotify-grey">Recommendation Aggressiveness</label>
                    <select
                        value={recommendationAggressiveness}
                        onChange={(e) => setRecommendationAggressiveness(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                    >
                        <option value="balanced">Balanced</option>
                        <option value="adventurous">Adventurous</option>
                        <option value="familiar">Familiar</option>
                    </select>
                </div>

                <ToggleRow label="Auto Download" description="Download new scrobbles" value={autoDownload} onToggle={() => setAutoDownload(!autoDownload)} />
                <ToggleRow label="Canonical Enrichment" description="Maintain artist, album, and track identity data in the background" value={enrichmentEnabled} onToggle={() => setEnrichmentEnabled(!enrichmentEnabled)} />
                <ToggleRow label="Release Radar" description="Track new releases for artists that matter to you" value={releasesEnabled} onToggle={() => setReleasesEnabled(!releasesEnabled)} />
            </div>
        </div>
    );
}
