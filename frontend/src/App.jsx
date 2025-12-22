import { Routes, Route, Navigate } from 'react-router-dom';
import { PlayerProvider } from './contexts/PlayerContext';
import Layout from './layouts/Layout';

import Home from './pages/Home';
import Library from './pages/Library';
import PlaylistsPage from './pages/PlaylistsPage';
import Undownloaded from './pages/Undownloaded';
import JobsPage from './pages/JobsPage';
import StatsPage from './pages/StatsPage';
import ConcertsPage from './pages/ConcertsPage';

function App() {
  return (
    <PlayerProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/undownloaded" element={<Undownloaded />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/concerts" element={<ConcertsPage />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </PlayerProvider>
  );
}

export default App;
