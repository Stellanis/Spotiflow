import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check, Music, Disc, Download, CheckCircle, RefreshCw, Key, Hourglass, Loader2, Ticket } from 'lucide-react';
import { cn } from './utils';
import axios from 'axios';

const API_URL = '/api';

const steps = [
    {
        title: "Welcome to Spotiflow",
        description: "Your personal Spotify downloader and library manager. Let's take a quick tour of the features.",
        icon: <Music className="w-16 h-16 text-spotify-green" />,
        color: "bg-spotify-green"
    },
    {
        title: "Recent Scrobbles",
        description: "View your recently played tracks from Last.fm. This is the main source for your downloads.",
        icon: <Disc className="w-16 h-16 text-blue-500" />,
        color: "bg-blue-500"
    },
    {
        title: "Your Library",
        description: "All your downloaded tracks live here. You can play them or see their status at a glance.",
        icon: <CheckCircle className="w-16 h-16 text-purple-500" />,
        color: "bg-purple-500"
    },
    {
        title: "Undownloaded Tracks",
        description: "Tracks that haven't been downloaded yet appear here. You can manually download them or enable auto-download.",
        icon: <Download className="w-16 h-16 text-orange-500" />,
        color: "bg-orange-500"
    },
    {
        title: "Auto-Download Mode",
        description: "Enable 'Auto Download' in settings to automatically download new scrobbles as they come in.",
        icon: <RefreshCw className="w-16 h-16 text-pink-500" />,
        color: "bg-pink-500"
    },
    {
        title: "Background Jobs",
        description: "Monitor active downloads and check the status of your Last.fm sync in the Jobs tab.",
        icon: <Hourglass className="w-16 h-16 text-cyan-500" />,
        color: "bg-cyan-500"
    },
    {
        title: "Connect Last.fm",
        description: "Enter your Last.fm credentials to start fetching your scrobbles.",
        icon: <Key className="w-16 h-16 text-yellow-500" />,
        color: "bg-yellow-500",
        color: "bg-yellow-500",
        id: 'lastfm',
        isInputStep: true
    },
    {
        title: "Concerts Setup",
        description: "Configure Ticketmaster to find concerts near you.",
        icon: <Ticket className="w-16 h-16 text-red-500" />,
        color: "bg-red-500",
        id: 'concerts',
        isInputStep: true
    }
];

export function TutorialModal({ isOpen, onClose, onTutorialComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [username, setUsername] = useState('');
    const [tmApiKey, setTmApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [prefetching, setPrefetching] = useState(false);

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Save settings if on the last step
            if (steps[currentStep].isInputStep) {
                setSaving(true);
                try {
                    await axios.post(`${API_URL}/settings`, {
                        lastfm_api_key: apiKey,
                        lastfm_api_secret: apiSecret,
                        lastfm_user: username,
                        tm_api_key: tmApiKey
                    });

                    // Trigger prefetching if callback provided
                    if (onTutorialComplete) {
                        setPrefetching(true);
                        await onTutorialComplete(username);
                    }
                } catch (error) {
                    console.error("Failed to save settings:", error);
                } finally {
                    setSaving(false);
                    setPrefetching(false);
                }
            }
            onClose();
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none"
                    >
                        <div className="bg-spotify-dark border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto m-4 flex flex-col">

                            {/* Step Content */}
                            <div className="p-8 flex flex-col items-center text-center space-y-6 relative min-h-[400px]">
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 p-2 text-spotify-grey hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStep}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex flex-col items-center space-y-6 w-full"
                                    >
                                        <div className={cn(
                                            "w-32 h-32 rounded-full flex items-center justify-center bg-white/5 mb-4",
                                            `text-${steps[currentStep].color.replace('bg-', '')}`
                                        )}>
                                            {steps[currentStep].icon}
                                        </div>

                                        <div className="space-y-2">
                                            <h2 className="text-2xl font-bold text-white">
                                                {steps[currentStep].title}
                                            </h2>
                                            <p className="text-spotify-grey text-lg leading-relaxed">
                                                {steps[currentStep].description}
                                            </p>
                                        </div>

                                        {steps[currentStep].isInputStep && steps[currentStep].id === 'lastfm' && (
                                            <div className="w-full space-y-4 mt-4 text-left">
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
                                                <div className="text-center pt-2">
                                                    <a
                                                        href="https://www.last.fm/api/account/create"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-spotify-green hover:underline"
                                                    >
                                                        Get an API account here
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {steps[currentStep].isInputStep && steps[currentStep].id === 'concerts' && (
                                            <div className="w-full space-y-4 mt-4 text-left">
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
                                                <div className="text-center pt-2">
                                                    <a
                                                        href="https://developer.ticketmaster.com/products-and-docs/apis/getting-started/"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-spotify-green hover:underline"
                                                    >
                                                        Get a Ticketmaster Key here
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Footer / Controls */}
                            <div className="p-6 bg-black/20 border-t border-white/5 flex items-center justify-between">
                                <div className="flex gap-1">
                                    {steps.map((_, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "w-2 h-2 rounded-full transition-all duration-300",
                                                index === currentStep ? "bg-white w-6" : "bg-white/20"
                                            )}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={handleNext}
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-50"
                                >
                                    {currentStep === steps.length - 1 ? (
                                        prefetching ? (
                                            <>Prefetching... <Loader2 className="w-4 h-4 animate-spin" /></>
                                        ) : (
                                            <>Get Started <Check className="w-4 h-4" /></>
                                        )
                                    ) : (
                                        <>Next <ChevronRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
