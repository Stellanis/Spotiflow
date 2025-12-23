import React from 'react';

export function LastFMConfig({ apiKey, setApiKey, apiSecret, setApiSecret, username, setUsername }) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-white/10 pb-2">Last.fm Config</h3>
            <div className="space-y-2">
                <label className="text-sm font-medium text-spotify-grey">API Key</label>
                <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                    placeholder="Enter API Key"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-spotify-grey">Shared Secret</label>
                <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                    placeholder="Enter Shared Secret"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-spotify-grey">Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                    placeholder="Enter Username"
                />
            </div>
        </div>
    );
}
