import type { IConfig } from './config.ts';
import type { ILogger } from './logger.ts';
import type { Store } from './data/store.ts';

// The authenticated user, resolved by the requireAccess middleware from the
// Cloudflare Access JWT. Single shared account, so the email is all we need.
export interface AuthState {
  email: string;
}

// The context threaded as the first argument through every http → app → data
// function. Holds the request-scoped globals: config, logger, the storage handle,
// and (on Access-gated routes) the authenticated user.
export interface IContext {
  config: IConfig;
  logger: ILogger;
  store: Store;
  auth: AuthState | null;
}
