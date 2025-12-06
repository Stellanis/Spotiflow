import React, { useState } from 'react';
import { Share2, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

export function ShareButton({ targetRef, fileName = 'my-stats.png' }) {
    const [loading, setLoading] = useState(false);

    const handleShare = async () => {
        if (!targetRef.current || loading) return;

        setLoading(true);
        try {
            // Add capturing class to allow specific styling for the snapshot
            targetRef.current.classList.add('capturing');

            // html-to-image uses the browser's rendering via SVG, so it supports OKLCH/modern CSS
            const dataUrl = await toPng(targetRef.current, {
                backgroundColor: '#121212', // Ensure dark background
                pixelRatio: 2, // High quality
                cacheBust: true,
                filter: (node) => !node.classList?.contains('no-capture')
            });

            targetRef.current.classList.remove('capturing');

            // Check for native share support
            if (navigator.share && navigator.canShare) {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], fileName, { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'My Spotify Scrobbler Stats',
                        text: 'Check out my music stats!',
                        files: [file]
                    });
                    setLoading(false);
                    return;
                }
            }

            // Fallback to download
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Error sharing stats:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={loading}
            className="fixed bottom-6 right-6 z-50 bg-spotify-green text-black font-bold p-4 rounded-full shadow-lg hover:scale-105 transition-transform flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Share Stats"
        >
            {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
                <>
                    <Share2 className="w-6 h-6 group-hover:hidden" />
                    <Download className="w-6 h-6 hidden group-hover:block" />
                </>
            )}
        </button>
    );
}
