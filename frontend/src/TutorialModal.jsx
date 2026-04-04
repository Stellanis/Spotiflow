import { useMemo, useState } from 'react';
import axios from 'axios';
import { Check, ChevronRight, KeyRound, MapPin, Music4, RefreshCw, Settings2, X } from 'lucide-react';
import { isFirefox } from './utils/browser';
import { cn } from './utils';

const steps = [
    { id: 'account', title: 'Connect Last.fm', description: 'Add the account details Spotiflow needs to fetch your listening history.', icon: KeyRound },
    { id: 'downloads', title: 'Choose download behavior', description: 'Decide whether new scrobbles should download automatically and how often Spotiflow checks for updates.', icon: Music4 },
    { id: 'concerts', title: 'Optional concert data', description: 'Ticketmaster and Bandsintown let Spotiflow surface relevant events and reminders.', icon: MapPin },
    { id: 'finish', title: 'Run your first sync', description: 'Confirm the setup and let Spotiflow start building your listening hub.', icon: RefreshCw },
];

export function TutorialModal({ isOpen, onClose, onTutorialComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        username: '',
        apiKey: '',
        apiSecret: '',
        autoDownload: true,
        updateInterval: '30',
        limitCount: '20',
        tmApiKey: '',
        bitAppId: 'demo',
    });

    const step = steps[currentStep];
    const progress = useMemo(() => ((currentStep + 1) / steps.length) * 100, [currentStep]);

    if (!isOpen) return null;

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((value) => value + 1);
            return;
        }

        setSaving(true);
        try {
            await axios.post('/api/settings', {
                lastfm_user: form.username,
                lastfm_api_key: form.apiKey,
                lastfm_api_secret: form.apiSecret,
                auto_download: form.autoDownload,
                scrobble_update_interval: Number(form.updateInterval || 30),
                scrobble_limit_count: Number(form.limitCount || 20),
                tm_api_key: form.tmApiKey,
                bit_app_id: form.bitAppId,
                tutorial_seen: true,
            });
            await axios.post('/api/scrobbles/sync');
            if (onTutorialComplete) onTutorialComplete(form.username);
            onClose();
        } catch (error) {
            console.error('Failed to save onboarding', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className={`fixed inset-0 z-[60] ${isFirefox ? 'bg-black/95' : 'bg-black/80 backdrop-blur-sm'}`} />
            <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] shadow-2xl">
                    <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-spotify-green/80">Setup Wizard</p>
                            <h2 className="mt-2 text-2xl font-semibold text-white">{step.title}</h2>
                            <p className="mt-1 text-sm text-spotify-grey">{step.description}</p>
                        </div>
                        <button type="button" onClick={onClose} className="rounded-full p-2 text-spotify-grey transition-colors hover:bg-white/5 hover:text-white">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="h-1 w-full bg-white/5">
                        <div className="h-full bg-spotify-green transition-all" style={{ width: `${progress}%` }} />
                    </div>

                    <div className="grid gap-8 p-6 md:grid-cols-[220px_1fr]">
                        <div className="space-y-3">
                            {steps.map((item, index) => {
                                const Icon = item.icon;
                                const isActive = index === currentStep;
                                const isDone = index < currentStep;
                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            'flex items-center gap-3 rounded-2xl border px-4 py-3',
                                            isActive ? 'border-white/20 bg-white/5' : 'border-white/5 bg-black/10'
                                        )}
                                    >
                                        <div className={cn('rounded-2xl p-2', isDone ? 'bg-spotify-green text-black' : isActive ? 'bg-white text-black' : 'bg-white/10 text-white/70')}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{item.title}</div>
                                            <div className="text-xs text-spotify-grey">{isDone ? 'Complete' : isActive ? 'In progress' : 'Upcoming'}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-5">
                            {step.id === 'account' ? (
                                <>
                                    <Field label="Last.fm username" value={form.username} onChange={(value) => setForm((current) => ({ ...current, username: value }))} placeholder="Your Last.fm username" />
                                    <Field label="Last.fm API key" value={form.apiKey} onChange={(value) => setForm((current) => ({ ...current, apiKey: value }))} placeholder="Required for public reads" />
                                    <Field label="Last.fm shared secret" value={form.apiSecret} onChange={(value) => setForm((current) => ({ ...current, apiSecret: value }))} placeholder="Stored securely in Spotiflow" type="password" />
                                </>
                            ) : null}

                            {step.id === 'downloads' ? (
                                <>
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-medium text-white">Auto-download new scrobbles</div>
                                                <div className="mt-1 text-sm text-spotify-grey">Turn listening history into local library updates automatically.</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setForm((current) => ({ ...current, autoDownload: !current.autoDownload }))}
                                                className={cn('rounded-full px-4 py-2 text-sm font-medium', form.autoDownload ? 'bg-spotify-green text-black' : 'bg-white/10 text-white')}
                                            >
                                                {form.autoDownload ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Field label="Sync interval (minutes)" value={form.updateInterval} onChange={(value) => setForm((current) => ({ ...current, updateInterval: value }))} />
                                        <Field label="Scrobble check limit" value={form.limitCount} onChange={(value) => setForm((current) => ({ ...current, limitCount: value }))} />
                                    </div>
                                </>
                            ) : null}

                            {step.id === 'concerts' ? (
                                <>
                                    <Field label="Ticketmaster API key" value={form.tmApiKey} onChange={(value) => setForm((current) => ({ ...current, tmApiKey: value }))} placeholder="Optional, but recommended for concert discovery" />
                                    <Field label="Bandsintown app ID" value={form.bitAppId} onChange={(value) => setForm((current) => ({ ...current, bitAppId: value }))} placeholder="Defaults to demo" />
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-spotify-grey">
                                        Concert integrations are optional. You can skip them now and finish setup, then add them later in Settings.
                                    </div>
                                </>
                            ) : null}

                            {step.id === 'finish' ? (
                                <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                                    <div className="flex items-start gap-3">
                                        <Settings2 className="mt-1 h-5 w-5 text-spotify-green" />
                                        <div>
                                            <div className="font-medium text-white">Ready to build your listening hub</div>
                                            <p className="mt-1 text-sm text-spotify-grey">
                                                Spotiflow will save these settings, mark onboarding complete, and start the first scrobble sync immediately.
                                            </p>
                                        </div>
                                    </div>
                                    <ul className="space-y-2 text-sm text-spotify-grey">
                                        <li>Username: <span className="text-white">{form.username || 'Not set'}</span></li>
                                        <li>Auto-download: <span className="text-white">{form.autoDownload ? 'Enabled' : 'Disabled'}</span></li>
                                        <li>Sync interval: <span className="text-white">{form.updateInterval || '30'} minutes</span></li>
                                        <li>Concert integrations: <span className="text-white">{form.tmApiKey || form.bitAppId ? 'Configured' : 'Skipped for now'}</span></li>
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
                        <button
                            type="button"
                            onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
                            disabled={currentStep === 0}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                        >
                            {currentStep === steps.length - 1 ? (
                                <>
                                    {saving ? 'Saving setup' : 'Save and sync'}
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ChevronRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
    return (
        <label className="block space-y-2">
            <span className="text-sm font-medium text-white">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition-colors placeholder:text-spotify-grey focus:border-white/20"
            />
        </label>
    );
}
