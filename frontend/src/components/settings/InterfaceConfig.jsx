import React from 'react';
import { cn } from '../../utils';

export function InterfaceConfig({ hiddenFeatures, toggleFeature, features, isFirefox, disableFirefoxOpt, setDisableFirefoxOpt }) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-white/10 pb-2">Interface Visibility</h3>
            <div className="space-y-2">
                {features.map(feature => (
                    <div key={feature.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/10">
                        <span className="text-sm font-medium text-white">{feature.label}</span>
                        <button
                            onClick={() => toggleFeature(feature.id)}
                            className={cn(
                                "w-12 h-6 rounded-full transition-colors relative",
                                !hiddenFeatures.has(feature.id) ? "bg-spotify-green" : "bg-white/10"
                            )}
                        >
                            <div className={cn(
                                "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                                !hiddenFeatures.has(feature.id) ? "left-7" : "left-1"
                            )} />
                        </button>
                    </div>
                ))}
            </div>


            {
                isFirefox && (
                    <div className="pt-4 mt-4 border-t border-white/10">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Browser Performance</h3>
                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/10">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">Optimize for Firefox</span>
                                <span className="text-xs text-spotify-grey">Disables blur effects for better performance. Turn off for better visuals (may lag).</span>
                            </div>
                            <button
                                onClick={() => setDisableFirefoxOpt(!disableFirefoxOpt)}
                                className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative",
                                    !disableFirefoxOpt ? "bg-spotify-green" : "bg-white/10"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                                    !disableFirefoxOpt ? "left-7" : "left-1"
                                )} />
                            </button>
                        </div>
                        <p className="text-xs text-spotify-grey mt-2 italic flex items-center gap-1">
                            * Saves and reloads page on close.
                        </p>
                    </div>
                )
            }
        </div >
    );
}
