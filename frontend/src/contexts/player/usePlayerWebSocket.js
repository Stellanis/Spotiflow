import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

export function usePlayerWebSocket({
    sessionIdRef,
    setActiveDownloads,
    syncSessionState,
    setStreamStatus,
    setIsPromoted,
}) {
    const wsRef = useRef(null);

    useEffect(() => {
        const connect = () => {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.active_downloads) {
                        setActiveDownloads(data.active_downloads);
                    }
                    if (data.type === 'playback.session' && data.session_id && data.session_id === sessionIdRef.current) {
                        if (data.queue) {
                            syncSessionState(data);
                        }
                        if (data.stream_health?.status) {
                            setStreamStatus(data.stream_health.status === 'healthy' ? 'streaming' : data.stream_health.status);
                            if (data.stream_health.status === 'cooldown') {
                                toast.error('Stream source is cooling down after repeated playback errors');
                            }
                        }
                        if (data.event?.event_type === 'error') {
                            setStreamStatus('error');
                        }
                        if (Array.isArray(data.promotion_events) && data.promotion_events.length > 0) {
                            setIsPromoted(true);
                            toast.success(`Queued "${data.promotion_events[0].title}" for download`);
                        }
                    }
                } catch (error) {
                    console.error('WS parse error', error);
                }
            };

            ws.onclose = () => {
                setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        connect();
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [sessionIdRef, setActiveDownloads, setIsPromoted, setStreamStatus, syncSessionState]);
}
