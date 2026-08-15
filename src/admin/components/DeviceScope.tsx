import { useParams, Navigate, Outlet } from 'react-router-dom';
import { resolveDeviceParam } from '../lib/device-scope';

// Layout route guarding /clock/:deviceId — unknown ids bounce to Fleet Home,
// so useDeviceId() below this route can assume a validated param. Lives apart
// from lib/device-scope.ts because react-refresh wants component-only files.
export function DeviceScope() {
  const { deviceId } = useParams();
  if (!resolveDeviceParam(deviceId)) return <Navigate to="/" replace />;
  return <Outlet />;
}
