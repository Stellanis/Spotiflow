import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils';
import { useTheme } from '../contexts/ThemeContext';

export function GlassCard({ children, className, image, ...props }) {
    const { theme } = useTheme();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            setIsDark(mediaQuery.matches);

            const handler = (e) => setIsDark(e.matches);
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            setIsDark(theme === 'dark');
        }
    }, [theme]);

    const gradient = useMemo(() => {
        const angle = Math.floor(Math.random() * 360);
        const hue1 = Math.floor(Math.random() * 360);
        const hue2 = (hue1 + 60) % 360;

        // Muted colors for dark mode (Low saturation/lightness), Vibrant/Light for light mode
        const saturation = isDark ? '30%' : '90%';
        const lightness = isDark ? '30%' : '60%';

        return `linear-gradient(${angle}deg, hsl(${hue1}, ${saturation}, ${lightness}), hsl(${hue2}, ${saturation}, ${lightness}))`;
    }, [isDark]);

    return (
        <motion.div
            className={cn(
                "glass-panel relative overflow-hidden group",
                className
            )}
            {...props}
        >
            {/* Bleed Effect Layer */}
            <div
                className="absolute inset-0 -z-10 opacity-30 transition-opacity duration-500 group-hover:opacity-50"
                style={{
                    backgroundImage: image ? `url(${image})` : gradient,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: isDark ? 'blur(40px) saturate(1.5)' : 'blur(40px) saturate(1.5) brightness(1.2)',
                    transform: 'scale(1.5)',
                }}
            />

            {/* Content */}
            {children}
        </motion.div>
    );
}
