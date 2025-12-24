import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Music, Disc, CheckCircle, Download, Hourglass, Ticket, Settings, RefreshCw } from 'lucide-react';
import { cn } from '../utils';

export function MobileMenu({ isOpen, onClose, navItems, currentPath, onNavigate, username, onSync, isSyncing, onSettingsOpen }) {

    // Backdrop constraints to close on tap
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const sidebarVariants = {
        closed: {
            x: '-100%',
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 40
            }
        },
        open: {
            x: '0%',
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 40
            }
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
                        onClick={handleBackdropClick}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] lg:hidden touch-none"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={sidebarVariants}
                        drag="x"
                        dragConstraints={{ left: -300, right: 0 }}
                        dragElastic={0.1}
                        onDragEnd={(e, { offset, velocity }) => {
                            if (offset.x < -50 || velocity.x < -500) {
                                onClose();
                            }
                        }}
                        className="fixed top-0 left-0 bottom-0 w-[80%] max-w-sm bg-black/95 border-r border-white/10 z-[9999] lg:hidden shadow-2xl flex flex-col"
                    >
                        {/* Header Area */}
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center text-black font-bold text-lg shadow-lg shadow-spotify-green/20">
                                    {username ? username[0].toUpperCase() : 'S'}
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg text-white">Spotiflow</h2>
                                    <p className="text-xs text-spotify-grey">Mobile Menu</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Navigation Items */}
                        <div className="flex-1 overflow-y-auto p-4 py-6 space-y-2">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.path)}
                                    className={cn(
                                        "w-full px-4 py-3.5 rounded-xl text-left font-medium transition-all flex items-center gap-4 text-base",
                                        currentPath === item.id
                                            ? "bg-spotify-green text-black shadow-lg shadow-spotify-green/20 font-bold"
                                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    <item.icon className={cn("w-6 h-6", currentPath === item.id ? "text-black" : "text-spotify-grey")} />
                                    <span>{item.label}</span>
                                    {currentPath === item.id && (
                                        <motion.div
                                            layoutId="active-dot"
                                            className="ml-auto w-2 h-2 rounded-full bg-black"
                                        />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Footer / Quick Actions */}
                        <div className="p-4 border-t border-white/10 space-y-3 bg-white/5">
                            <button
                                onClick={() => { onSync(); onClose(); }}
                                disabled={isSyncing}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex items-center justify-center gap-3 text-sm font-medium text-white"
                            >
                                <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin text-spotify-green")} />
                                {isSyncing ? "Syncing..." : "Sync Now"}
                            </button>

                            <button
                                onClick={() => { onSettingsOpen(); onClose(); }}
                                className="w-full px-4 py-3 rounded-xl bg-transparent hover:bg-white/5 transition-colors flex items-center justify-center gap-3 text-sm font-medium text-spotify-grey hover:text-white"
                            >
                                <Settings className="w-5 h-5" />
                                Settings
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
