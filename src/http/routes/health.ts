import { Hono } from 'hono';
import type { Env } from '../../env.ts';
import type { Vars } from '../middleware/context.ts';
import { healthCheck } from '../../app/system.ts';

// http layer: validate/serialize and call the app layer only (never data).
export const health = new Hono<{ Bindings: Env; Variables: Vars }>();

health.get('/health', async (c) => {
  const checks = await healthCheck(c.get('ctx'));
  const ok = Object.values(checks).every((v) => v === 'ok');
  return c.json({ status: ok ? 'ok' : 'degraded', service: 'hitsonce', checks });
});
