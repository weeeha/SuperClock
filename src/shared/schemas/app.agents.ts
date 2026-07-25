import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const agentsAppSchema = z.object({
  defaultAgent: z.string().default('main'),
  enabledAgents: z.array(z.string()).default([]),
});

export const agentsAppMeta: FieldMetaMap = {
  defaultAgent: { description: 'Agent pinned to the top of the list (OpenClaw id, e.g. main)' },
  enabledAgents: { description: 'Agent ids to show; empty = all 15' },
};

export type AgentsAppConfig = z.infer<typeof agentsAppSchema>;
