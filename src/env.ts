// Bindings, vars, and secrets available to the Worker. Single source of truth for
// the runtime environment; only the http layer reads this directly (to build the
// request context). Everything below reads ctx.config instead.
export interface Env {
  HYPERDRIVE: Hyperdrive;
  // vars (optional; defaulted in getConfig)
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  /** Comma-separated browser origins allowed by CORS (the dashboard). */
  WEB_ORIGINS?: string;
  /** Public base URL of the dashboard/app (used for OAuth redirects). */
  APP_URL?: string;
  // secrets
  /** HS256 signing secret for session JWTs. */
  JWT_SECRET?: string;
  /** Google OAuth client credentials (dashboard login). */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
