import type { IContext } from '../context.ts';
import type { NewEvent } from '../data/store.ts';
import { visitorHash } from '../lib/identity.ts';
import { civilDay } from '../lib/time.ts';
import { parseUserAgent } from '../lib/useragent.ts';
import { isBot } from '../lib/bots.ts';

// The client beacon (kept short on the wire; see lib/tracker.ts).
export interface Beacon {
  n?: string;
  v?: string | number | null;
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

// Resolve a beacon into a fully-formed event (domain lookup + cookieless identity +
// UA/geo), or null if the host isn't tracked. The id is generated here so a retried
// queue message dedupes on insert.
export async function buildEvent(ctx: IContext, input: CollectInput): Promise<NewEvent | null> {
  const domain = await ctx.store.getDomainByHost(input.hostname);
  if (!domain) return null;

  const ua = parseUserAgent(input.userAgent);
  // The cookieless hash rotates on the configured timezone's civil day, so it changes
  // at local midnight (the daily rollup rolls over on the same boundary, computed from
  // `ts` at rollup time — nothing per-event is stored for it).
  const hash = await visitorHash({
    salt: domain.salt,
    day: civilDay(new Date(), ctx.config.timezone),
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

  return {
    id: crypto.randomUUID(),
    domainId: domain.id,
    visitorHash: hash,
    name: (input.beacon.n ?? 'pageview').slice(0, 64),
    value: input.beacon.v != null ? String(input.beacon.v).slice(0, 128) : null,
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
}

// Direct write — the fallback used when the queue binding is absent (e.g. local dev).
// In production the collector enqueues and the queue() consumer bulk-inserts instead.
export async function saveEvent(ctx: IContext, event: NewEvent): Promise<void> {
  await ctx.store.insertEvent(event);
}
