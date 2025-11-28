import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check, Music, Disc, Download, CheckCircle, RefreshCw } from 'lucide-react';
import { cn } from './utils';

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
    }
];

export function TutorialModal({ isOpen, onClose }) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
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
                                    className="px-6 py-2.5 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    {currentStep === steps.length - 1 ? (
                                        <>Get Started <Check className="w-4 h-4" /></>
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
