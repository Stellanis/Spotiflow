import React from 'react';

export function ConcertsConfig({ tmApiKey, setTmApiKey, bitAppId, setBitAppId }) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-white/10 pb-2">Concerts Config</h3>
            <div className="space-y-2">
                <label className="text-sm font-medium text-spotify-grey">Ticketmaster API Key</label>
                <input
                    type="text"
                    value={tmApiKey}
                    onChange={(e) => setTmApiKey(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                    placeholder="Enter Ticketmaster API Key"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-spotify-grey">Bandsintown App ID</label>
                <input
                    type="text"
                    value={bitAppId}
                    onChange={(e) => setBitAppId(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                    placeholder="Enter App ID (optional)"
                />
            </div>
        </div>
    );
}
