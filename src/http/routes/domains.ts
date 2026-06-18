import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../env.ts';
import type { Vars } from '../middleware/context.ts';
import { requireAccess } from '../middleware/access.ts';
import { addDomain, listDomains, removeDomain } from '../../app/domains.ts';

export const domainRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
domainRoutes.use('*', requireAccess);

domainRoutes.get('/api/domains', async (c) => {
  return c.json({ domains: await listDomains(c.get('ctx')) });
});

const createSchema = z.object({
  hostname: z.string().min(1).max(253),
  collectorPath: z.string().min(1).max(128).optional(),
  identityMode: z.enum(['cookieless', 'cookie']).optional(),
});

domainRoutes.post('/api/domains', zValidator('json', createSchema), async (c) => {
  const domain = await addDomain(c.get('ctx'), c.req.valid('json'));
  return c.json({ domain }, 201);
});

domainRoutes.delete('/api/domains/:id', async (c) => {
  await removeDomain(c.get('ctx'), c.req.param('id'));
  return c.body(null, 204);
});
