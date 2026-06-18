import type { IConfig } from './config.ts';
import type { ILogger } from './logger.ts';
import type { Store } from './data/store.ts';

// The context threaded as the first argument through every http → app → data
// function. Holds the request-scoped globals: config, logger, and the storage
// handle. (Dashboard auth is handled by Cloudflare Access at the edge, so there's
// no user/session here; a protected route reads the verified email from the
// Cf-Access-Jwt-Assertion header.)
export interface IContext {
  config: IConfig;
  logger: ILogger;
  store: Store;
}
