import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../env.ts';
import { getConfig } from '../config.ts';
import { contextMiddleware, type Vars } from './middleware/context.ts';
import { health } from './routes/health.ts';
import { collect } from './routes/collect.ts';

// One Worker, two roles: the first-party collector (served on tracked zones) and
// the dashboard/API (on the app domain). CORS is for the dashboard; the collector
// is same-origin. Auth middleware + account/domain/stats routes arrive next.
export function createHttpApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>();

  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const allowed = getConfig(c.env).webOrigins;
        return allowed.includes(origin) ? origin : null;
      },
      credentials: true,
    }),
  );

  app.use('*', contextMiddleware);

  app.get('/', (c) => c.json({ service: 'hitsonce' }));
  app.route('/', health);
  app.route('/', collect);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  return app;
}
