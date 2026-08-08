// Pure zod-introspection helpers behind SchemaForm's field dispatch.
// React-free so the branch logic is unit-testable in node.
//
// zod v4 note: .min()/.refine() attach checks to the SAME schema instance
// (no ZodEffects wrapper as in v3), so weather's `pages` is still a ZodArray
// after its refinements — only Optional/Default/Nullable actually wrap.

import { z } from 'zod';

export function unwrap(schema: unknown): z.ZodTypeAny {
  let s: unknown = schema;
  for (let i = 0; i < 5; i++) {
    if (
      s instanceof z.ZodOptional ||
      s instanceof z.ZodDefault ||
      s instanceof z.ZodNullable
    ) {
      const def = (s as unknown as { _def?: { innerType?: unknown } })._def;
      if (def?.innerType) {
        s = def.innerType;
        continue;
      }
    }
    break;
  }
  return s as z.ZodTypeAny;
}

/** 'idleReturnSeconds' → 'Idle Return Seconds'. Field labels and enum-option
 *  labels both go through this so the two array widgets and the plain
 *  select stay consistent. */
export function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export type ArrayFieldShape =
  | { element: 'string' }
  | { element: 'enum'; options: readonly string[] };

/** Classify an (possibly wrapped) array field for the form's array widgets.
 *  Null means "not an array we can render" → unsupported-field fallback.
 *  Elements are deliberately NOT unwrapped: an optional/default element would
 *  put non-strings into the value array, which the widgets don't handle. */
export function describeArray(schema: unknown): ArrayFieldShape | null {
  const inner = unwrap(schema);
  if (!(inner instanceof z.ZodArray)) return null;
  const element: unknown = inner.element;
  if (element instanceof z.ZodEnum) {
    return { element: 'enum', options: element.options as readonly string[] };
  }
  if (element instanceof z.ZodString) return { element: 'string' };
  return null;
}

/** Split a stored enum-array value into the widget's two row groups:
 *  enabled rows in the stored order, remaining options in declaration order.
 *  Tolerates dirty stored config — duplicates and values no longer in the
 *  enum are dropped rather than rendered. */
export function splitEnumSelection(
  value: unknown,
  options: readonly string[],
): { enabled: string[]; disabled: string[] } {
  const raw = Array.isArray(value) ? value : [];
  const enabled: string[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && options.includes(v) && !enabled.includes(v)) {
      enabled.push(v);
    }
  }
  const disabled = options.filter((o) => !enabled.includes(o));
  return { enabled, disabled };
}
