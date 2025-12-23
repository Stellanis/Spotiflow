import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2 } from 'lucide-react';
import axios from 'axios';
import { LastFMConfig } from './components/settings/LastFMConfig';
import { ConcertsConfig } from './components/settings/ConcertsConfig';
import { BehaviorConfig } from './components/settings/BehaviorConfig';
import { InterfaceConfig } from './components/settings/InterfaceConfig';

const API_URL = '/api';

export function SettingsModal({ isOpen, onClose, onSave, onReplayTutorial }) {
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [username, setUsername] = useState('');
    const [updateInterval, setUpdateInterval] = useState('30');
    const [limitCount, setLimitCount] = useState('20');
    const [autoDownload, setAutoDownload] = useState(true);
    const [hiddenFeatures, setHiddenFeatures] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tmApiKey, setTmApiKey] = useState('');
    const [bitAppId, setBitAppId] = useState('');

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
            setAutoDownload(response.data.AUTO_DOWNLOAD !== 'false');

            const hidden = response.data.HIDDEN_FEATURES ? response.data.HIDDEN_FEATURES.split(',') : [];
            setHiddenFeatures(new Set(hidden));

            setTmApiKey(response.data.tm_api_key || '');
            setBitAppId(response.data.bit_app_id || '');

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
                auto_download: autoDownload,
                hidden_features: Array.from(hiddenFeatures).join(',')
            };

            if (apiKey && !apiKey.includes('*')) {
                payload.lastfm_api_key = apiKey;
            }
            if (apiSecret && !apiSecret.includes('*')) {
                payload.lastfm_api_secret = apiSecret;
            }
            if (tmApiKey && !tmApiKey.includes('*')) {
                payload.tm_api_key = tmApiKey;
            }
            if (bitAppId) {
                payload.bit_app_id = bitAppId;
            }

            await axios.post(`${API_URL}/settings`, payload);
            onSave(username, autoDownload, Array.from(hiddenFeatures));
            onClose();
        } catch (error) {
            console.error("Error saving settings:", error);
        } finally {
            setSaving(false);
        }
    };

    const toggleFeature = (featureId) => {
        setHiddenFeatures(prev => {
            const newSet = new Set(prev);
            if (newSet.has(featureId)) {
                newSet.delete(featureId);
            } else {
                newSet.add(featureId);
            }
            return newSet;
        });
    };

    const features = [
        { id: 'library', label: 'Library' },
        { id: 'playlists', label: 'Playlists' },
        { id: 'undownloaded', label: 'Undownloaded' },
        { id: 'jobs', label: 'Jobs' },
        { id: 'stats', label: 'Stats' },
        { id: 'concerts', label: 'Concerts' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="bg-spotify-dark border border-white/10 rounded-xl shadow-2xl w-full max-w-md pointer-events-auto m-4 flex flex-col max-h-[90vh]">
                            <div className="p-6 pb-0 mb-6 flex items-center justify-between shrink-0">
                                <h2 className="text-xl font-bold text-white">Settings</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-spotify-grey hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto px-6 pb-2 custom-scrollbar">
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <LastFMConfig
                                            apiKey={apiKey} setApiKey={setApiKey}
                                            apiSecret={apiSecret} setApiSecret={setApiSecret}
                                            username={username} setUsername={setUsername}
                                        />

                                        <ConcertsConfig
                                            tmApiKey={tmApiKey} setTmApiKey={setTmApiKey}
                                            bitAppId={bitAppId} setBitAppId={setBitAppId}
                                        />

                                        <BehaviorConfig
                                            updateInterval={updateInterval} setUpdateInterval={setUpdateInterval}
                                            limitCount={limitCount} setLimitCount={setLimitCount}
                                            autoDownload={autoDownload} setAutoDownload={setAutoDownload}
                                        />

                                        <InterfaceConfig
                                            hiddenFeatures={hiddenFeatures}
                                            toggleFeature={toggleFeature}
                                            features={features}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="p-6 pt-4 border-t border-white/10 bg-spotify-dark rounded-b-xl shrink-0">
                                <div className="flex justify-between gap-3">
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

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
