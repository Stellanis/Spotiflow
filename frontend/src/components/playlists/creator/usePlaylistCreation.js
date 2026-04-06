import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export function usePlaylistCreation({ isOpen, onClose, onCreate, initialMode = 'menu' }) {
    const [mode, setMode] = useState(initialMode);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [matchType, setMatchType] = useState('all');
    const [rules, setRules] = useState([{ field: 'artist', operator: 'contains', value: '' }]);
    const [timeRange, setTimeRange] = useState('overall');
    const [genreTag, setGenreTag] = useState('');
    const [availableTags, setAvailableTags] = useState([]);

    const vibePresets = [
        { id: 'midnight', label: 'The Midnight Lounge', icon: '🌙', tags: ['jazz', 'blues', 'ambient', 'chill', 'mellow'], description: 'Late night vibes. Smooth, atmospheric and relaxed.' },
        { id: 'energy', label: 'High Energy', icon: '⚡', tags: ['rock', 'metal', 'dance', 'electronic', 'upbeat'], description: 'Keep the momentum going. Perfect for workouts or focus.' },
        { id: 'focus', label: 'Deep Focus', icon: '🧠', tags: ['classical', 'instrumental', 'ambient', 'lo-fi', 'soundtrack'], description: 'Minimal distractions. Atmospheric sounds for deep work.' },
        { id: 'indie', label: 'Indie Discovery', icon: '🎸', tags: ['indie', 'alternative', 'shoegaze', 'dream pop'], description: 'The best of your indie and alternative collection.' },
    ];

    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);

    useEffect(() => {
        if (mode === 'genre') {
            axios.get('/api/playlists/tags')
                .then((response) => setAvailableTags(response.data))
                .catch((error) => console.error('Failed to fetch tags', error));
        }
    }, [mode]);

    const resetForm = () => {
        setName('');
        setDescription('');
        setMode('menu');
        setRules([{ field: 'artist', operator: 'contains', value: '' }]);
        setTimeRange('overall');
        setGenreTag('');
    };

    const handleAddRule = () => setRules([...rules, { field: 'artist', operator: 'contains', value: '' }]);
    const handleRemoveRule = (index) => setRules(rules.filter((_, ruleIndex) => ruleIndex !== index));
    const handleRuleChange = (index, key, value) => {
        const nextRules = [...rules];
        nextRules[index][key] = value;
        setRules(nextRules);
    };

    const createManualOrSmart = async (type) => axios.post('/api/playlists', {
        name,
        description,
        type,
        rules: type === 'smart' ? JSON.stringify({ match_type: matchType, rules }) : null,
    });

    const createTopSongs = async () => axios.post('/api/playlists/generate/top', {
        name: name || `Top Songs (${timeRange})`,
        description: description || `My top songs from ${timeRange}`,
        period: timeRange,
    });

    const createGenre = async (payload = null) => axios.post('/api/playlists/generate/genre', payload || {
        name: name || `${genreTag} Mix`,
        description: description || `A mix of ${genreTag} tracks`,
        tag: genreTag,
    });

    const handleVibeCreate = async (vibe) => {
        setLoading(true);
        try {
            const response = await createGenre({
                name: vibe.label,
                description: vibe.description,
                tags: vibe.tags,
            });
            if (onCreate) onCreate(response.data);
            toast.success(`${vibe.label} playlist generated!`);
            onClose();
            resetForm();
        } catch (error) {
            console.error('Error generating vibe playlist:', error);
            toast.error('Failed to generate vibe playlist');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            let response;
            if (mode === 'manual') response = await createManualOrSmart('manual');
            else if (mode === 'smart') response = await createManualOrSmart('smart');
            else if (mode === 'top') response = await createTopSongs();
            else if (mode === 'genre') response = await createGenre();

            if (onCreate && response) onCreate(response.data);
            toast.success('Playlist created');
            resetForm();
            onClose();
        } catch (error) {
            console.error('Error creating playlist:', error);
            toast.error(error.response?.data?.detail || 'Failed to create playlist');
        } finally {
            setLoading(false);
        }
    };

    return {
        mode,
        setMode,
        name,
        setName,
        description,
        setDescription,
        loading,
        matchType,
        setMatchType,
        rules,
        timeRange,
        setTimeRange,
        genreTag,
        setGenreTag,
        availableTags,
        vibePresets,
        resetForm,
        handleAddRule,
        handleRemoveRule,
        handleRuleChange,
        handleVibeCreate,
        handleSubmit,
    };
}
