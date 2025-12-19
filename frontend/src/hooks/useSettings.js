import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = '/api';

export function useSettings() {
    const [username, setUsername] = useState('');
    const [autoDownload, setAutoDownload] = useState(true);
    const [hiddenFeatures, setHiddenFeatures] = useState(new Set());
    const [showTutorial, setShowTutorial] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    const fetchSettings = useCallback(async () => {
        try {
            setLoadingSettings(true);
            const response = await axios.get(`${API_URL}/settings`);
            if (response.data.LASTFM_USER) {
                setUsername(response.data.LASTFM_USER);
            }
            setAutoDownload(response.data.AUTO_DOWNLOAD !== 'false');

            // Check if tutorial has been seen
            if (response.data.TUTORIAL_SEEN !== 'true') {
                setShowTutorial(true);
            }

            const hidden = response.data.HIDDEN_FEATURES ? response.data.HIDDEN_FEATURES.split(',') : [];
            setHiddenFeatures(new Set(hidden));
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoadingSettings(false);
        }
    }, []);

    const updateSettings = useCallback((newUsername, newAutoDownload, newHiddenFeatures) => {
        setUsername(newUsername);
        setAutoDownload(newAutoDownload);
        setHiddenFeatures(new Set(newHiddenFeatures));
    }, []);

    const closeTutorial = useCallback(async () => {
        setShowTutorial(false);
        try {
            await axios.post(`${API_URL}/settings`, { tutorial_seen: true });
        } catch (error) {
            console.error("Failed to save tutorial status:", error);
        }
    }, []);

    return {
        username,
        setUsername,
        autoDownload,
        setAutoDownload,
        hiddenFeatures,
        setHiddenFeatures,
        showTutorial,
        setShowTutorial,
        loadingSettings,
        fetchSettings,
        updateSettings,
        closeTutorial
    };
}
