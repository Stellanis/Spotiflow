import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PlayerProvider } from './contexts/PlayerContext';
import Layout from './layouts/Layout';

const Home = lazy(() => import('./pages/Home'));
const Library = lazy(() => import('./pages/Library'));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const ConcertsPage = lazy(() => import('./pages/ConcertsPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const ExploreShell = lazy(() => import('./pages/ExploreShell'));

function AppLoader() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-spotify-green" />
        </div>
    );
}

function App() {
    return (
        <PlayerProvider>
            <Suspense fallback={<AppLoader />}>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/explore" element={<ExploreShell />}>
                            <Route index element={<Navigate to="discover" replace />} />
                            <Route path="discover" element={<DiscoverPage />} />
                            <Route path="stats" element={<StatsPage />} />
                        </Route>
                        <Route path="/playlists" element={<PlaylistsPage />} />
                        <Route path="/concerts" element={<ConcertsPage />} />
                        <Route path="/jobs" element={<JobsPage />} />
                        <Route path="/settings" element={<Navigate to="/" replace state={{ openSettings: true }} />} />
                        <Route path="/discover" element={<Navigate to="/explore/discover" replace />} />
                        <Route path="/stats" element={<Navigate to="/explore/stats" replace />} />
                        <Route path="/undownloaded" element={<Navigate to="/library?tab=pending" replace />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </Suspense>
        </PlayerProvider>
    );
}

export default App;
