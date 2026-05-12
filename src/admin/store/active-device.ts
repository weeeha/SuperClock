import { create } from 'zustand';
import { ALL_DEVICE_IDS, type DeviceId } from '../../shared/types';

const STORAGE_KEY = 'superclock:admin-active-device';

function loadInitial(): DeviceId {
  if (typeof localStorage === 'undefined') return 'superclock-fast';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (ALL_DEVICE_IDS as readonly string[]).includes(stored)) {
    return stored as DeviceId;
  }
  return 'superclock-fast';
}

interface ActiveDeviceState {
  activeDeviceId: DeviceId;
  setActiveDevice: (id: DeviceId) => void;
}

export const useActiveDevice = create<ActiveDeviceState>((set) => ({
  activeDeviceId: loadInitial(),
  setActiveDevice: (id) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
    set({ activeDeviceId: id });
  },
}));
