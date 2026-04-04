import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

import { LastFMConfig } from '../components/settings/LastFMConfig';
import { ConcertsConfig } from '../components/settings/ConcertsConfig';
import { BehaviorConfig } from '../components/settings/BehaviorConfig';
import { InterfaceConfig } from '../components/settings/InterfaceConfig';
import { PageHeader } from '../components/ui/PageHeader';

const API_URL = '/api';

const FEATURES = [
    { id: 'library', label: 'Library' },
    { id: 'insights', label: 'Insights' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'releases', label: 'Releases' },
    { id: 'undownloaded', label: 'Undownloaded' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'stats', label: 'Stats' },
    { id: 'concerts', label: 'Concerts' },
];

function SettingsSection({ children }) {
    return (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            {children}
        </section>
    );
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const { onSettingsSaved, onReplayTutorial } = useOutletContext();

    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [username, setUsername] = useState('');
    const [updateInterval, setUpdateInterval] = useState('30');
    const [limitCount, setLimitCount] = useState('20');
    const [autoDownload, setAutoDownload] = useState(true);
    const [hiddenFeatures, setHiddenFeatures] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tmApiKey, setTmApiKey] = useState('');
    const [bitAppId, setBitAppId] = useState('');
    const [disableFirefoxOpt, setDisableFirefoxOpt] = useState(false);
    const [sessionGapMinutes, setSessionGapMinutes] = useState('30');
    const [recommendationAggressiveness, setRecommendationAggressiveness] = useState('balanced');
    const [enrichmentEnabled, setEnrichmentEnabled] = useState(true);
    const [releasesEnabled, setReleasesEnabled] = useState(true);

    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_URL}/settings`);
                setApiKey(response.data.LASTFM_API_KEY || '');
                setApiSecret(response.data.LASTFM_API_SECRET || '');
                setUsername(response.data.LASTFM_USER || '');
                setUpdateInterval(String(response.data.SCROBBLE_UPDATE_INTERVAL || 30));
                setLimitCount(String(response.data.SCROBBLE_LIMIT_COUNT || 20));
                setAutoDownload(response.data.AUTO_DOWNLOAD !== 'false');
                setHiddenFeatures(new Set(response.data.HIDDEN_FEATURES ? response.data.HIDDEN_FEATURES.split(',') : []));
                setTmApiKey(response.data.tm_api_key || '');
                setBitAppId(response.data.bit_app_id || '');
                setDisableFirefoxOpt(localStorage.getItem('spotify_scrobbler_disable_optimization') === 'true');
                setSessionGapMinutes(String(response.data.SESSION_GAP_MINUTES || 30));
                setRecommendationAggressiveness(response.data.RECOMMENDATION_AGGRESSIVENESS || 'balanced');
                setEnrichmentEnabled(response.data.ENRICHMENT_ENABLED !== 'false');
                setReleasesEnabled(response.data.RELEASES_ENABLED !== 'false');
            } catch (error) {
                console.error('Error fetching settings:', error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const toggleFeature = (featureId) => {
        setHiddenFeatures((previous) => {
            const next = new Set(previous);
            if (next.has(featureId)) {
                next.delete(featureId);
            } else {
                next.add(featureId);
            }
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                lastfm_user: username,
                scrobble_update_interval: parseInt(updateInterval, 10),
                scrobble_limit_count: parseInt(limitCount, 10),
                auto_download: autoDownload,
                hidden_features: Array.from(hiddenFeatures).join(','),
                session_gap_minutes: parseInt(sessionGapMinutes, 10),
                recommendation_aggressiveness: recommendationAggressiveness,
                enrichment_enabled: enrichmentEnabled,
                releases_enabled: releasesEnabled,
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
            onSettingsSaved(username, autoDownload, Array.from(hiddenFeatures));

            const currentOpt = localStorage.getItem('spotify_scrobbler_disable_optimization') === 'true';
            if (currentOpt !== disableFirefoxOpt) {
                localStorage.setItem('spotify_scrobbler_disable_optimization', String(disableFirefoxOpt));
                window.location.reload();
                return;
            }

            toast.success('Settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Settings"
                title="Configure the listening hub"
                description="All account, syncing, concert, and interface controls now live in the main workspace so settings feel like part of the product instead of a detached pop-out."
                actions={
                    <>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
                        >
                            <span className="inline-flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={loading || saving}
                            className="rounded-full bg-spotify-green px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
                        >
                            <span className="inline-flex items-center gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save changes
                            </span>
                        </button>
                    </>
                }
            />

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-spotify-green" />
                </div>
            ) : (
                <>
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <SettingsSection>
                            <LastFMConfig
                                apiKey={apiKey}
                                setApiKey={setApiKey}
                                apiSecret={apiSecret}
                                setApiSecret={setApiSecret}
                                username={username}
                                setUsername={setUsername}
                            />
                        </SettingsSection>

                        <SettingsSection>
                            <BehaviorConfig
                                updateInterval={updateInterval}
                                setUpdateInterval={setUpdateInterval}
                                limitCount={limitCount}
                                setLimitCount={setLimitCount}
                                autoDownload={autoDownload}
                                setAutoDownload={setAutoDownload}
                                sessionGapMinutes={sessionGapMinutes}
                                setSessionGapMinutes={setSessionGapMinutes}
                                recommendationAggressiveness={recommendationAggressiveness}
                                setRecommendationAggressiveness={setRecommendationAggressiveness}
                                enrichmentEnabled={enrichmentEnabled}
                                setEnrichmentEnabled={setEnrichmentEnabled}
                                releasesEnabled={releasesEnabled}
                                setReleasesEnabled={setReleasesEnabled}
                            />
                        </SettingsSection>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <SettingsSection>
                            <ConcertsConfig
                                tmApiKey={tmApiKey}
                                setTmApiKey={setTmApiKey}
                                bitAppId={bitAppId}
                                setBitAppId={setBitAppId}
                            />
                        </SettingsSection>

                        <SettingsSection>
                            <InterfaceConfig
                                hiddenFeatures={hiddenFeatures}
                                toggleFeature={toggleFeature}
                                features={FEATURES}
                                isFirefox={isFirefox}
                                disableFirefoxOpt={disableFirefoxOpt}
                                setDisableFirefoxOpt={setDisableFirefoxOpt}
                            />
                        </SettingsSection>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-black/20 p-6">
                        <div>
                            <div className="text-sm font-medium text-white">Need the onboarding flow again?</div>
                            <p className="mt-1 text-sm text-spotify-grey">
                                Re-open the guided setup and walk through the core configuration from the start.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onReplayTutorial}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
                        >
                            <span className="inline-flex items-center gap-2">
                                <RotateCcw className="h-4 w-4" />
                                Reset onboarding
                            </span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
