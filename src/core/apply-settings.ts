import { useEffect } from 'react';
import { useDeviceConfig } from './device-config';

// Reflects DeviceConfig.settings on the live kiosk DOM.
//   accent  → overrides --color-accent on <html>
//   theme   → toggles a `light`/`dark` class on <html> (light/system fall back to dark in v1)
// brightness + sleep schedule still need a Pi-side adapter (xrandr/wlr-randr);
// see scripts/setup-pi.sh follow-up.
export function useApplySettings(): void {
  const config = useDeviceConfig();
  const accent = config?.settings.accent;
  const theme = config?.settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--color-accent', accent);
    } else {
      root.style.removeProperty('--color-accent');
    }
    return () => {
      root.style.removeProperty('--color-accent');
    };
  }, [accent]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);
}
