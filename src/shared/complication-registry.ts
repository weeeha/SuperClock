import type { ComplicationDescriptor } from './types';

// Clock-scoped complications for v1.
// Two are wired to real renderers in src/shared/complications/ (date, temperature);
// the rest are declared so the admin's slot picker can show them, but their
// renderers will be added as faces with slots come online.
export const COMPLICATIONS: ComplicationDescriptor[] = [
  {
    id: 'date',
    name: 'Date',
    shapes: ['small', 'circular'],
    configSchemaId: 'complication.date',
  },
  {
    id: 'temperature',
    name: 'Temperature',
    shapes: ['small', 'circular'],
    configSchemaId: 'complication.temperature',
  },
  {
    id: 'habit-streak',
    name: 'Habit Streak',
    shapes: ['circular'],
  },
  {
    id: 'day-progress',
    name: 'Day Progress',
    shapes: ['circular', 'wide'],
  },
  {
    id: 'fitness-ring',
    name: 'Fitness Ring',
    shapes: ['circular'],
  },
  {
    id: 'next-calendar-event',
    name: 'Next Event',
    shapes: ['wide'],
  },
];

const COMPLICATIONS_BY_ID = new Map(COMPLICATIONS.map((c) => [c.id, c]));

export function getComplication(id: string): ComplicationDescriptor | undefined {
  return COMPLICATIONS_BY_ID.get(id);
}

export function listComplications(): ComplicationDescriptor[] {
  return COMPLICATIONS;
}

export function complicationsForShape(
  shape: ComplicationDescriptor['shapes'][number],
): ComplicationDescriptor[] {
  return COMPLICATIONS.filter((c) => c.shapes.includes(shape));
}
