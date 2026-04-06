import { useRef, useState } from 'react';

import { normalizeTrack } from './trackUtils';

export function useQueueState() {
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(-1);
    const [queueSummary, setQueueSummary] = useState(null);
    const [activeDownloads, setActiveDownloads] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [queueMode, setQueueMode] = useState(null);
    const [sessionStatus, setSessionStatus] = useState(null);
    const [hasSuspendedRadio, setHasSuspendedRadio] = useState(false);

    const sessionIdRef = useRef(null);
    const hasRestoredSessionRef = useRef(false);

    const syncSessionState = (payload) => {
        const resolvedQueue = (payload.queue || []).map(normalizeTrack);
        const nextSessionId = payload.session_id ?? payload.sessionId ?? null;
        sessionIdRef.current = nextSessionId;
        setSessionId(nextSessionId);
        setQueueMode(payload.mode || payload.queue_mode || null);
        setSessionStatus(payload.status || null);
        setQueue(resolvedQueue);
        setQueueIndex(payload.current_index ?? -1);
        setQueueSummary(payload.queue_summary || null);
        setHasSuspendedRadio(Boolean(payload.suspended_queue_summary?.total));
    };

    const resetSessionState = () => {
        sessionIdRef.current = null;
        setSessionId(null);
        setQueue([]);
        setQueueIndex(-1);
        setQueueMode(null);
        setQueueSummary(null);
        setHasSuspendedRadio(false);
    };

    return {
        queue,
        setQueue,
        queueIndex,
        setQueueIndex,
        queueSummary,
        setQueueSummary,
        activeDownloads,
        setActiveDownloads,
        sessionId,
        setSessionId,
        queueMode,
        setQueueMode,
        sessionStatus,
        setSessionStatus,
        hasSuspendedRadio,
        setHasSuspendedRadio,
        sessionIdRef,
        hasRestoredSessionRef,
        syncSessionState,
        resetSessionState,
    };
}
