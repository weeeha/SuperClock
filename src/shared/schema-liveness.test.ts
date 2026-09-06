// Schema liveness — the consumption half of the registry contract.
//
// registry-coherence pins that every app and face HAS a schema and that the
// admin can render a form for it; registry-contract pins that every schema
// file is registered. Neither can see whether the component on the glass ever
// READS the schema. Decision record D4 (2026-07-24) measured the result: 4 of
// 12 apps read their config, 1 face parsed faceConfig — "the admin is a remote
// control for a device that is mostly not listening". Structural consistency
// was automated; semantic consistency was not. This gate walks the chain one
// link further: declared schema → a VALUE import of that schema module from
// the component that owns it. Ledger and predicate live in ./schema-liveness.ts
// so the health report reads the same implementation.
//
// Lineage: ds-architecture starter-kit `liveness.test.ts` (token → alias →
// consumer), retargeted from tokens to schemas. Two directions, both gated:
//   - a schema NOT on SCHEMA_UNREAD must be consumed;
//   - a schema ON SCHEMA_UNREAD must NOT be consumed — a stale ledger row is a
//     finding: delete the line the day the component starts reading it.
// The ledger may only shrink. New apps and faces never enter it: the
// scaffolders emit components born consuming their schema.

import { describe, it, expect } from 'vitest';
import { SCHEMAS } from './schema-registry';
import {
  SCHEMA_KINDS,
  SCHEMA_UNREAD,
  consumerOf,
  faceFiles,
  isConsumed,
  valueImportsModule,
} from './schema-liveness';

const ALL = Object.keys(SCHEMAS);

describe('schema liveness (declared schema → value import in its component)', () => {
  it('every schema id has a classified kind (a new kind needs an owner mapping in consumerOf)', () => {
    for (const id of ALL) {
      expect(SCHEMA_KINDS.some((k) => id.startsWith(k)), `unclassified schema kind: '${id}'`).toBe(true);
    }
  });

  it('every face schema maps to a component file via face-components.ts', () => {
    for (const id of ALL.filter((i) => i.startsWith('face.'))) {
      expect(faceFiles()[id.slice('face.'.length)], `no component for '${id}'`).toBeDefined();
    }
  });

  it('every schema off the ledger is read by the component that owns it', () => {
    const unread = ALL.filter((id) => !(id in SCHEMA_UNREAD) && !isConsumed(id));
    const detail = unread.map((id) => {
      const { where, module } = consumerOf(id);
      return `  ${id}: nothing under ${where} value-imports '${module}'`;
    });
    expect(
      unread,
      `${unread.length} schema(s) rendered by the admin but never read on the glass:\n${detail.join('\n')}\n` +
        `Wire the component (Calendar pattern: schema.safeParse(config ?? {})) or add a ledger row with a reason.`,
    ).toEqual([]);
  });

  it('every ledger row is still true — a schema that became read must leave SCHEMA_UNREAD', () => {
    const stale = Object.keys(SCHEMA_UNREAD).filter((id) => id in SCHEMAS && isConsumed(id));
    expect(stale, `stale ledger row(s), delete them: ${stale.join(', ')}`).toEqual([]);
  });

  it('every ledger row names a registered schema and carries a reason', () => {
    for (const [id, reason] of Object.entries(SCHEMA_UNREAD)) {
      expect(SCHEMAS[id], `ledger names unknown schema '${id}'`).toBeDefined();
      expect(reason.trim().length, `ledger row '${id}' has no reason`).toBeGreaterThan(0);
    }
  });
});

describe('valueImportsModule (the predicate, pinned)', () => {
  it('accepts a value import with any relative prefix', () => {
    expect(
      valueImportsModule(
        `import { calendarAppSchema } from '../../shared/schemas/app.calendar';`,
        'schemas/app.calendar',
      ),
    ).toBe(true);
  });

  it('accepts a multi-line mixed import', () => {
    expect(
      valueImportsModule(
        `import {\n  weatherAppSchema,\n  type WeatherAppConfig,\n} from '../../shared/schemas/app.weather';`,
        'schemas/app.weather',
      ),
    ).toBe(true);
  });

  it('rejects a type-only import (erased at build time)', () => {
    expect(
      valueImportsModule(
        `import type { BreathingAppConfig } from '../../shared/schemas/app.breathing';`,
        'schemas/app.breathing',
      ),
    ).toBe(false);
  });

  it('does not match a neighbouring schema id by prefix', () => {
    expect(
      valueImportsModule(
        `import { x } from '../../shared/schemas/app.weather-extra';`,
        'schemas/app.weather',
      ),
    ).toBe(false);
  });
});
