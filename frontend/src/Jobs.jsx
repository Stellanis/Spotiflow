import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Download, CheckCircle, Hourglass } from 'lucide-react';

function Jobs() {
    const [jobs, setJobs] = useState({ active_downloads: [], next_scrobble_check: null });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchJobs = async () => {
        try {
            const response = await fetch('http://localhost:8000/jobs');
            if (response.ok) {
                const data = await response.json();
                setJobs(data);
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

    const triggerSync = async () => {
        setSyncing(true);
        try {
            await fetch('http://localhost:8000/sync', { method: 'POST' });
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
        <div className="p-6 text-white">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Hourglass className="text-yellow-400" /> Background Jobs
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Scrobble Check Status */}
                <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">Scrobble Sync</h2>
                            <p className="text-gray-400 text-sm">Checks Last.fm for new tracks</p>
                        </div>
                        <Clock className="text-blue-400 text-2xl" />
                    </div>

                    <div className="mb-4">
                        <p className="text-gray-300">Next Check:</p>
                        <p className="text-xl font-mono text-blue-300">{formatDate(jobs.next_scrobble_check)}</p>
                    </div>

                    <button
                        onClick={triggerSync}
                        disabled={syncing}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2
              ${syncing ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:scale-95'}`}
                    >
                        <RefreshCw className={syncing ? "animate-spin" : ""} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>

                {/* Download Stats */}
                <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">Download Queue</h2>
                            <p className="text-gray-400 text-sm">Active and queued downloads</p>
                        </div>
                        <Download className="text-green-400 text-2xl" />
                    </div>
                    <div className="flex gap-4">
                        <div className="text-center p-3 bg-gray-700 rounded-lg flex-1">
                            <p className="text-2xl font-bold text-green-400">
                                {jobs.active_downloads.filter(j => j.status === 'downloading').length}
                            </p>
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Active</p>
                        </div>
                        <div className="text-center p-3 bg-gray-700 rounded-lg flex-1">
                            <p className="text-2xl font-bold text-yellow-400">
                                {jobs.active_downloads.filter(j => j.status === 'queued').length}
                            </p>
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Queued</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Downloads List */}
            <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <h2 className="text-lg font-semibold">Active Tasks</h2>
                </div>

                {jobs.active_downloads.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle className="text-4xl mx-auto mb-3 opacity-20" />
                        <p>No active downloads</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {jobs.active_downloads.map((job, index) => (
                            <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
                                <div className="flex-1 min-w-0 mr-4">
                                    <p className="font-medium truncate text-white">{job.title || job.query}</p>
                                    <p className="text-sm text-gray-400 truncate">{job.artist || 'Unknown Artist'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                                ${job.status === 'downloading'
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                                        {job.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Jobs;
