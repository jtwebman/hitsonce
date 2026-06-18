import type { IContext } from '../context.ts';

export interface HealthChecks {
  store: 'ok' | 'error';
}

export async function healthCheck(ctx: IContext): Promise<HealthChecks> {
  if (!ctx.config.storeConfigured) return { store: 'error' };
  return { store: (await ctx.store.ping()) ? 'ok' : 'error' };
}
