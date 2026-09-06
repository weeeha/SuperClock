// The usage contract beside every face and kiosk widget: the judgments a
// designer applies when placing or changing the part, written down so an
// agent does not infer them, plus, for hand-and-tick faces, the numbers the
// face is drawn from. Spec: docs/superpowers/specs/2026-09-05-face-contracts-design.md
//
// What belongs here is DECISIONS, not restated props: TypeScript already
// states the props. Every anti-pattern carries its why, because a bare
// "don't" reads as arbitrary and gets rationalised away.
import { z } from 'zod';

const NO_TODO_MESSAGE = 'begins with TODO: the scaffold stub has not been filled in';
const prose = (min: number) =>
  z
    .string()
    .min(min)
    .refine((s) => !s.startsWith('TODO'), { message: NO_TODO_MESSAGE });

/** A --token name, a #rrggbb literal, or config:<optionKey>. */
const colorRef = z
  .string()
  .regex(/^(--[\w-]+|#[0-9a-fA-F]{6}|config:[A-Za-z_$][\w$]*)$/, 'a --token, #rrggbb, or config:<optionKey>');

const faceToken = z.string().regex(/^--face-[\w-]+$/, 'night tokens are --face-* names');
const int = z.number().int().nonnegative();

const handSchema = z
  .object({
    tip: z.number().int().positive(),
    tail: int.optional(),
    width: z.number().int().positive(),
    color: colorRef.optional(),
  })
  .strict();

const tickSchema = z
  .object({ inner: int, outer: int, width: z.number().int().positive() })
  .strict()
  .refine((t) => t.outer > t.inner, { message: 'outer must be beyond inner' });

/** The numbers a hand-and-tick face is drawn from, in the 1000-unit render
 *  space every face and the LVGL geom_t struct already share. Lengths are
 *  from the centre, widths are stroke widths, dot values are radii. */
export const faceSpecSchema = z
  .object({
    space: z.literal(1000),
    radius: z.number().int().positive(),
    face: z.object({ background: colorRef, ink: colorRef }).strict(),
    hands: z.object({ hour: handSchema, minute: handSchema, second: handSchema.optional() }).strict(),
    ticks: z.object({ hour: tickSchema, minute: tickSchema }).strict().nullable(),
    dot: z
      .object({
        outer: z.number().int().positive(),
        inner: int,
        outerColor: colorRef.optional(),
        innerColor: colorRef.optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();

const antiPatternSchema = z.object({ rule: prose(10), why: prose(20) }).strict();
const idSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab id');

export const faceMetaSchema = z
  .object({
    kind: z.literal('face'),
    id: idSchema,
    purpose: prose(40),
    /** null when the face has no saturated quantity; one object otherwise.
     *  One object is the one-accent rule written as data. */
    accent: z.object({ where: prose(3), color: colorRef }).strict().nullable(),
    night: z.object({ recipe: prose(20), tokens: z.array(faceToken) }).strict(),
    options: z.array(z.object({ key: z.string().min(1), intent: prose(20) }).strict()),
    antiPatterns: z.array(antiPatternSchema).min(1),
    parity: z.object({ lvgl: z.string().min(1).nullable() }).strict(),
    spec: faceSpecSchema.optional(),
    specless: prose(20).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.spec && m.specless) {
      ctx.addIssue({ code: 'custom', message: 'spec and specless are exclusive' });
    }
    if (m.parity.lvgl && !m.spec) {
      ctx.addIssue({ code: 'custom', message: 'a face claiming LVGL parity must carry spec' });
    }
    if (m.accent?.color.startsWith('config:')) {
      const key = m.accent.color.slice('config:'.length);
      if (!m.options.some((o) => o.key === key)) {
        ctx.addIssue({ code: 'custom', message: `accent config:${key} names no option` });
      }
    }
  });

export const widgetMetaSchema = z
  .object({
    kind: z.literal('widget'),
    id: idSchema,
    purpose: prose(40),
    tokens: z.array(z.string().regex(/^--[\w-]+$/)),
    states: z.array(z.object({ state: z.string().min(1), recipe: prose(20) }).strict()).min(1),
    antiPatterns: z.array(antiPatternSchema).min(1),
    insteadUse: z.array(idSchema).optional(),
  })
  .strict();

export const partMetaSchema = z.union([faceMetaSchema, widgetMetaSchema]);

export type FaceSpec = z.infer<typeof faceSpecSchema>;
export type FaceMeta = z.infer<typeof faceMetaSchema>;
export type WidgetMeta = z.infer<typeof widgetMetaSchema>;
export type PartMeta = z.infer<typeof partMetaSchema>;

// Faces whose numbers still live in the TSX. May only SHRINK: move the
// numbers into the meta's `spec`, make the TSX read them, delete the line.
// A listed face that already carries spec or specless fails the gate as
// stale. A new face never enters this list; it is born with spec or specless.
export const SPEC_PENDING: readonly string[] = [
  'minimalismo',
  'productivity',
  'square',
  'floral',
  'complications-light',
  'complications-dark',
  'world',
];

/** Resolve a spec colour for rendering: config:<key> reads the face option,
 *  a --token becomes var(--token), a literal passes through. */
export function resolveSpecColor(value: string, options: Record<string, unknown>): string {
  if (value.startsWith('config:')) {
    const key = value.slice('config:'.length);
    const v = options[key];
    if (typeof v !== 'string') throw new Error(`${value}: face options carry no string "${key}"`);
    return v;
  }
  if (value.startsWith('--')) return `var(${value})`;
  return value;
}

/** Parse a meta at module scope and return its spec, or throw naming the
 *  file so a face never renders from a contract it does not have. */
export function specOf(meta: unknown, file: string): FaceSpec {
  const parsed = faceMetaSchema.parse(meta);
  if (!parsed.spec) throw new Error(`${file} carries no spec; this face draws from its contract`);
  return parsed.spec;
}
