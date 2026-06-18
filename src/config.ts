import type { Env } from './env.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Runtime configuration, derived from the Worker's bindings/vars. Lives on the
// context so every layer reads config the same way (no direct env access below
// the http layer).
export interface IConfig {
  environment: string;
  logLevel: LogLevel;
  /** Whether the storage binding (D1) is present. */
  storeConfigured: boolean;
  /** Browser origins allowed by CORS (the dashboard, localhost in dev). */
  webOrigins: string[];
  /** Public base URL of the dashboard/app. */
  appUrl: string;
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function getConfig(env: Env): IConfig {
  const level = (env.LOG_LEVEL ?? '').toLowerCase();
  return {
    environment: env.ENVIRONMENT ?? 'development',
    logLevel: LEVELS.includes(level as LogLevel) ? (level as LogLevel) : 'info',
    storeConfigured: Boolean(env.DB),
    webOrigins: (env.WEB_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    appUrl: env.APP_URL ?? 'https://hitsonce.app',
  };
}
