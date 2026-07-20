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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PlaylistRow } from '../components/PlaylistRow';
import { Dialog } from '../components/ui/dialog';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';

export default function Playlist() {
  const { activeDeviceId } = useActiveDevice();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const deviceQ = useQuery({
    queryKey: ['device', activeDeviceId],
    queryFn: () => adminApi.getDevice(activeDeviceId),
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => adminApi.reorderPlaylist(activeDeviceId, order),
    onSuccess: (updated) => queryClient.setQueryData(['device', activeDeviceId], updated),
  });
  const patch = useMutation({
    mutationFn: (rotationSeconds: number | null) =>
      adminApi.patchDevice(activeDeviceId, {
        playlist: { ...(deviceQ.data?.playlist ?? { items: [] }), rotationSeconds },
      }),
    onSuccess: (updated) => queryClient.setQueryData(['device', activeDeviceId], updated),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const config = deviceQ.data;
  const allInstances = config?.instances ?? [];
  const playlistIds = config?.playlist.items ?? [];
  const rotationSeconds = config?.playlist.rotationSeconds ?? null;

  // Draft the seconds field locally and commit on blur/Enter — patching on
  // every keystroke persisted (and pushed fleet-wide) "1", then "12", then
  // "120" while typing.
  const [secondsDraft, setSecondsDraft] = useState<string | null>(null);
  const commitSecondsDraft = () => {
    if (secondsDraft === null) return;
    const n = Number(secondsDraft);
    const clamped = Number.isFinite(n) && n > 0 ? Math.min(3600, Math.max(5, Math.round(n))) : 30;
    setSecondsDraft(null);
    if (clamped !== rotationSeconds) patch.mutate(clamped);
  };

  const playlistInstances = playlistIds
    .map((id) => allInstances.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));
  const notInPlaylist = allInstances.filter((i) => !playlistIds.includes(i.id));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = playlistIds.indexOf(e.active.id as string);
    const newIdx = playlistIds.indexOf(e.over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    reorder.mutate(arrayMove(playlistIds, oldIdx, newIdx));
  };

  const removeFromPlaylist = (id: string) => {
    reorder.mutate(playlistIds.filter((x) => x !== id));
  };

  const addToPlaylist = (id: string) => {
    reorder.mutate([...playlistIds, id]);
    setAddOpen(false);
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Playlist</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Auto-rotates through these screens on <span className="font-medium">{activeDeviceId}</span>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Rotation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">
              <input
                type="radio"
                name="rotation-mode"
                checked={rotationSeconds === null}
                onChange={() => patch.mutate(null)}
                className="mr-2"
              />
              Off (manual swipe only)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rotation-mode"
                checked={rotationSeconds !== null}
                onChange={() => patch.mutate(rotationSeconds ?? 30)}
                className="mr-1"
              />
              Every
            </label>
            <input
              type="number"
              min={5}
              max={3600}
              disabled={rotationSeconds === null}
              value={secondsDraft ?? rotationSeconds ?? 30}
              onChange={(e) => setSecondsDraft(e.target.value)}
              onBlur={() => commitSecondsDraft()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="w-20 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-sm disabled:opacity-50"
            />
            <span className="text-sm opacity-60">seconds</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order ({playlistInstances.length})</CardTitle>
            <Button size="sm" onClick={() => setAddOpen(true)} disabled={notInPlaylist.length === 0}>
              <Plus className="h-4 w-4" /> Add screen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {playlistInstances.length === 0 && (
            <p className="text-sm opacity-60">
              No screens in the playlist. Tap "Add screen" to add one. (Create instances first via the Apps tab.)
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={playlistIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {playlistInstances.map((instance, idx) => (
                  <PlaylistRow
                    key={instance.id}
                    index={idx}
                    instance={instance}
                    onRemove={removeFromPlaylist}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add to playlist">
        {notInPlaylist.length === 0 ? (
          <p className="text-sm opacity-60">All instances are already in the playlist.</p>
        ) : (
          <div className="space-y-1">
            {notInPlaylist.map((inst) => (
              <button
                key={inst.id}
                onClick={() => addToPlaylist(inst.id)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
              >
                <span>{inst.label ?? inst.appId}</span>
                <span className="text-xs opacity-60">{inst.appId}</span>
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
