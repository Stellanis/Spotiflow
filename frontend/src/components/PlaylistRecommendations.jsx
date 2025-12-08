import { useState, useEffect } from 'react';
import { Plus, Check, Music } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { toast } from 'react-hot-toast';

export function PlaylistRecommendations({ playlistId, onAdd }) {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState(new Set());

    useEffect(() => {
        fetchRecommendations();
    }, [playlistId]);

    const fetchRecommendations = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/playlists/${playlistId}/recommendations`);
            if (res.ok) {
                const data = await res.json();
                setRecommendations(data || []);
            }
        } catch (error) {
            console.error("Failed to load recs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (song) => {
        try {
            const res = await fetch(`/api/playlists/${playlistId}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playlist_id: playlistId,
                    song_query: song.query
                })
            });

            if (res.ok) {
                setAddedIds(prev => new Set(prev).add(song.query));
                if (onAdd) onAdd(song);
                toast.success(`Added ${song.title}`);
            }
        } catch (error) {
            toast.error("Failed to add song");
        }
    };

    if (loading) return <div className="py-10 text-center text-spotify-grey animate-pulse">Looking for suggestions...</div>;
    if (recommendations.length === 0) return null;

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-white">Recommended for you</h3>
            <p className="text-sm text-spotify-grey">Based on the songs in this playlist</p>

            <div className="space-y-2">
                {recommendations.map(song => (
                    <div
                        key={song.query}
                        className="flex items-center gap-4 p-2 rounded-md hover:bg-white/5 transition-colors group"
                    >
                        <div className="w-10 h-10 bg-white/10 rounded overflow-hidden shrink-0">
                            {song.image_url ? (
                                <img src={song.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full w-full bg-spotify-grey/20">
                                    <Music className="w-4 h-4 text-spotify-grey" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-white">{song.title}</div>
                            <div className="text-sm text-spotify-grey truncate">{song.artist}</div>
                        </div>

                        <button
                            onClick={() => handleAdd(song)}
                            disabled={addedIds.has(song.query)}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {addedIds.has(song.query) ? (
                                <Check className="w-5 h-5 text-spotify-green" />
                            ) : (
                                <Plus className="w-5 h-5 text-white" />
                            )}
                        </button>
                    </div>
                ))}
            </div>

            <div className="pt-4 text-center">
                <button
                    onClick={fetchRecommendations}
                    className="text-sm text-spotify-grey hover:text-white transition-colors"
                >
                    Refresh Suggestions
                </button>
            </div>
        </div>
    );
}
