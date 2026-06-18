import type { IContext } from '../context.ts';
import type { Stats } from '../data/store.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

// Stats for a domain over a window. Defaults to the last 30 days; bots are excluded
// unless includeBots is set.
export function getStats(
  ctx: IContext,
  input: { domainId: string; from?: string; to?: string; includeBots?: boolean },
): Promise<Stats> {
  const now = Date.now();
  const to = input.to ?? new Date(now).toISOString();
  const from = input.from ?? new Date(now - 30 * DAY_MS).toISOString();
  return ctx.store.getStats({
    domainId: input.domainId,
    from,
    to,
    includeBots: input.includeBots,
  });
}
