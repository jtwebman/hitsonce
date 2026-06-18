import { Hono } from 'hono';
import type { Env } from '../../env.ts';
import type { Vars } from '../middleware/context.ts';
import { getStats } from '../../app/stats.ts';

// Access is enforced by app.use('/api/*', requireAccess) in http/app.ts.
export const statsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

statsRoutes.get('/api/stats', async (c) => {
  const domainId = c.req.query('domain');
  if (!domainId) return c.json({ error: 'domain required' }, 400);
  const stats = await getStats(c.get('ctx'), {
    domainId,
    from: c.req.query('from'),
    to: c.req.query('to'),
    includeBots: c.req.query('bots') === '1',
  });
  return c.json(stats);
});
