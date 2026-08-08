// Pins the zod-introspection branch logic behind SchemaForm's array widgets:
// which fields render as a string-list editor vs an ordered enum multi-select,
// and that zod v4's check-attaching (.min/.refine return the same class, no
// ZodEffects wrapper) keeps working across zod upgrades.

import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { habitsAppSchema } from '../../shared/schemas/app.habits';
import { timeTrackingAppSchema } from '../../shared/schemas/app.time-tracking';
import { agentsAppSchema } from '../../shared/schemas/app.agents';
import { weatherAppSchema, WEATHER_PAGE_ENUM } from '../../shared/schemas/app.weather';
import { SCHEMAS } from '../../shared/schema-registry';
import { describeArray, humanize, splitEnumSelection, unwrap } from './schema-introspect';

describe('describeArray', () => {
  test('classifies habits.habits as a string list', () => {
    expect(describeArray(habitsAppSchema.shape.habits)).toEqual({ element: 'string' });
  });

  test('classifies time-tracking.projects and agents.enabledAgents as string lists', () => {
    expect(describeArray(timeTrackingAppSchema.shape.projects)).toEqual({ element: 'string' });
    expect(describeArray(agentsAppSchema.shape.enabledAgents)).toEqual({ element: 'string' });
  });

  test('classifies weather.pages as an enum list with options in declaration order', () => {
    expect(describeArray(weatherAppSchema.shape.pages)).toEqual({
      element: 'enum',
      options: [...WEATHER_PAGE_ENUM],
    });
  });

  test('zod v4 keeps .min()/.refine() checks on the array itself (no wrapper)', () => {
    const checked = z
      .array(z.enum(['a', 'b']))
      .min(1)
      .refine((v) => new Set(v).size === v.length);
    expect(describeArray(checked)).toEqual({ element: 'enum', options: ['a', 'b'] });
  });

  test('unwraps optional / default / nullable around the array', () => {
    expect(describeArray(z.array(z.string()).optional())).toEqual({ element: 'string' });
    expect(describeArray(z.array(z.string()).default([]))).toEqual({ element: 'string' });
    expect(describeArray(z.array(z.string()).nullable().optional())).toEqual({
      element: 'string',
    });
  });

  test('element checks (e.g. .min on the string) do not defeat classification', () => {
    expect(describeArray(z.array(z.string().min(1)))).toEqual({ element: 'string' });
  });

  test('returns null for non-arrays', () => {
    expect(describeArray(z.string())).toBeNull();
    expect(describeArray(habitsAppSchema.shape.weekStart)).toBeNull();
  });

  test('returns null for arrays of unsupported elements', () => {
    expect(describeArray(z.array(z.number()))).toBeNull();
    expect(describeArray(z.array(z.object({ a: z.string() })))).toBeNull();
    // A wrapped element would put undefined/null into the value array — the
    // widgets only handle plain strings, so this must fall to "unsupported".
    expect(describeArray(z.array(z.string().optional()))).toBeNull();
  });
});

describe('registry sweep — every registered schema field renders with a known widget', () => {
  // The board audit (Admin Panel page, 97:719) claims these two array widgets
  // close the last "unsupported field" gap. Pin that: any future schema field
  // outside this set fails here with its name, same spirit as the
  // registry-coherence test.
  for (const [id, entry] of Object.entries(SCHEMAS)) {
    test(id, () => {
      for (const [key, field] of Object.entries(entry.schema.shape)) {
        const inner = unwrap(field);
        const supported =
          inner instanceof z.ZodString ||
          inner instanceof z.ZodNumber ||
          inner instanceof z.ZodEnum ||
          inner instanceof z.ZodBoolean ||
          describeArray(field) !== null;
        expect.soft(supported, `${id}.${key} would render "unsupported field"`).toBe(true);
      }
    });
  }
});

describe('humanize', () => {
  // Characterization of the label helper moved out of schema-form.tsx —
  // enum-option labels in the select and the multi-select rows share it.
  test('spaces camelCase and capitalizes the first letter', () => {
    expect(humanize('idleReturnSeconds')).toBe('Idle Return Seconds');
    expect(humanize('now')).toBe('Now');
    expect(humanize('uv')).toBe('Uv');
  });
});

describe('splitEnumSelection', () => {
  const options = ['now', 'temp', 'conditions', 'precip'] as const;

  test('enabled keeps stored order; disabled keeps option declaration order', () => {
    expect(splitEnumSelection(['precip', 'now'], options)).toEqual({
      enabled: ['precip', 'now'],
      disabled: ['temp', 'conditions'],
    });
  });

  test('drops duplicates and unknown values from stored config', () => {
    expect(splitEnumSelection(['temp', 'temp', 'gone', 'now'], options)).toEqual({
      enabled: ['temp', 'now'],
      disabled: ['conditions', 'precip'],
    });
  });

  test('non-array or empty value yields all options disabled', () => {
    expect(splitEnumSelection(undefined, options)).toEqual({
      enabled: [],
      disabled: ['now', 'temp', 'conditions', 'precip'],
    });
    expect(splitEnumSelection('now', options)).toEqual({
      enabled: [],
      disabled: ['now', 'temp', 'conditions', 'precip'],
    });
  });
});
