// Declared vs read: the registry suites prove the app/face/schema LISTS agree,
// which is why nothing is ever missing. They cannot prove a schema is ever
// READ, which is why so much was inert (2026-07-24 adjudications: 11 app
// schemas declared, 4 consumed). This module answers the pivoted question a
// reviewer or agent actually has, "which fields does this component read?",
// from source text, and renders the answer as the committed report at
// docs/analysis/declared-vs-read.md (scripts/lib/analyze.test.ts pins it).

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  parseFaceComponentMap,
  schemaVariableName,
  detectParseStyle,
  readsIdentifier,
  analyzeDeclaredVsRead,
  renderDeclaredVsRead,
  type AnalyzeInput,
} from './declared-vs-read';

const FACE_COMPONENTS_SRC = `
import DepletionClock from './DepletionClock';
export const FACE_COMPONENTS: Record<string, FaceComponent> = {
  minimalismo: MinimalismoClock,
  'complications-dark': ComplicationsDark,
  depletion: DepletionClock,
};
export const SWIPE_CYCLE_ORDER: FaceComponent[] = [
  MinimalismoClock,
];
`;

describe('parseFaceComponentMap', () => {
  it('maps bare and quoted face ids to their component names', () => {
    expect(parseFaceComponentMap(FACE_COMPONENTS_SRC)).toEqual({
      minimalismo: 'MinimalismoClock',
      'complications-dark': 'ComplicationsDark',
      depletion: 'DepletionClock',
    });
  });
});

describe('schemaVariableName', () => {
  it('follows the registry convention <camelId><Kind>Schema', () => {
    expect(schemaVariableName('app.photo-frame')).toBe('photoFrameAppSchema');
    expect(schemaVariableName('face.complications-dark')).toBe('complicationsDarkFaceSchema');
  });
});

describe('detectParseStyle', () => {
  const base = { prop: 'config' as const, schemaVar: 'quoteAppSchema', componentSource: 'x' };

  it('safeParse when the schema is safeParsed anywhere in the consumer', () => {
    const sources = ['const parsed = quoteAppSchema.safeParse(config ?? {});'];
    expect(detectParseStyle({ ...base, sources })).toBe('safeParse');
  });

  it('parse when only a throwing parse is used', () => {
    expect(detectParseStyle({ ...base, sources: ['quoteAppSchema.parse(config)'] })).toBe('parse');
  });

  it('cast for an unvalidated type assertion', () => {
    const sources = ['const c = (config ?? {}) as Partial<QuoteAppConfig>;'];
    expect(detectParseStyle({ ...base, sources })).toBe('cast');
  });

  it('raw when the component touches the prop without a schema', () => {
    const src = 'export default function QuoteApp({ config }: AppProps) { return config?.source; }';
    expect(detectParseStyle({ ...base, componentSource: src, sources: [src] })).toBe('raw');
  });

  it('none when the prop is never mentioned', () => {
    const src = 'export default function QuoteApp({ isActive }: AppProps) { return null; }';
    expect(detectParseStyle({ ...base, componentSource: src, sources: [src] })).toBe('none');
  });

  it("does not credit another schema's safeParse", () => {
    const sources = ['const parsed = todoFileSchema.safeParse(json);'];
    expect(detectParseStyle({ ...base, sources })).toBe('none');
  });
});

describe('readsIdentifier', () => {
  it('matches whole identifiers only', () => {
    expect(readsIdentifier(['const { unit } = parsed.data;'], 'unit')).toBe(true);
    expect(readsIdentifier(['const units = 3;'], 'unit')).toBe(false);
  });
});

