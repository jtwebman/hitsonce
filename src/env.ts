import type { NewEvent } from './data/store.ts';

// Bindings, vars, and secrets available to the Worker. Single source of truth for
// the runtime environment; only the http layer reads this directly (to build the
// request context). Everything below reads ctx.config instead.
export interface Env {
  /** Cloudflare D1 (SQLite) — the built-in storage backend. */
  DB: D1Database;
  /** Event ingestion queue. The collector enqueues; the queue() consumer bulk-inserts.
   *  Optional so the collector can fall back to a direct write when it's absent. */
  EVENTS?: Queue<NewEvent>;
  // vars (optional; defaulted in getConfig)
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  /** Comma-separated browser origins allowed by CORS (the dashboard). */
  WEB_ORIGINS?: string;
  /** Public base URL of the dashboard/app. */
  APP_URL?: string;
  /** Cloudflare Access (Zero Trust) team domain, e.g. "myteam.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access application AUD tag. Both must be set to enforce Access. */
  ACCESS_AUD?: string;
}
