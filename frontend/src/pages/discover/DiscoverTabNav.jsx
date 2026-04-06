import { motion } from 'framer-motion';

import { cn } from '../../utils';

export function DiscoverTabNav({ tabs, activeTab, setActiveTab }) {
    return (
        <div className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1">
            {tabs.map(({ id, label, Icon }) => (
                <motion.button
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all',
                        activeTab === id
                            ? 'bg-spotify-green text-black shadow-lg shadow-spotify-green/20'
                            : 'text-spotify-grey hover:bg-white/10 hover:text-white'
                    )}
                >
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                    {label}
                </motion.button>
            ))}
        </div>
    );
}
