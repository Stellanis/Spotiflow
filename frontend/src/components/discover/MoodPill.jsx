import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';

// Emoji map for common mood/genre tags
const MOOD_EMOJIS = {
    'Pop': '🎵',
    'Electronic': '⚡',
    'Rock': '🎸',
    'Indie': '🌿',
    'Hip-Hop': '🎤',
    'Rap': '🎤',
    'Chill': '🌊',
    'Jazz': '🎷',
    'Classical': '🎻',
    'Metal': '🤘',
    'R&B': '✨',
    'Soul': '💛',
    'Folk': '🪕',
    'Country': '🤠',
    'Blues': '🎺',
    'Ambient': '🌌',
    'Dance': '💃',
    'Alternative': '🔮',
    'Punk': '⚡',
    'Emo': '🖤',
};

function getMoodEmoji(mood) {
    // Exact match first
    if (MOOD_EMOJIS[mood]) return MOOD_EMOJIS[mood];
    // Partial match
    const lower = mood.toLowerCase();
    for (const [key, emoji] of Object.entries(MOOD_EMOJIS)) {
        if (lower.includes(key.toLowerCase())) return emoji;
    }
    return '🎵';
}

/**
 * MoodPill
 * Props:
 *   mood     – string
 *   selected – bool
 *   count    – number of tracks
 *   onClick  – () => void
 */
export function MoodPill({ mood, selected, count, onClick }) {
    const emoji = getMoodEmoji(mood);

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border',
                selected
                    ? 'bg-spotify-green text-black border-spotify-green shadow-lg shadow-spotify-green/30'
                    : 'bg-white/10 text-white border-white/10 hover:bg-white/20 hover:border-white/20'
            )}
        >
            <span className="text-base leading-none">{emoji}</span>
            <span>{mood}</span>
            {count != null && (
                <span
                    className={cn(
                        'text-xs rounded-full px-1.5 py-0.5 font-normal leading-none',
                        selected ? 'bg-black/20 text-black/70' : 'bg-white/10 text-spotify-grey'
                    )}
                >
                    {count}
                </span>
            )}
        </motion.button>
    );
}
