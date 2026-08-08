// Array-field widgets for SchemaForm; schema-introspect.ts decides which
// fields route here.
//
// StringListField — z.array(z.string()): inline-editable rows with add,
// remove, and drag-reorder. With meta.identityKeyed it warns when an entry
// that existed before this editing session is renamed, because the entry's
// text doubles as its storage id (HabitsApp keys streak history by the
// trimmed lowercased name).
//
// EnumOrderField — z.array(z.enum(...)): one row per option with a checkbox;
// enabled rows sort on top and their order IS the array value. The last
// enabled row is pinned (min-1); refine errors surface via FieldShell.
//
// Both own a per-field DndContext. Reorder wiring mirrors Playlist.tsx /
// PlaylistRow.tsx (PointerSensor distance 6 so taps don't start drags).

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, TriangleAlert, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { humanize, splitEnumSelection } from './schema-introspect';

function useRowSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

const rowClass =
  'flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1.5 pl-2.5 pr-1.5';
const iconButtonClass =
  'rounded-md p-1 opacity-60 hover:bg-[hsl(var(--muted))] hover:opacity-100';
const handleClass = `${iconButtonClass} cursor-grab touch-none active:cursor-grabbing`;

/* ---------------------------------------------------------------------- */
/* StringListField                                                         */

interface Row {
  id: string;
  text: string;
}

interface ListState {
  rows: Row[];
  /** id → text at the last outside sync; reference point for identityKeyed
   *  rename warnings. Rows added in this session are absent by design. */
  baseline: ReadonlyMap<string, string>;
  /** The exact array last handed to onChange. When it comes back as the
   *  value prop it's our own echo, not an outside change — resyncing on it
   *  would wipe row ids and the baseline mid-edit. Lives in state (not a
   *  ref) because the resync guard runs during render. */
  emitted: unknown;
}

function stateFromValue(value: unknown): ListState {
  const texts = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
  // Positional ids keep this pure for render-phase construction; rows added
  // later get counter ids from an event handler (`a` prefix, so the two
  // ranges can't collide).
  const rows = texts.map((text, i) => ({ id: `r${i}`, text }));
  return { rows, baseline: new Map(rows.map((r) => [r.id, r.text])), emitted: null };
}

/** How identity-keyed consumers derive ids (HabitsApp: trim + lowercase) —
 *  a case- or whitespace-only rename does not re-key and must not warn. */
function identity(s: string): string {
  return s.trim().toLowerCase();
}

let addCounter = 0;

