import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Sparkles, Filter, Trash2, ListMusic, Music, Zap, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { toast } from 'react-hot-toast';
import { cn } from '../utils';

export function PlaylistCreator({ isOpen, onClose, onCreate }) {
    // Mode: 'menu', 'manual', 'smart', 'top', 'genre'
    const [mode, setMode] = useState('menu');

    // Common State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    // Smart State
    const [matchType, setMatchType] = useState('all');
    const [rules, setRules] = useState([{ field: 'artist', operator: 'contains', value: '' }]);

    // Top Songs State
    const [timeRange, setTimeRange] = useState('overall'); // overall, 7day, 1month

    // Genre State
    const [genreTag, setGenreTag] = useState('');
    const [availableTags, setAvailableTags] = useState([]);

    useEffect(() => {
        if (mode === 'genre') {
            fetchTags();
        }
    }, [mode]);

    const fetchTags = async () => {
        try {
            const res = await axios.get('/api/playlists/tags');
            setAvailableTags(res.data);
        } catch (error) {
            console.error("Failed to fetch tags", error);
        }
    };

    const handleAddRule = () => setRules([...rules, { field: 'artist', operator: 'contains', value: '' }]);
    const handleRemoveRule = (index) => setRules(rules.filter((_, i) => i !== index));
    const handleRuleChange = (index, key, value) => {
        const newRules = [...rules];
        newRules[index][key] = value;
        setRules(newRules);
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setMode('menu');
        setRules([{ field: 'artist', operator: 'contains', value: '' }]);
        setTimeRange('overall');
        setGenreTag('');
    };

    const handleBack = () => {
        setMode('menu');
    };

    const createManualOrSmart = async (type) => {
        // ... (Existing Logic)
        const payload = {
            name,
            description,
            type: type,
            rules: type === 'smart' ? JSON.stringify({ match_type: matchType, rules }) : null
        };
        return axios.post('/api/playlists', payload);
    };

    const createTopSongs = async () => {
        // Backend endpoint: POST /api/playlists/generate/top
        return axios.post('/api/playlists/generate/top', {
            name: name || `Top Songs (${timeRange})`,
            description: description || `My top songs from ${timeRange}`,
            period: timeRange
        });
    };

    const createGenre = async () => {
        // Backend endpoint: POST /api/playlists/generate/genre
        return axios.post('/api/playlists/generate/genre', {
            name: name || `${genreTag} Mix`,
            description: description || `A mix of ${genreTag} tracks`,
            tag: genreTag
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (mode === 'manual') res = await createManualOrSmart('manual');
            else if (mode === 'smart') res = await createManualOrSmart('smart');
            else if (mode === 'top') res = await createTopSongs();
            else if (mode === 'genre') res = await createGenre();

            if (onCreate && res) onCreate(res.data);
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

    // Render Menu
    if (mode === 'menu') {
        return (
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-4xl"
                        >
                            <GlassCard className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold text-white">Create Playlist</h2>
                                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                        <X className="w-6 h-6 text-white" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Manual */}
                                    <div onClick={() => { setMode('manual'); setName(''); }} className="group p-6 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors border border-white/5 hover:border-spotify-green/50 flex flex-col items-center text-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <ListMusic className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Standard</h3>
                                            <p className="text-sm text-spotify-grey">Build manually from your library</p>
                                        </div>
                                    </div>

                                    {/* Top Songs */}
                                    <div onClick={() => { setMode('top'); setName('Top Songs'); }} className="group p-6 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors border border-white/5 hover:border-blue-500/50 flex flex-col items-center text-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <BarChart3 className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Top Songs</h3>
                                            <p className="text-sm text-spotify-grey">Based on listening history</p>
                                        </div>
                                    </div>

                                    {/* Genre Filter */}
                                    <div onClick={() => { setMode('genre'); setName(''); }} className="group p-6 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors border border-white/5 hover:border-pink-500/50 flex flex-col items-center text-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Tag className="w-6 h-6 text-pink-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Genre Mix</h3>
                                            <p className="text-sm text-spotify-grey">Generate from specific tags</p>
                                        </div>
                                    </div>

                                    {/* Smart */}
                                    <div onClick={() => { setMode('smart'); setName(''); }} className="group p-6 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors border border-white/5 hover:border-purple-500/50 flex flex-col items-center text-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Sparkles className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Smart Rules</h3>
                                            <p className="text-sm text-spotify-grey">Dynamic rules (e.g. Artist is...)</p>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        );
    }

    // Render Form Wrapper
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
                                <div className="flex items-center gap-3">
                                    <button onClick={handleBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                        <ArrowLeft className="w-5 h-5 text-spotify-grey hover:text-white" />
                                    </button>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        {mode === 'manual' && <ListMusic />}
                                        {mode === 'smart' && <Sparkles className="text-purple-400" />}
                                        {mode === 'top' && <BarChart3 className="text-blue-400" />}
                                        {mode === 'genre' && <Tag className="text-pink-400" />}
                                        {mode === 'manual' ? 'Standard Playlist' :
                                            mode === 'smart' ? 'Smart Playlist' :
                                                mode === 'top' ? 'Top Songs Generator' : 'Genre Mix Generator'}
                                    </h2>
                                </div>
                                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-spotify-grey mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-spotify-green focus:outline-none"
                                                required
                                                placeholder="Playlist Name"
                                            />
                                        </div>
                                        {/* Specific Fields */}
                                        {mode === 'top' && (
                                            <div>
                                                <label className="block text-sm font-medium text-spotify-grey mb-1">Time Period</label>
                                                <select
                                                    value={timeRange}
                                                    onChange={(e) => setTimeRange(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:outline-none"
                                                >
                                                    <option value="7day">Last 7 Days (Week)</option>
                                                    <option value="1month">Last Month</option>
                                                    <option value="12month">Last Year</option>
                                                    <option value="overall">All Time</option>
                                                </select>
                                            </div>
                                        )}
                                        {mode === 'genre' && (
                                            <div>
                                                <label className="block text-sm font-medium text-spotify-grey mb-1">Genre Tag</label>
                                                <input
                                                    type="text"
                                                    value={genreTag}
                                                    onChange={(e) => setGenreTag(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-pink-500 focus:outline-none mb-2"
                                                    required
                                                    placeholder="e.g. Rock, Indie, 90s..."
                                                />
                                                <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto custom-scrollbar p-1">
                                                    {availableTags.map(tag => (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => setGenreTag(tag)}
                                                            className={cn(
                                                                "px-2 py-1 text-xs rounded-full border transition-colors",
                                                                genreTag.toLowerCase() === tag.toLowerCase()
                                                                    ? "bg-pink-500 text-white border-pink-500"
                                                                    : "bg-white/5 text-spotify-grey border-white/10 hover:border-pink-500/50 hover:text-white"
                                                            )}
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-spotify-grey mb-1">Description</label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-spotify-green focus:outline-none min-h-[60px]"
                                            placeholder="Optional description..."
                                        />
                                    </div>
                                </div>

                                {/* Rule Builder for Smart Mode */}
                                {mode === 'smart' && (
                                    <div className="space-y-4 pt-4 border-t border-white/10">
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

                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
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
                                                        className="bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-purple-500 focus:outline-none flex-1 min-w-0"
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
                                )}

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
                                        {loading ? 'Creating...' : `Create ${mode === 'smart' ? 'Smart Playlist' : mode === 'manual' ? 'Playlist' : 'Generator'}`}
                                    </button>
                                </div>
                            </form>
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// Simple ArrowLeft icon since standard import might miss it?
function ArrowLeft(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
        </svg>
    )
}

function BarChart3(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
        </svg>
    )
}
