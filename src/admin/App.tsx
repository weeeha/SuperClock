import { Routes, Route, useLocation } from 'react-router-dom';
import { DeviceSwitcher } from './components/DeviceSwitcher';
import { NavTabs } from './components/NavTabs';
import Dashboard from './routes/Dashboard';
import Apps from './routes/Apps';
import AppDetail from './routes/AppDetail';
import FaceGallery from './routes/FaceGallery';
import FaceConfig from './routes/FaceConfig';
import Playlist from './routes/Playlist';
import Settings from './routes/Settings';
import Setup from './routes/Setup';

export default function AdminApp() {
  const location = useLocation();
  const onSetup = location.pathname === '/setup';

  if (onSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <h1 className="text-sm font-semibold tracking-tight">SuperClock Admin</h1>
          <DeviceSwitcher />
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="/apps/:appId" element={<AppDetail />} />
          <Route path="/apps/:appId/gallery" element={<FaceGallery />} />
          <Route path="/apps/:appId/faces/:instanceId" element={<FaceConfig />} />
          <Route path="/playlist" element={<Playlist />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <NavTabs />
    </div>
  );
}
