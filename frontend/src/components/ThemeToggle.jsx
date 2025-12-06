import { Moon, Sun, Monitor } from "lucide-react"
import { motion } from "framer-motion"
import { useTheme } from "../contexts/ThemeContext"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    const themes = [
        { id: 'light', icon: Sun, label: 'Light Mode' },
        { id: 'system', icon: Monitor, label: 'System Theme' },
        { id: 'dark', icon: Moon, label: 'Dark Mode' }
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/10 rounded-full border border-border">
            {themes.map(({ id, icon: Icon, label }) => {
                const isActive = theme === id;
                return (
                    <button
                        key={id}
                        onClick={() => setTheme(id)}
                        className={`relative p-2 rounded-full transition-colors z-10 ${isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        title={label}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="theme-active"
                                className="absolute inset-0 bg-background shadow-sm rounded-full -z-10"
                                transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                            />
                        )}
                        <Icon className="h-4 w-4 relative z-10" />
                    </button>
                );
            })}
        </div>
    )
}
