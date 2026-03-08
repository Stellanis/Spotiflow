import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Download, CheckCircle, Hourglass, XCircle, RotateCcw } from 'lucide-react';
import { cn } from './utils';

function Jobs() {
    const [jobs, setJobs] = useState({ active_downloads: [], next_scrobble_check: null });
    const [failedJobs, setFailedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [retrying, setRetrying] = useState(false);

    const fetchJobs = async () => {
        try {
            const [jobsRes, failedRes] = await Promise.all([
                fetch('/api/jobs'),
                fetch('/api/downloads?status=failed&limit=50')
            ]);

            if (jobsRes.ok) {
                const data = await jobsRes.json();
                setJobs(data);
            }
            if (failedRes.ok) {
                const data = await failedRes.json();
                setFailedJobs(data.items || []);
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, []);

    const retryAllFailed = async () => {
        setRetrying(true);
        try {
            await fetch('/api/download/retry-failed', { method: 'POST' });
            fetchJobs();
        } catch (error) {
            console.error('Error retrying failed jobs:', error);
        } finally {
            setRetrying(false);
        }
    };

    const triggerSync = async () => {
        setSyncing(true);
        try {
            await fetch('/api/sync', { method: 'POST' });
            // Ideally show a toast or notification
        } catch (error) {
            console.error('Error triggering sync:', error);
        } finally {
            setTimeout(() => setSyncing(false), 1000);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not scheduled';
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="text-white">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Hourglass className="text-spotify-green" /> Background Jobs
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Scrobble Check Status */}
                <div className="glass-panel p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">Scrobble Sync</h2>
                            <p className="text-spotify-grey text-sm">Checks Last.fm for new tracks</p>
                        </div>
                        <Clock className="text-spotify-green text-2xl" />
                    </div>

                    <div className="mb-4">
                        <p className="text-spotify-grey">Next Check:</p>
                        <p className="text-xl font-mono text-white">{formatDate(jobs.next_scrobble_check)}</p>
                    </div>

                    <button
                        onClick={triggerSync}
                        disabled={syncing}
                        className={cn(
                            "w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                            syncing
                                ? "bg-white/10 cursor-not-allowed text-spotify-grey"
                                : "bg-spotify-green text-white hover:scale-105"
                        )}
                    >
                        <RefreshCw className={syncing ? "animate-spin" : ""} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>

                {/* Download Stats */}
                <div className="glass-panel p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">Download Queue</h2>
                            <p className="text-spotify-grey text-sm">Active and queued downloads</p>
                        </div>
                        <Download className="text-spotify-green text-2xl" />
                    </div>
                    <div className="flex gap-4">
                        <div className="text-center p-3 bg-white/5 rounded-lg flex-1">
                            <p className="text-2xl font-bold text-spotify-green">
                                {jobs.active_downloads.filter(j => j.status === 'downloading').length}
                            </p>
                            <p className="text-xs text-spotify-grey uppercase tracking-wider">Active</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-lg flex-1">
                            <p className="text-2xl font-bold text-yellow-500">
                                {jobs.active_downloads.filter(j => j.status === 'queued').length}
                            </p>
                            <p className="text-xs text-spotify-grey uppercase tracking-wider">Queued</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Downloads List */}
            <div className="glass-panel overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-lg font-semibold">Active Tasks</h2>
                </div>

                {jobs.active_downloads.length === 0 ? (
                    <div className="p-8 text-center text-spotify-grey">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No active downloads</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/10">
                        {jobs.active_downloads.map((job, index) => (
                            <div key={index} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors starting:opacity-0 starting:-translate-y-4 duration-500 ease-out">
                                <div className="flex-1 min-w-0 mr-4">
                                    <p className="font-medium truncate text-white">{job.title || job.query}</p>
                                    <p className="text-sm text-spotify-grey truncate">{job.artist || 'Unknown Artist'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide border",
                                        job.status === 'downloading'
                                            ? "bg-spotify-green/20 text-spotify-green border-spotify-green/30"
                                            : "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                                    )}>
                                        {job.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Failed Downloads List */}
            {failedJobs.length > 0 && (
                <div className="glass-panel overflow-hidden mt-8 border-red-500/30">
                    <div className="p-4 border-b border-white/10 bg-red-500/10 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                            <XCircle className="w-5 h-5" /> Failed Tasks
                        </h2>
                        <button
                            onClick={retryAllFailed}
                            disabled={retrying}
                            className="bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <RotateCcw className={cn("w-4 h-4", retrying && "animate-spin")} />
                            {retrying ? "Retrying..." : "Retry All"}
                        </button>
                    </div>

                    <div className="divide-y divide-white/10 max-h-96 overflow-y-auto custom-scrollbar">
                        {failedJobs.map((job, index) => (
                            <div key={index} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                <div className="flex-1 min-w-0 mr-4">
                                    <p className="font-medium truncate text-white">{job.title || job.query}</p>
                                    <p className="text-sm text-spotify-grey truncate">{job.artist || 'Unknown Artist'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30">
                                        Failed
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Jobs;
