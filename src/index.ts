import { createHttpApp } from './http/app.ts';
import type { Env } from './env.ts';
import type { IContext } from './context.ts';
import { getConfig } from './config.ts';
import { createLogger } from './logger.ts';
import { createDb, mainConnectionString } from './db/db.ts';
import { ensureEventsMonth } from './data/events.ts';

// Worker entry. The Hono app handles requests (http → app → data via the context
// middleware). The scheduled() handler is the daily partition-maintenance cron:
// it ensures the current + next month's events partition exist.
const app = createHttpApp();

export default {
  fetch: app.fetch.bind(app),
  request: app.request.bind(app),
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const config = getConfig(env);
    const logger = createLogger(config.logLevel, { source: 'cron' });
    const db = createDb(mainConnectionString(env));
    const sysCtx: IContext = { config, logger, db, auth: null };
    ctx.waitUntil(
      (async () => {
        try {
          const now = new Date();
          const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
          await ensureEventsMonth(sysCtx, now);
          await ensureEventsMonth(sysCtx, nextMonth);
          logger.info('partition maintenance complete');
        } catch (err) {
          logger.error(err, { during: 'scheduled cron' });
        } finally {
          await db.destroy();
        }
      })(),
    );
  },
};
