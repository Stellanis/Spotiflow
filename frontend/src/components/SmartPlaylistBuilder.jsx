import { useState } from 'react';
import axios from 'axios';
import { X, Plus, Sparkles, Filter, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { toast } from 'react-hot-toast';
import { cn } from '../utils';

export function SmartPlaylistBuilder({ isOpen, onClose, onCreate }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSmart, setIsSmart] = useState(false);
    const [matchType, setMatchType] = useState('all'); // 'all' or 'any'
    const [rules, setRules] = useState([
        { field: 'artist', operator: 'contains', value: '' }
    ]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('manual'); // 'manual', 'smart', 'vibe'

    const vibePresets = [
        { id: 'midnight', label: 'The Midnight Lounge', icon: '🌙', tags: ['jazz', 'blues', 'ambient', 'chill', 'mellow'], description: 'Late night vibes. Smooth, atmospheric and relaxed.' },
        { id: 'energy', label: 'High Energy', icon: '⚡', tags: ['rock', 'metal', 'dance', 'electronic', 'upbeat'], description: 'Keep the momentum going. Perfect for workouts or focus.' },
        { id: 'focus', label: 'Deep Focus', icon: '🧠', tags: ['classical', 'instrumental', 'ambient', 'lo-fi', 'soundtrack'], description: 'Minimal distractions. Atmospheric sounds for deep work.' },
        { id: 'indie', label: 'Indie Discovery', icon: '🎸', tags: ['indie', 'alternative', 'shoegaze', 'dream pop'], description: 'The best of your indie and alternative collection.' },
    ];

    const handleAddRule = () => {
        setRules([...rules, { field: 'artist', operator: 'contains', value: '' }]);
    };

    const handleRemoveRule = (index) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const handleRuleChange = (index, key, value) => {
        const newRules = [...rules];
        newRules[index][key] = value;
        setRules(newRules);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name,
                description,
                type: isSmart ? 'smart' : 'manual',
                rules: isSmart ? JSON.stringify({ match_type: matchType, rules }) : null
            };

            const res = await axios.post('/api/playlists', payload);
            if (onCreate) onCreate(res.data);
            toast.success("Playlist created");
            resetForm();
            onClose();
        } catch (error) {
            console.error("Error creating playlist:", error);
            const msg = error.response?.data?.detail || "Failed to create playlist";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleVibeCreate = async (vibe) => {
        setLoading(true);
        try {
            const payload = {
                name: vibe.label,
                description: vibe.description,
                tags: vibe.tags
            };

            const res = await axios.post('/api/playlists/generate/genre', payload);
            if (onCreate) onCreate(res.data);
            toast.success(`${vibe.label} playlist generated!`);
            onClose();
        } catch (error) {
            console.error("Error generating vibe playlist:", error);
            toast.error("Failed to generate vibe playlist");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setIsSmart(false);
        setRules([{ field: 'artist', operator: 'contains', value: '' }]);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-2xl"
                    >
                        <GlassCard className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {activeTab === 'smart' ? <Sparkles className="text-purple-400" /> : <Plus />}
                                    Create New Playlist
                                </h2>
                                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>

                            <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-lg border border-white/5">
                                {['manual', 'smart', 'vibe'].map(tab => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "flex-1 py-2 text-sm font-medium rounded-md transition-all capitalize",
                                            activeTab === tab ? "bg-white/10 text-white shadow-sm" : "text-spotify-grey hover:text-white"
                                        )}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'vibe' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {vibePresets.map(vibe => (
                                        <button
                                            key={vibe.id}
                                            type="button"
                                            onClick={() => handleVibeCreate(vibe)}
                                            disabled={loading}
                                            className="p-4 bg-white/5 border border-white/5 rounded-xl text-left hover:bg-white/10 transition-all group disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-2xl">{vibe.icon}</span>
                                                <div className="font-bold text-white group-hover:text-spotify-green transition-colors">{vibe.label}</div>
                                            </div>
                                            <p className="text-xs text-spotify-grey leading-relaxed line-clamp-2">
                                                {vibe.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-spotify-grey mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-spotify-green focus:outline-none"
                                                    required
                                                    placeholder="My Awesome Playlist"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-spotify-grey mb-1">Description</label>
                                                <textarea
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-spotify-green focus:outline-none min-h-[80px]"
                                                    placeholder="What's this vibe?"
                                                />
                                            </div>
                                        </div>

                                        <div className={cn("space-y-4 transition-opacity", activeTab !== 'smart' && "opacity-50 pointer-events-none grayscale")}>
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium text-white">Rules</label>
                                                <select
                                                    value={matchType}
                                                    onChange={(e) => setMatchType(e.target.value)}
                                                    className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                                >
                                                    <option value="all">Match ALL rules (AND)</option>
                                                    <option value="any">Match ANY rule (OR)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                {rules.map((rule, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <select
                                                            value={rule.field}
                                                            onChange={(e) => handleRuleChange(idx, 'field', e.target.value)}
                                                            className="bg-black/20 border border-white/10 rounded px-2 py-2 text-sm text-white focus:outline-none w-1/3"
                                                        >
                                                            <option value="artist">Artist</option>
                                                            <option value="title">Title</option>
                                                            <option value="album">Album</option>
                                                        </select>

                                                        <select
                                                            value={rule.operator}
                                                            onChange={(e) => handleRuleChange(idx, 'operator', e.target.value)}
                                                            className="bg-black/20 border border-white/10 rounded px-2 py-2 text-sm text-white focus:outline-none w-1/4"
                                                        >
                                                            <option value="contains">contains</option>
                                                            <option value="is">is exactly</option>
                                                            <option value="is_not">is not</option>
                                                        </select>

                                                        <input
                                                            type="text"
                                                            value={rule.value}
                                                            onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                                                            className="bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-spotify-green focus:outline-none flex-1 min-w-0"
                                                            placeholder="Value..."
                                                        />

                                                        {rules.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveRule(idx)}
                                                                className="p-2 text-spotify-grey hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleAddRule}
                                                className="text-xs text-spotify-green hover:underline flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add Condition
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 text-sm hover:text-white text-spotify-grey transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-2 bg-spotify-green text-white text-sm font-medium rounded-full hover:bg-spotify-green/80 transition-colors disabled:opacity-50"
                                        >
                                            {loading ? 'Creating...' : 'Create Playlist'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
