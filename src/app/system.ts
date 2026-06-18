import type { IContext } from '../context.ts';
import { pingDb } from '../data/system.ts';

export interface HealthChecks {
  db: 'ok' | 'error';
}

export async function healthCheck(ctx: IContext): Promise<HealthChecks> {
  if (!ctx.config.dbConfigured) return { db: 'error' };
  return { db: (await pingDb(ctx)) ? 'ok' : 'error' };
}
