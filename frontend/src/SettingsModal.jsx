import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2 } from 'lucide-react';
import axios from 'axios';
import { cn } from './utils';

const API_URL = '/api';

export function SettingsModal({ isOpen, onClose, onSave, onReplayTutorial }) {
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [username, setUsername] = useState('');
    const [updateInterval, setUpdateInterval] = useState(30);
    const [limitCount, setLimitCount] = useState(20);
    const [autoDownload, setAutoDownload] = useState(true);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/settings`);
            setApiKey(response.data.LASTFM_API_KEY || '');
            setApiSecret(response.data.LASTFM_API_SECRET || '');
            setUsername(response.data.LASTFM_USER || '');
            setUpdateInterval(response.data.SCROBBLE_UPDATE_INTERVAL || 30);
            setLimitCount(response.data.SCROBBLE_LIMIT_COUNT || 20);
            setAutoDownload(response.data.AUTO_DOWNLOAD !== 'false'); // Default to true
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                lastfm_user: username,
                scrobble_update_interval: parseInt(updateInterval),
                scrobble_limit_count: parseInt(limitCount),
                auto_download: autoDownload
            };

            // Only send API key/secret if they are not masked (i.e. user changed them)
            if (apiKey && !apiKey.includes('*')) {
                payload.lastfm_api_key = apiKey;
            }
            if (apiSecret && !apiSecret.includes('*')) {
                payload.lastfm_api_secret = apiSecret;
            }

            await axios.post(`${API_URL}/settings`, payload);
            onSave(username, autoDownload); // Pass back the new username and autoDownload state
            onClose();
        } catch (error) {
            console.error("Error saving settings:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="bg-spotify-dark border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 pointer-events-auto m-4">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Settings</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-spotify-grey hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-spotify-grey">Last.fm API Key</label>
                                        <input
                                            type="text"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                                            placeholder="Enter API Key"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-spotify-grey">Last.fm Shared Secret</label>
                                        <input
                                            type="password"
                                            value={apiSecret}
                                            onChange={(e) => setApiSecret(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                                            placeholder="Enter Shared Secret"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-spotify-grey">Last.fm Username</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                                            placeholder="Enter Username"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-spotify-grey">Update Interval (min)</label>
                                            <input
                                                type="number"
                                                value={updateInterval}
                                                onChange={(e) => setUpdateInterval(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-spotify-green transition-colors"
                                                min="1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-spotify-grey">Tracks to Check</label>
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
                                            <p className="text-xs text-spotify-grey">Automatically download new scrobbles</p>
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

                                    <div className="pt-4 flex justify-between gap-3">
                                        <button
                                            onClick={() => {
                                                onClose();
                                                onReplayTutorial();
                                            }}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-spotify-grey hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            Replay Tutorial
                                        </button>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={onClose}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="px-4 py-2 rounded-lg text-sm font-medium bg-spotify-green text-white hover:bg-green-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
