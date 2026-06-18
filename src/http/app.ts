import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../env.ts';
import { getConfig } from '../config.ts';
import { contextMiddleware, type Vars } from './middleware/context.ts';
import { requireAccess } from './middleware/access.ts';
import { renderDashboard } from '../lib/dashboard.ts';
import { health } from './routes/health.ts';
import { collect } from './routes/collect.ts';
import { domainRoutes } from './routes/domains.ts';
import { statsRoutes } from './routes/stats.ts';

// One Worker, two roles by route: the public first-party collector (served on
// tracked zones) and the Cloudflare Access-gated dashboard/API (on the app domain).
// Public: /health, /_stats. Gated: / (dashboard) and /api/*.
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
  // Gate the API. The dashboard route gates itself inline (below). The collector
  // and health stay public.
  app.use('/api/*', requireAccess);

  // Public routes.
  app.route('/', health);
  app.route('/', collect);

  // Gated dashboard (app domain). requireAccess runs before the handler.
  app.get('/', requireAccess, (c) => c.html(renderDashboard(c.get('ctx').auth?.email ?? '')));

  // Gated API routes.
  app.route('/', domainRoutes);
  app.route('/', statsRoutes);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  return app;
}
