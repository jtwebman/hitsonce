import { createHttpApp } from './http/app.ts';
import type { Env } from './env.ts';
import type { NewEvent } from './data/store.ts';
import { getConfig } from './config.ts';
import { createLogger } from './logger.ts';
import { createStore } from './data/createStore.ts';

// Worker entry. The Hono app handles requests (http → app → data via the context
// middleware). The queue() consumer bulk-inserts batched collector events, so a
// traffic spike becomes a few batched D1 writes instead of one write per hit.
const app = createHttpApp();

export default {
  fetch: app.fetch.bind(app),
  request: app.request.bind(app),
  async queue(batch: MessageBatch<NewEvent>, env: Env): Promise<void> {
    const logger = createLogger(getConfig(env).logLevel, { source: 'queue' });
    const store = createStore(env);
    try {
      await store.insertEvents(batch.messages.map((m) => m.body));
      batch.ackAll();
    } catch (err) {
      logger.error(err, { during: 'queue insert', count: batch.messages.length });
      batch.retryAll(); // idempotent: events INSERT OR IGNORE by id
    }
  },
  // Maintenance cron (every 5 min): aggregate raw → 5m/1h/1d rollups, enforce rollup
  // retention, and prune raw events past the retention window.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const config = getConfig(env);
    const logger = createLogger(config.logLevel, { source: 'cron' });
    const store = createStore(env);
    ctx.waitUntil(
      (async () => {
        try {
          await store.maintainRollups(config.timezone);
          await store.pruneRollups();
          const cutoff = new Date(Date.now() - config.retentionDays * 86_400_000).toISOString();
          const deletedRaw = await store.pruneEventsBefore(cutoff);
          logger.info('maintenance complete', {
            deletedRaw,
            timezone: config.timezone,
            timezoneDst: config.timezoneDst,
          });
        } catch (err) {
          logger.error(err, { during: 'maintenance cron' });
        }
      })(),
    );
  },
};
