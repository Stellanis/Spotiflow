import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils';

export function FilterDropdown({ value, options, onChange, placeholder = "Select...", className }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-white text-sm hover:bg-white/10 transition-colors focus:outline-none focus:border-spotify-green min-w-[160px]",
                    className
                )}
            >
                <span className="truncate">
                    {value || placeholder}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-spotify-grey transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full mt-2 left-0 w-full min-w-[200px] z-50 bg-[#121212]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar"
                    >
                        <div className="p-1">
                            <button
                                onClick={() => {
                                    onChange("");
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between group",
                                    !value ? "bg-spotify-green/20 text-spotify-green" : "text-white hover:bg-white/10"
                                )}
                            >
                                <span>All</span>
                                {!value && <Check className="w-4 h-4" />}
                            </button>
                            {options.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => {
                                        onChange(option);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between group",
                                        value === option ? "bg-spotify-green/20 text-spotify-green" : "text-white hover:bg-white/10"
                                    )}
                                >
                                    <span className="truncate">{option}</span>
                                    {value === option && <Check className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
