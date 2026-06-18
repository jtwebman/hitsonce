import type { Env } from './env.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Runtime configuration, derived from the Worker's bindings/vars. Lives on the
// context so every layer reads config the same way (no direct env access below
// the http layer).
export interface IConfig {
  environment: string;
  logLevel: LogLevel;
  /** Whether the Hyperdrive (Postgres) binding is present. */
  dbConfigured: boolean;
  /** Browser origins allowed by CORS (the dashboard, localhost in dev). */
  webOrigins: string[];
  /** Public base URL of the dashboard/app. */
  appUrl: string;
  /** HS256 secret for signing session JWTs. */
  jwtSecret: string;
  /** Google OAuth client credentials (undefined until configured). */
  google: { clientId: string | undefined; clientSecret: string | undefined };
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function getConfig(env: Env): IConfig {
  const level = (env.LOG_LEVEL ?? '').toLowerCase();
  return {
    environment: env.ENVIRONMENT ?? 'development',
    logLevel: LEVELS.includes(level as LogLevel) ? (level as LogLevel) : 'info',
    dbConfigured: Boolean(env.HYPERDRIVE),
    webOrigins: (env.WEB_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    appUrl: env.APP_URL ?? 'https://hitsonce.app',
    // Dev/test default — deployed envs MUST set JWT_SECRET (wrangler secret put).
    jwtSecret: env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  };
}
