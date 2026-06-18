import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../env.ts';
import type { IContext } from '../../context.ts';
import { getConfig } from '../../config.ts';
import { createLogger } from '../../logger.ts';
import { createDb, mainConnectionString } from '../../db/db.ts';

export type Vars = { ctx: IContext };

// Builds the request context (config + per-request logger with a request id + db)
// and tears the db down after the response. Every route reads it via c.get('ctx').
export const contextMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: Vars;
}> = async (c, next) => {
  const config = getConfig(c.env);
  const reqId = crypto.randomUUID();
  const logger = createLogger(config.logLevel, { reqId });
  const db = createDb(mainConnectionString(c.env));

  c.set('ctx', { config, logger, db, auth: null });
  c.header('x-request-id', reqId);

  try {
    await next();
  } finally {
    const closing = db.destroy();
    try {
      c.executionCtx.waitUntil(closing);
    } catch {
      await closing;
    }
  }
};