export function StringListField({
  value,
  placeholder,
  identityKeyed,
  onChange,
}: {
  value: unknown;
  placeholder?: string;
  identityKeyed?: boolean;
  onChange: (items: string[]) => void;
}) {
  const [state, setState] = useState<ListState>(() => stateFromValue(value));
  const [draft, setDraft] = useState('');
  const sensors = useRowSensors();

  // Resync when the value changes under us (save round-trip, Reset button),
  // but not on our own echoes. Render-phase adjust per the React docs'
  // "adjusting state when a prop changes" pattern — the hooks Compiler
  // ruleset bans setState-in-effect for this.
  const [prevValue, setPrevValue] = useState<unknown>(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== state.emitted) setState(stateFromValue(value));
  }

  const commit = (rows: Row[]) => {
    // Rows stay raw while editing (so typing isn't fought by a trimmer);
    // the emitted array is what would be saved: trimmed, empties dropped.
    const items = rows.map((r) => r.text.trim()).filter((t) => t !== '');
    setState((s) => ({ rows, baseline: s.baseline, emitted: items }));
    onChange(items);
  };

  const edit = (id: string, text: string) =>
    commit(state.rows.map((r) => (r.id === id ? { ...r, text } : r)));

  const remove = (id: string) => commit(state.rows.filter((r) => r.id !== id));

  const draftTrimmed = draft.trim();
  const isDupe =
    draftTrimmed !== '' &&
    state.rows.some((r) => identity(r.text) === identity(draftTrimmed));

  const add = () => {
    if (draftTrimmed === '' || isDupe) return;
    addCounter += 1;
    commit([...state.rows, { id: `a${addCounter}`, text: draftTrimmed }]);
    setDraft('');
  };

  const renamedFrom = (row: Row): string | undefined => {
    if (!identityKeyed) return undefined;
    const before = state.baseline.get(row.id);
    if (before === undefined || row.text.trim() === '') return undefined;
    return identity(before) !== identity(row.text) ? before : undefined;
  };
  const renames = state.rows.flatMap((r) => {
    const from = renamedFrom(r);
    return from !== undefined ? [{ from, to: r.text.trim() }] : [];
  });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = state.rows.map((r) => r.id);
    const from = ids.indexOf(e.active.id as string);
    const to = ids.indexOf(e.over.id as string);
    if (from === -1 || to === -1) return;
    commit(arrayMove(state.rows, from, to));
  };

  return (
    <div className="space-y-1.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={state.rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {state.rows.map((row, i) => (
            <StringListRow
              key={row.id}
              row={row}
              index={i}
              renamed={renamedFrom(row) !== undefined}
              onEdit={edit}
              onRemove={remove}
            />
          ))}
        </SortableContext>
      </DndContext>

      {state.rows.length === 0 && (
        <p className="text-xs opacity-50">Nothing here yet — add the first entry below.</p>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? 'Add entry'}
          aria-label={placeholder ?? 'Add entry'}
          className="w-full min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={add}
          disabled={draftTrimmed === '' || isDupe}
          aria-label="Add to list"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {isDupe && <p className="text-xs opacity-60">Already in the list.</p>}

      {renames.length > 0 && (
        <div className="flex gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">Renaming re-keys saved history</p>
            <p className="opacity-80">
              {renames.map((r) => `“${r.from}” → “${r.to}”`).join(', ')} — history recorded
              under the old name stays behind on the clock.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StringListRow({
  row,
  index,
  renamed,
  onEdit,
  onRemove,
}: {
  row: Row;
  index: number;
  renamed: boolean;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={rowClass}
    >
      <span className="w-5 shrink-0 text-center font-mono text-xs opacity-50">{index + 1}</span>
      <input
        value={row.text}
        onChange={(e) => onEdit(row.id, e.target.value)}
        placeholder="Empty — dropped on save"
        aria-label={`Entry ${index + 1}`}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
      />
      {renamed && (
        <TriangleAlert
          aria-label="Renamed — see warning below"
          className="h-3.5 w-3.5 shrink-0 text-amber-300"
        />
      )}
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        aria-label={`Remove ${row.text.trim() || `entry ${index + 1}`}`}
        className={iconButtonClass}
      >
        <X className="h-4 w-4" />
      </button>
      <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder" className={handleClass}>
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* EnumOrderField                                                          */

export function EnumOrderField({
  value,
  options,
  onChange,
}: {
  value: unknown;
  options: readonly string[];
  onChange: (items: string[]) => void;
}) {
  const sensors = useRowSensors();
  // Derived, not stored: options are unique, so rows key by option string and
  // the widget can stay stateless.
  const { enabled, disabled } = splitEnumSelection(value, options);

  const toggle = (option: string, on: boolean) => {
    if (on) onChange([...enabled, option]);
    else if (enabled.length > 1) onChange(enabled.filter((o) => o !== option));
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = enabled.indexOf(e.active.id as string);
    const to = enabled.indexOf(e.over.id as string);
    if (from === -1 || to === -1) return;
    onChange(arrayMove(enabled, from, to));
  };

  return (
    <div className="space-y-1.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={[...enabled]} strategy={verticalListSortingStrategy}>
          {enabled.map((option, i) => (
            <EnabledEnumRow
              key={option}
              option={option}
              index={i}
              pinned={enabled.length === 1}
              onToggle={toggle}
            />
          ))}
        </SortableContext>
      </DndContext>
      {disabled.map((option) => (
        <DisabledEnumRow key={option} option={option} onToggle={toggle} />
      ))}
    </div>
  );
}

function EnumCheckbox({
  option,
  checked,
  pinned,
  onToggle,
}: {
  option: string;
  checked: boolean;
  pinned?: boolean;
  onToggle: (option: string, on: boolean) => void;
}) {
  const lastEnabled = checked && pinned === true;
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={lastEnabled}
      title={lastEnabled ? 'At least one must stay enabled' : undefined}
      onChange={(e) => onToggle(option, e.target.checked)}
      aria-label={`Enable ${humanize(option)}`}
      className="size-4 shrink-0 accent-[hsl(var(--primary))]"
    />
  );
}

function EnabledEnumRow({
  option,
  index,
  pinned,
  onToggle,
}: {
  option: string;
  index: number;
  pinned: boolean;
  onToggle: (option: string, on: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={rowClass}
    >
      <EnumCheckbox option={option} checked pinned={pinned} onToggle={onToggle} />
      <span className="min-w-0 flex-1 text-sm">{humanize(option)}</span>
      <span className="w-5 shrink-0 text-center font-mono text-xs opacity-40">{index + 1}</span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${humanize(option)}`}
        className={handleClass}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function DisabledEnumRow({
  option,
  onToggle,
}: {
  option: string;
  onToggle: (option: string, on: boolean) => void;
}) {
  return (
    <div className={`${rowClass} opacity-60`}>
      <EnumCheckbox option={option} checked={false} onToggle={onToggle} />
      <span className="min-w-0 flex-1 text-sm">{humanize(option)}</span>
      {/* ghost handle keeps geometry aligned with sortable rows */}
      <span aria-hidden className="p-1 opacity-20">
        <GripVertical className="h-4 w-4" />
      </span>
    </div>
  );
}
