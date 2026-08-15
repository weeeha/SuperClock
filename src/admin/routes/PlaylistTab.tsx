import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { ScreenRow } from '../components/ScreenRow';
import { AddScreenSheet } from '../components/AddScreenSheet';
import { PushOutcomeChip } from '../components/PushOutcomeChip';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus } from '../lib/device-scope';
import { artForInstance } from '../lib/screen-art';
import { cn } from '../lib/cn';
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';
import type { DeviceConfig, PushOutcome, ScreenInstance } from '../../shared/types';

// Playlist tab (wf/2): rotation segmented control, dnd-kit reorderable screen
// rows, "+ Add screen". P1 omissions per plan: no "now" badge (device state is
// a stub), no schedule strips / "new" pill (P3), no identify.

const ROTATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Off', value: null },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

export default function PlaylistTab() {
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);
  const info = STATIC_DEVICE_INFO[deviceId];
  const queryClient = useQueryClient();

  const [outcome, setOutcome] = useState<PushOutcome | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ScreenInstance | null>(null);

  const cfgQ = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => adminApi.getDevice(deviceId),
  });
  const cfg = cfgQ.data ?? undefined;

  // Writes stay ENABLED while a clock is unreachable — they persist to
  // fleet.json and the 60s retry drain delivers, which the `queued` chip
  // reports honestly (the shell banner already promises exactly this).
  // Only read-only devices disable writes. `status` still drives the banner.
  void status;
  const writesDisabled = info.readOnly;

  const rotation = useMutation({
    mutationFn: (rotationSeconds: number | null) => {
      if (!cfg) throw new Error('config not loaded');
      return adminApi.patchDevice(deviceId, { playlist: { ...cfg.playlist, rotationSeconds } });
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['device', deviceId], res.config);
      setOutcome(res.pushOutcome);
    },
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => adminApi.reorderPlaylist(deviceId, order),
    onMutate: async (order) => {
      // Optimistic: rows follow the drop immediately; settle refetches truth.
      await queryClient.cancelQueries({ queryKey: ['device', deviceId] });
      const prev = queryClient.getQueryData<DeviceConfig | null>(['device', deviceId]);
      if (prev) {
        queryClient.setQueryData<DeviceConfig | null>(['device', deviceId], {
          ...prev,
          playlist: { ...prev.playlist, items: order },
        });
      }
      return { prev };
    },
    onError: (_err, _order, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(['device', deviceId], ctx.prev);
    },
    onSuccess: (res) => setOutcome(res.pushOutcome),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteInstance(deviceId, id),
    onSuccess: (res) => {
      setOutcome(res.pushOutcome);
      setRemoveTarget(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  // Sensor/SortableContext/onDragEnd shape copied from the pre-rebuild
  // Playlist.tsx (8ef91bf): pointer distance 6 so taps don't start drags.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const playlistIds = cfg?.playlist.items ?? [];
  const rows = playlistIds
    .map((id) => cfg?.instances.find((i) => i.id === id))
    .filter((i): i is ScreenInstance => Boolean(i));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = playlistIds.indexOf(String(e.active.id));
    const newIdx = playlistIds.indexOf(String(e.over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    reorder.mutate(arrayMove(playlistIds, oldIdx, newIdx));
  };

  // Segmented control reflects the in-flight value (variables pattern) so a
  // tap answers immediately and reverts honestly if the write fails.
  const shownRotation =
    rotation.isPending && rotation.variables !== undefined
      ? rotation.variables
      : (cfg?.playlist.rotationSeconds ?? null);
  const isPresetRotation = ROTATION_OPTIONS.some((o) => o.value === shownRotation);
  const writeFailed = rotation.isError || reorder.isError;

  if (cfgQ.isPending) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-13 rounded-lg bg-[hsl(var(--muted))] opacity-40" />
        <div className="h-18 rounded-lg bg-[hsl(var(--muted))] opacity-40" />
        <div className="h-18 rounded-lg bg-[hsl(var(--muted))] opacity-40" />
        <div className="h-18 rounded-lg bg-[hsl(var(--muted))] opacity-40" />
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-4">
        <p className="text-sm opacity-80">couldn't load this clock's config</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void cfgQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section aria-label="Rotation" className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Rotate every</span>
          <div role="group" aria-label="Rotation interval" className="flex gap-1">
            {ROTATION_OPTIONS.map((opt) => {
              const selected = shownRotation === opt.value;
              return (
                <button
                  key={opt.label}
                  aria-pressed={selected}
                  disabled={writesDisabled || rotation.isPending}
                  onClick={() => {
                    if (!selected) rotation.mutate(opt.value);
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50',
                    selected
                      ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                      : 'bg-[hsl(var(--card))] opacity-80',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        {!isPresetRotation && shownRotation !== null && (
          <p className="mt-1.5 text-xs opacity-60">
            custom interval: {shownRotation}s — pick a preset to change it
          </p>
        )}
      </section>

      <div className="flex h-6 items-center justify-end">
        {writeFailed ? (
          <span className="text-xs text-[hsl(var(--destructive))]">save failed — try again</span>
        ) : (
          <PushOutcomeChip outcome={outcome} />
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[hsl(var(--border))] p-4 text-sm opacity-70">
          Nothing in this clock's playlist yet.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {rows.map((inst) => (
                <ScreenRow
                  key={inst.id}
                  instance={inst}
                  writesDisabled={writesDisabled}
                  onRemove={setRemoveTarget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="pt-3">
        <Button
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={writesDisabled}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" /> Add screen
        </Button>
        <p className="mt-3 text-center text-xs opacity-50">
          {info.readOnly
            ? 'read-only clock — playlist changes are disabled'
            : 'changes push live · saved to fleet.json'}
        </p>
      </div>

      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove screen?"
      >
        <p className="text-sm opacity-80">
          Removes “{removeTarget ? artForInstance(removeTarget).label : ''}” and its settings from
          this clock.
        </p>
        {remove.isError && (
          <p className="mt-2 text-xs text-[hsl(var(--destructive))]">remove failed — try again</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoveTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => removeTarget && remove.mutate(removeTarget.id)}
          >
            Remove screen
          </Button>
        </div>
      </Dialog>

      <AddScreenSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
