import type { LogLevel } from './config.ts';

// Structured logger: emits JSON to console, which Cloudflare captures. Leveled
// methods plus addMetadata() for per-request child loggers (e.g. request id).
export interface ILogger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(error: unknown, extra?: Record<string, unknown>): void;
  addMetadata(meta: Record<string, unknown>): ILogger;
}

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(level: LogLevel, base: Record<string, unknown> = {}): ILogger {
  const threshold = RANK[level];

  function emit(lvl: LogLevel, message: string, extra?: Record<string, unknown>) {
    if (RANK[lvl] < threshold) return;
    const line = JSON.stringify({ level: lvl, message, ...base, ...extra });
    if (lvl === 'error') console.error(line);
    else if (lvl === 'warn') console.warn(line);
    else console.log(line);
  }

  return {
    debug: (m, e) => emit('debug', m, e),
    info: (m, e) => emit('info', m, e),
    warn: (m, e) => emit('warn', m, e),
    error: (err, e) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      emit('error', message, { ...e, stack });
    },
    addMetadata: (meta) => createLogger(level, { ...base, ...meta }),
  };
}
