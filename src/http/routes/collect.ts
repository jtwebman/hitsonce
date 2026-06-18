import { Hono } from 'hono';
import type { Env } from '../../env.ts';
import type { Vars } from '../middleware/context.ts';
import { getCollectorConfig, buildEvent, saveEvent, type Beacon } from '../../app/collect.ts';
import { renderTracker } from '../../lib/tracker.ts';

// The first-party collector. GET serves the tracker snippet; POST ingests a beacon.
// In prod the Worker is routed to the collector path on each tracked zone; the
// default path is /_stats.
export const collect = new Hono<{ Bindings: Env; Variables: Vars }>();

collect.get('/_stats', async (c) => {
  const ctx = c.get('ctx');
  const cfg = await getCollectorConfig(ctx, new URL(c.req.url).hostname);
  if (!cfg) return c.text('', 404);
  return c.body(renderTracker(cfg.collectorPath), 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': 'public, max-age=3600',
  });
});

collect.post('/_stats', async (c) => {
  const ctx = c.get('ctx');
  const url = new URL(c.req.url);

  // sendBeacon may post as text/plain, but c.req.json() parses the body as JSON
  // regardless of content-type; fall back to an empty beacon on bad/empty bodies.
  let beacon: Beacon;
  try {
    beacon = (await c.req.json()) as Beacon;
  } catch {
    beacon = {};
  }

  const cf = c.req.raw.cf as IncomingRequestCfProperties | undefined;
  const event = await buildEvent(ctx, {
    hostname: url.hostname,
    ip: c.req.header('cf-connecting-ip') ?? '',
    userAgent: c.req.header('user-agent') ?? '',
    geo: {
      country: cf?.country ?? null,
      region: cf?.region ?? null,
      city: cf?.city ?? null,
      timezone: cf?.timezone ?? null,
    },
    beacon,
  });

  // Enqueue for batched insertion; fall back to a direct write if the queue is absent.
  if (event) {
    if (c.env.EVENTS) await c.env.EVENTS.send(event);
    else await saveEvent(ctx, event);
  }

  return c.body(null, 204);
});
