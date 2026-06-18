import type { IContext } from '../context.ts';
import type { NewEvent } from '../data/store.ts';
import { visitorHash, utcDay } from '../lib/identity.ts';
import { parseUserAgent } from '../lib/useragent.ts';
import { isBot } from '../lib/bots.ts';

// The client beacon (kept short on the wire; see lib/tracker.ts).
export interface Beacon {
  n?: string;
  path?: string;
  ref?: string | null;
  lang?: string | null;
  tz?: string | null;
  w?: number | null;
  h?: number | null;
}

export interface CollectInput {
  hostname: string;
  ip: string;
  userAgent: string;
  geo: {
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
  };
  beacon: Beacon;
}

// Collector config for a host (used to serve the tracker snippet), or null if the
// host isn't a tracked domain.
export async function getCollectorConfig(
  ctx: IContext,
  hostname: string,
): Promise<{ collectorPath: string } | null> {
  const domain = await ctx.store.getDomainByHost(hostname);
  return domain ? { collectorPath: domain.collectorPath } : null;
}

// Records one event for the given host. Silently ignores unknown hosts.
export async function recordEvent(ctx: IContext, input: CollectInput): Promise<{ ok: boolean }> {
  const domain = await ctx.store.getDomainByHost(input.hostname);
  if (!domain) return { ok: false };

  const ua = parseUserAgent(input.userAgent);
  const hash = await visitorHash({
    salt: domain.salt,
    day: utcDay(),
    ip: input.ip,
    ua: input.userAgent,
  });

  let referrerHost: string | null = null;
  if (input.beacon.ref) {
    try {
      referrerHost = new URL(input.beacon.ref).hostname;
    } catch {
      referrerHost = null;
    }
  }

  const event: NewEvent = {
    domainId: domain.id,
    visitorHash: hash,
    name: (input.beacon.n ?? 'pageview').slice(0, 64),
    path: input.beacon.path ? input.beacon.path.slice(0, 1024) : null,
    referrerHost,
    country: input.geo.country,
    region: input.geo.region,
    city: input.geo.city,
    timezone: input.beacon.tz ?? input.geo.timezone,
    language: input.beacon.lang ?? null,
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    screenW: typeof input.beacon.w === 'number' ? input.beacon.w : null,
    screenH: typeof input.beacon.h === 'number' ? input.beacon.h : null,
    isBot: isBot(input.userAgent),
  };

  await ctx.store.insertEvent(event);
  return { ok: true };
}
