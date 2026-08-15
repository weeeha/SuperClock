import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus, deviceDisplayName } from '../lib/device-scope';
import { STATIC_DEVICE_INFO, buildCapabilities } from '../../shared/capabilities';
import { listAddableScreens, buildNewInstance, type AddableScreen } from '../lib/add-screen';
import { cn } from '../lib/cn';

// Add Screen sheet (wf/3): one flattened picker — "Clock faces" (registry
// preview art, round like the glass) then "Apps" (grid icons). Tap creates
// the instance with schema defaults and lands on its Screen Config. Bottom
// sheet under `sm:`, centered dialog above. No mashup entry in P1.

const tileFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]';

export function AddScreenSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);
  const info = STATIC_DEVICE_INFO[deviceId];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const entries = useMemo(() => listAddableScreens(buildCapabilities(deviceId)), [deviceId]);
  const faces = entries.filter((e) => e.kind === 'face');
  const apps = entries.filter((e) => e.kind === 'app');

  const create = useMutation({
    mutationFn: (entry: AddableScreen) =>
      adminApi.createInstance(deviceId, buildNewInstance(entry)),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      onClose();
      // pushOutcome rides along for the destination surface (Task 6/9 may
      // render its chip there — the sheet itself unmounts on navigation).
      navigate(`/clock/${deviceId}/screens/${result.instance.id}`, {
        state: { pushOutcome: result.pushOutcome },
      });
    },
  });

  const handleClose = () => {
    create.reset();
    onClose();
  };

  // Write affordances off for read-only devices and (per the common surface
  // contract) while the clock is unreachable. Unknown health ≠ offline.
  const blocked = info.readOnly || (status.known && !status.reachable);
  const disabled = blocked || create.isPending;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      className="max-sm:self-end max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-8"
    >
      <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-[hsl(var(--muted))] sm:hidden" />
      <header className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add screen to {deviceDisplayName(deviceId)}</h2>
        <button
          onClick={handleClose}
          className={cn('rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-[hsl(var(--muted))]', tileFocus)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {blocked && (
        <p className="mt-2 rounded-md bg-[hsl(var(--warning)/0.1)] p-2.5 text-xs text-[hsl(var(--warning-foreground))]">
          {info.readOnly
            ? "read-only clock — screens can't be added"
            : 'clock unreachable — changes will queue'}
        </p>
      )}

      <section aria-label="Clock faces" className="mt-4">
        <h3 className="text-sm font-medium opacity-60">Clock faces</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {faces.map((face) => (
            <button
              key={face.faceId}
              onClick={() => create.mutate(face)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg p-2 text-center hover:bg-[hsl(var(--muted))]',
                'disabled:pointer-events-none disabled:opacity-50',
                tileFocus,
              )}
            >
              <span className="block aspect-square w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <img src={face.preview} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="text-xs font-medium">{face.name}</span>
            </button>
          ))}
        </div>
      </section>

      {apps.length > 0 && (
        <section aria-label="Apps" className="mt-5">
          <h3 className="text-sm font-medium opacity-60">Apps</h3>
          <div className="mt-1">
            {apps.map((app) => (
              <button
                key={app.appId}
                onClick={() => create.mutate(app)}
                disabled={disabled}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[hsl(var(--muted))]',
                  'disabled:pointer-events-none disabled:opacity-50',
                  tileFocus,
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[hsl(var(--muted))]"
                >
                  {app.icon ? (
                    <img src={app.icon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium opacity-60">{app.name[0]}</span>
                  )}
                </span>
                <span className="text-sm font-medium">{app.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p aria-live="polite" className="mt-3 min-h-4 text-xs">
        {create.isPending && (
          <span className="opacity-60">adding {create.variables.name}…</span>
        )}
        {create.isError && (
          <span className="text-[hsl(var(--destructive))]">
            couldn't add {create.variables?.name ?? 'screen'} — {create.error.message}
          </span>
        )}
      </p>
    </Dialog>
  );
}
