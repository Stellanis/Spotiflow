import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { AlertTriangle } from 'lucide-react';

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete", cancelText = "Cancel", isDangerous = false }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md"
                >
                    <GlassCard className="p-6 border-red-500/20">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDangerous ? 'bg-red-500/20 text-red-500' : 'bg-spotify-green/20 text-spotify-green'}`}>
                                <AlertTriangle className="w-6 h-6" />
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                                <p className="text-spotify-grey">{message}</p>
                            </div>

                            <div className="flex items-center gap-3 w-full mt-4">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors font-medium border border-white/5"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={`flex-1 px-4 py-2 rounded-full font-medium transition-colors ${isDangerous
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-spotify-green hover:bg-spotify-green/80 text-black'
                                        }`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
