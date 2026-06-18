import type { IConfig } from './config.ts';
import type { ILogger } from './logger.ts';
import type { Db } from './db/db.ts';

// The signed-in user, their active account, and their membership in it, resolved by
// the auth middleware. account/membership are null until the user creates or joins one.
export interface AuthState {
  user: { id: string; email: string; name: string | null };
  account: { id: string; name: string } | null;
  membership: { id: string; role: string } | null;
}

// The context threaded as the first argument through every http → app → data
// function. Holds the request-scoped globals: config, logger, db, and (once the
// auth middleware runs) the authenticated user.
export interface IContext {
  config: IConfig;
  logger: ILogger;
  db: Db;
  auth: AuthState | null;
}
