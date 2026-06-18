import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../env.ts';
import type { Vars } from './context.ts';
import { verifyAccess } from '../../lib/access.ts';

// Gates dashboard/API routes. Cloudflare Access authenticates at the edge and
// passes a signed JWT; we verify it (defense in depth) and put the email on
// ctx.auth. When Access isn't configured (local dev), allow and use a best-effort
// dev email so the dashboard works without standing up Zero Trust.
export const requireAccess: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (
  c,
  next,
) => {
  const ctx = c.get('ctx');
  const { teamDomain, aud } = ctx.config.access;

  if (!teamDomain || !aud) {
    const devEmail = c.req.header('Cf-Access-Authenticated-User-Email') ?? 'dev@localhost';
    ctx.auth = { email: devEmail };
    return next();
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) return c.json({ error: 'unauthenticated' }, 401);
  try {
    ctx.auth = { email: await verifyAccess(token, teamDomain, aud) };
  } catch {
    return c.json({ error: 'unauthenticated' }, 401);
  }
  return next();
};
