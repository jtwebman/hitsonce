import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../env.ts';
import type { IContext } from '../../context.ts';
import { getConfig } from '../../config.ts';
import { createLogger } from '../../logger.ts';
import { createStore } from '../../data/createStore.ts';

export type Vars = { ctx: IContext };

// Builds the request context (config + per-request logger with a request id + the
// storage handle). Every route reads it via c.get('ctx'). D1 is stateless, so
// there's no connection to tear down.
export const contextMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: Vars;
}> = async (c, next) => {
  const config = getConfig(c.env);
  const reqId = crypto.randomUUID();
  const logger = createLogger(config.logLevel, { reqId });
  const store = createStore(c.env);

  c.set('ctx', { config, logger, store, auth: null });
  c.header('x-request-id', reqId);

  await next();
};
