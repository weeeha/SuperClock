// Generic zod schema → form renderer.
// v1 supports: ZodString, ZodEnum, ZodBoolean, ZodOptional/ZodDefault wrapping any of those.
// Anything else renders a "Unsupported field" placeholder.

import type { ChangeEvent } from 'react';
import { z } from 'zod';
import { Switch } from '../components/ui/switch';

interface Props {
  schema: z.ZodObject<z.ZodRawShape>;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

function unwrap(schema: unknown): z.ZodTypeAny {
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

export function SchemaForm({ schema, value, onChange }: Props) {
  const shape = schema.shape;
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      {Object.entries(shape).map(([key, fieldSchema]) => {
        const inner = unwrap(fieldSchema);
        const current = value[key];

        if (inner instanceof z.ZodString) {
          return (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium capitalize">{key}</label>
              <input
                type="text"
                value={(current as string) ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => set(key, e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
              />
            </div>
          );
        }

        if (inner instanceof z.ZodEnum) {
          const options = inner.options as readonly string[];
          return (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium capitalize">{key}</label>
              <select
                value={(current as string) ?? options[0]}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => set(key, e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (inner instanceof z.ZodBoolean) {
          return (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm font-medium capitalize">{key}</label>
              <Switch checked={Boolean(current)} onCheckedChange={(v) => set(key, v)} />
            </div>
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
