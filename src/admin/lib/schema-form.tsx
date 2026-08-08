// Generic zod schema → form renderer.
// Supports: string (with format: 'color' | 'url' | 'time'), number (with
// min/max/step), enum (select), boolean (switch), array-of-string (list
// editor), array-of-enum (ordered multi-select). Dispatch logic lives in
// schema-introspect.ts (unit-tested), array widgets in array-fields.tsx.
// Unwraps ZodOptional / ZodDefault / ZodNullable. Sidecar `meta` provides
// labels, descriptions, ranges, and conditional visibility — schemas stay
// pure-zod.

import type { ChangeEvent } from 'react';
import { z } from 'zod';
import { Switch } from '../components/ui/switch';
import { EnumOrderField, StringListField } from './array-fields';
import { describeArray, humanize, unwrap } from './schema-introspect';
import type { FieldMeta, FieldMetaMap } from '../../shared/types';

interface Props {
  schema: z.ZodObject<z.ZodRawShape>;
  meta?: FieldMetaMap;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

function FieldShell({
  label,
  description,
  error,
  children,
  inline,
}: {
  label: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="text-sm font-medium">{label}</label>
          {description && (
            <p className="text-xs opacity-60">{description}</p>
          )}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && <p className="text-xs opacity-60 -mt-1">{description}</p>}
      {children}
      {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm';

export function SchemaForm({ schema, meta, value, onChange }: Props) {
  const shape = schema.shape;
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      {Object.entries(shape).map(([key, fieldSchema]) => {
        const fmeta: FieldMeta = meta?.[key] ?? {};
        if (fmeta.showIf && !fmeta.showIf(value)) return null;

        const inner = unwrap(fieldSchema);
        const current = value[key];
        const label = fmeta.label ?? humanize(key);

        if (inner instanceof z.ZodString) {
          if (fmeta.format === 'color') {
            const hex = typeof current === 'string' && current ? current : '#000000';
            return (
              <FieldShell key={key} label={label} description={fmeta.description} inline>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => set(key, e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-[hsl(var(--border))] bg-transparent p-0"
                    aria-label={label}
                  />
                  <code className="text-xs opacity-70">{hex}</code>
                </div>
              </FieldShell>
            );
          }
          return (
            <FieldShell key={key} label={label} description={fmeta.description}>
              <input
                type={fmeta.format === 'url' ? 'url' : fmeta.format === 'time' ? 'time' : 'text'}
                value={(current as string) ?? ''}
                placeholder={fmeta.placeholder}
                onChange={(e: ChangeEvent<HTMLInputElement>) => set(key, e.target.value)}
                className={inputClass}
              />
            </FieldShell>
          );
        }

        if (inner instanceof z.ZodNumber) {
          const num = typeof current === 'number' ? current : '';
          return (
            <FieldShell key={key} label={label} description={fmeta.description}>
              <input
                type="number"
                value={num}
                min={fmeta.min}
                max={fmeta.max}
                step={fmeta.step ?? 1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const raw = e.target.value;
                  if (raw === '') return set(key, undefined);
                  const parsed = Number(raw);
                  if (!Number.isNaN(parsed)) set(key, parsed);
                }}
                className={inputClass}
              />
            </FieldShell>
          );
        }

        if (inner instanceof z.ZodEnum) {
          const options = inner.options as readonly string[];
          return (
            <FieldShell key={key} label={label} description={fmeta.description}>
              <select
                value={(current as string) ?? options[0]}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => set(key, e.target.value)}
                className={inputClass}
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {humanize(opt)}
                  </option>
                ))}
              </select>
            </FieldShell>
          );
        }

        if (inner instanceof z.ZodBoolean) {
          return (
            <FieldShell
              key={key}
              label={label}
              description={fmeta.description}
              inline
            >
              <Switch checked={Boolean(current)} onCheckedChange={(v) => set(key, v)} />
            </FieldShell>
          );
        }

        const arrayShape = describeArray(fieldSchema);
        if (arrayShape) {
          // Surface zod's own message (weather pages' min(1) and no-duplicates
          // refine) rather than duplicating those rules in the UI layer.
          const parsed = (fieldSchema as z.ZodTypeAny).safeParse(current);
          const error = parsed.success ? undefined : parsed.error.issues[0]?.message;
          return (
            <FieldShell key={key} label={label} description={fmeta.description} error={error}>
              {arrayShape.element === 'string' ? (
                <StringListField
                  value={current}
                  placeholder={fmeta.placeholder}
                  identityKeyed={fmeta.identityKeyed}
                  onChange={(items) => set(key, items)}
                />
              ) : (
                <EnumOrderField
                  value={current}
                  options={arrayShape.options}
                  onChange={(items) => set(key, items)}
                />
              )}
            </FieldShell>
          );
        }

        return (
          <div key={key} className="text-xs opacity-50">
            {key}: unsupported field
          </div>
        );
      })}
    </div>
  );
}
