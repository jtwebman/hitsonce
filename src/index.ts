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
};
