import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils';


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
                "glass-panel relative overflow-hidden group",
                className
            )}
            {...props}
        >
            {/* Bleed Effect Layer */}
            <motion.div
                className="absolute inset-0 -z-10 opacity-30 transition-opacity duration-500 group-hover:opacity-50"
                initial={{ scale: 1.5, rotate: 0 }}
                whileHover={{ scale: 1.8, rotate: 15 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                    backgroundImage: image ? `url(${image})` : gradient,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(40px) saturate(1.5)',
                }}
            />

            {/* Content */}
            {children}
        </motion.div>
    );
}
