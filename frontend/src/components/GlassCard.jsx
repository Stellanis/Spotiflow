import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils';
import { isFirefox } from '../utils/browser';


export function GlassCard({ children, className, image, ...props }) {
    const gradient = useMemo(() => {
        const angle = Math.floor(Math.random() * 360);
        const hue1 = Math.floor(Math.random() * 360);
        const hue2 = (hue1 + 60) % 360;

        // Muted colors for dark mode (Low saturation/lightness)
        const saturation = '30%';
        const lightness = '30%';

        return `linear-gradient(${angle}deg, hsl(${hue1}, ${saturation}, ${lightness}), hsl(${hue2}, ${saturation}, ${lightness}))`;
    }, []);

    return (
        <motion.div
            className={cn(
                isFirefox ? "bg-white/5 border border-white/10 rounded-2xl shadow-lg relative overflow-hidden group" : "glass-panel relative overflow-hidden group",
                className
            )}
            {...props}
        >
            {/* Bleed Effect Layer */}
            <motion.div
                className="absolute inset-0 -z-10 transition-opacity duration-500 group-hover:opacity-50"
                initial={isFirefox ? { opacity: 0.3 } : { scale: 1.5, rotate: 0, opacity: 0.3 }}
                whileHover={isFirefox ? { opacity: 0.5 } : { scale: 1.8, rotate: 15, opacity: 0.5 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                    backgroundImage: isFirefox ? gradient : (image ? `url(${image})` : gradient),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    // COMPATIBILITY: Disable blur in Firefox as it causes severe performance issues
                    filter: isFirefox ? 'none' : 'blur(40px) saturate(1.5)',
                }}
            />

            {/* Content */}
            {children}
        </motion.div>
    );
}