const INPUT: AnalyzeInput = {
  schemas: {
    'app.quote': {
      schema: z.object({ source: z.string().default(''), refreshMinutes: z.number().default(60) }),
    },
    'face.depletion': {
      schema: z.object({ cycle: z.enum(['a', 'b']).default('a'), ticks: z.enum(['x']).default('x') }),
    },
  },
  apps: [
    {
      id: 'quote',
      componentPath: 'src/apps/quote/QuoteApp.tsx',
      sources: [
        {
          path: 'src/apps/quote/QuoteApp.tsx',
          text: 'const parsed = quoteAppSchema.safeParse(config ?? {}); use(parsed.data.source);',
        },
      ],
    },
    {
      id: 'fireplace',
      componentPath: 'src/apps/fireplace/FireplaceApp.tsx',
      sources: [
        {
          path: 'src/apps/fireplace/FireplaceApp.tsx',
          text: 'export default function FireplaceApp({ isActive }: AppProps) {}',
        },
      ],
    },
  ],
  faces: [
    { id: 'depletion', name: 'Depletion', preview: '/d.svg', configSchemaId: 'face.depletion', slots: [] },
    { id: 'minimalismo', name: 'Minimalismo', preview: '/m.svg', slots: [{ id: 'top', shape: 'small' }] },
  ],
  faceComponentsSource: FACE_COMPONENTS_SRC,
  faceSources: {
    DepletionClock:
      'const p = depletionFaceSchema.safeParse(faceConfig ?? {}); const { cycle } = p.data; ' +
      "style={{ background: 'var(--face-bg)', color: 'var(--face-ink)' }} var(--face-bg)",
    MinimalismoClock: 'className="fill-(--face-bg)" <Complication />',
  },
  faceTokenExempt: ['AnalogClock.tsx', 'MinimalismoClock.tsx'],
};

describe('analyzeDeclaredVsRead', () => {
  const analysis = analyzeDeclaredVsRead(INPUT);

  it('lists unread schema fields per app, sorted by id', () => {
    expect(analysis.apps).toEqual([
      { id: 'fireplace', schemaId: null, parse: 'none', declared: [], unread: [] },
      {
        id: 'quote',
        schemaId: 'app.quote',
        parse: 'safeParse',
        declared: ['source', 'refreshMinutes'],
        unread: ['refreshMinutes'],
      },
    ]);
  });

  it('reports faces with tokens, slots and night exemption', () => {
    expect(analysis.faces).toEqual([
      {
        id: 'depletion',
        component: 'DepletionClock',
        schemaId: 'face.depletion',
        parse: 'safeParse',
        declared: ['cycle', 'ticks'],
        unread: ['ticks'],
        tokens: ['--face-bg', '--face-ink'],
        slotsDeclared: 0,
        slotsRendered: false,
        nightExempt: false,
      },
      {
        id: 'minimalismo',
        component: 'MinimalismoClock',
        schemaId: null,
        parse: 'none',
        declared: [],
        unread: [],
        tokens: ['--face-bg'],
        slotsDeclared: 1,
        slotsRendered: true,
        nightExempt: true,
      },
    ]);
  });
});

describe('analyzeDeclaredVsRead: a consumer that never touches its prop reads nothing', () => {
  it('lists every declared field as unread even when the identifier appears elsewhere in the source', () => {
    const input: AnalyzeInput = {
      ...INPUT,
      schemas: { 'face.square': { schema: z.object({ accent: z.string().default('#fff') }) } },
      apps: [],
      faces: [{ id: 'square', name: 'Square', preview: '/s.svg', configSchemaId: 'face.square', slots: [] }],
      faceComponentsSource: 'export const FACE_COMPONENTS = {\n  square: SquareClock,\n};',
      faceSources: { SquareClock: 'const accent = "#FFD700"; // hardcoded, the prop is never touched' },
    };
    const [square] = analyzeDeclaredVsRead(input).faces;
    expect(square.parse).toBe('none');
    expect(square.unread).toEqual(['accent']);
  });
});

describe('renderDeclaredVsRead', () => {
  const md = renderDeclaredVsRead(analyzeDeclaredVsRead(INPUT));

  it('renders the summary from the computed counts', () => {
    expect(md).toContain('# Declared vs read');
    expect(md).toContain(
      '- Apps: 2 registered; 1 with a schema; config read by 1 (safeParse 1, parse 0, cast 0, raw 0); never read by 1.',
    );
    expect(md).toContain(
      '- Faces: 2 registered; 1 with a schema; faceConfig read by 1 (safeParse 1, parse 0, cast 0, raw 0); never read by 1; night-exempt 1.',
    );
    expect(md).toContain('- Schema fields: 4 declared (2 app, 2 face); 2 unread (1 app, 1 face).');
  });

  it('renders one table row per app and per face', () => {
    expect(md).toContain('| quote | app.quote | safeParse | 2 | refreshMinutes |');
    expect(md).toContain('| fireplace | none | none | 0 | none |');
    expect(md).toContain(
      '| depletion | DepletionClock | safeParse | 2 | ticks | --face-bg --face-ink | 0 | no |',
    );
    expect(md).toContain(
      '| minimalismo | MinimalismoClock | none | 0 | none | --face-bg | 1 declared, rendered | yes |',
    );
    expect(md.endsWith('\n')).toBe(true);
  });
});
