import { Routes, Route, Navigate } from 'react-router-dom';
import { LEGACY_REDIRECTS } from './lib/device-scope';
import { DeviceScope } from './components/DeviceScope';
import { ControlRoomShell } from './components/ControlRoomShell';
import FleetHome from './routes/FleetHome';
import PlaylistTab from './routes/PlaylistTab';
import AppsTab from './routes/AppsTab';
import SettingsTab from './routes/SettingsTab';
import ScreenConfig from './routes/ScreenConfig';
import AppDetail from './routes/AppDetail';
import FaceGallery from './routes/FaceGallery';
import Setup from './routes/Setup';

// IA v2 (spec: docs/superpowers/specs/2026-08-08-admin-ia-v2-design.md):
// Fleet Home at /, Control Room per clock at /clock/:deviceId with nested
// tabs. Device scope's single source of truth is the URL — there is no
// device switcher and no global active-device state.
export default function AdminApp() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/" element={<FleetHome />} />
      <Route path="/clock/:deviceId" element={<DeviceScope />}>
        <Route element={<ControlRoomShell />}>
          <Route index element={<PlaylistTab />} />
          <Route path="apps" element={<AppsTab />} />
          <Route path="apps/clock/gallery" element={<FaceGallery />} />
          <Route path="apps/:appId" element={<AppDetail />} />
          <Route path="settings" element={<SettingsTab />} />
          <Route path="screens/:instanceId" element={<ScreenConfig />} />
        </Route>
      </Route>
      {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
