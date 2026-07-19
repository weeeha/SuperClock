// Resolves `configSchemaId` strings to their zod schema + UI metadata.
// Both admin (config forms) and kiosk (config validation on load) import from
// here. Capabilities transmit the IDs only; both ends resolve locally.
//
// Adding a schema: add the file under ./schemas/<id>.ts, import it here, and
// register an entry. New apps/faces also need a `configSchemaId` on their
// descriptor (see src/apps/<id>/index.ts and src/shared/face-registry.ts).

import type { z } from 'zod';
import type { FieldMetaMap } from './types';

// Complications (existing)
import { dateComplicationSchema } from './schemas/complication.date';
import { temperatureComplicationSchema } from './schemas/complication.temperature';

// Apps
import { breathingAppSchema, breathingAppMeta } from './schemas/app.breathing';
import { calendarAppSchema, calendarAppMeta } from './schemas/app.calendar';
import { claudeUsageAppSchema, claudeUsageAppMeta } from './schemas/app.claude-usage';
import { fireplaceAppSchema, fireplaceAppMeta } from './schemas/app.fireplace';
import { fitnessAppSchema, fitnessAppMeta } from './schemas/app.fitness';
import { githubAppSchema, githubAppMeta } from './schemas/app.github';
import { habitsAppSchema, habitsAppMeta } from './schemas/app.habits';
import { photoFrameAppSchema, photoFrameAppMeta } from './schemas/app.photo-frame';
import { quoteAppSchema, quoteAppMeta } from './schemas/app.quote';
import { timeTrackingAppSchema, timeTrackingAppMeta } from './schemas/app.time-tracking';
import { weatherAppSchema, weatherAppMeta } from './schemas/app.weather';

// Faces
import { analogFaceSchema, analogFaceMeta } from './schemas/face.analog';
import { productivityFaceSchema, productivityFaceMeta } from './schemas/face.productivity';
import { squareFaceSchema, squareFaceMeta } from './schemas/face.square';
import { floralFaceSchema, floralFaceMeta } from './schemas/face.floral';
import {
  complicationsLightFaceSchema,
  complicationsLightFaceMeta,
} from './schemas/face.complications-light';
import {
  complicationsDarkFaceSchema,
  complicationsDarkFaceMeta,
} from './schemas/face.complications-dark';
import { worldFaceSchema, worldFaceMeta } from './schemas/face.world';
import { flipFaceSchema, flipFaceMeta } from './schemas/face.flip';

export interface SchemaEntry {
  schema: z.ZodObject<z.ZodRawShape>;
  meta?: FieldMetaMap;
}

export const SCHEMAS: Record<string, SchemaEntry> = {
  // Complications
  'complication.date': { schema: dateComplicationSchema },
  'complication.temperature': { schema: temperatureComplicationSchema },

  // Apps
  'app.breathing': { schema: breathingAppSchema, meta: breathingAppMeta },
  'app.calendar': { schema: calendarAppSchema, meta: calendarAppMeta },
  'app.claude-usage': { schema: claudeUsageAppSchema, meta: claudeUsageAppMeta },
  'app.fireplace': { schema: fireplaceAppSchema, meta: fireplaceAppMeta },
  'app.fitness': { schema: fitnessAppSchema, meta: fitnessAppMeta },
  'app.github': { schema: githubAppSchema, meta: githubAppMeta },
  'app.habits': { schema: habitsAppSchema, meta: habitsAppMeta },
  'app.photo-frame': { schema: photoFrameAppSchema, meta: photoFrameAppMeta },
  'app.quote': { schema: quoteAppSchema, meta: quoteAppMeta },
  'app.time-tracking': { schema: timeTrackingAppSchema, meta: timeTrackingAppMeta },
  'app.weather': { schema: weatherAppSchema, meta: weatherAppMeta },

  // Faces
  'face.analog': { schema: analogFaceSchema, meta: analogFaceMeta },
  'face.productivity': { schema: productivityFaceSchema, meta: productivityFaceMeta },
  'face.square': { schema: squareFaceSchema, meta: squareFaceMeta },
  'face.floral': { schema: floralFaceSchema, meta: floralFaceMeta },
  'face.complications-light': {
    schema: complicationsLightFaceSchema,
    meta: complicationsLightFaceMeta,
  },
  'face.complications-dark': {
    schema: complicationsDarkFaceSchema,
    meta: complicationsDarkFaceMeta,
  },
  'face.world': { schema: worldFaceSchema, meta: worldFaceMeta },
  'face.flip': { schema: flipFaceSchema, meta: flipFaceMeta },
};

export function getSchema(id: string | undefined): SchemaEntry | undefined {
  if (!id) return undefined;
  return SCHEMAS[id];
}

export function defaultsFor(id: string | undefined): Record<string, unknown> {
  const entry = getSchema(id);
  if (!entry) return {};
  // Zod's .parse({}) fills in defaults for any field that has one.
  const result = entry.schema.safeParse({});
  return result.success ? (result.data as Record<string, unknown>) : {};
}
