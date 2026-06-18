import type { IContext } from '../context.ts';
import type { Domain, IdentityMode } from '../data/store.ts';

// Per-domain secret mixed into the cookieless visitor hash. 16 random bytes hex.
function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function listDomains(ctx: IContext): Promise<Domain[]> {
  return ctx.store.listDomains();
}

export function addDomain(
  ctx: IContext,
  input: { hostname: string; collectorPath?: string; identityMode?: IdentityMode },
): Promise<Domain> {
  return ctx.store.createDomain({
    hostname: input.hostname.trim().toLowerCase(),
    collectorPath: input.collectorPath,
    identityMode: input.identityMode,
    salt: generateSalt(),
  });
}

export function removeDomain(ctx: IContext, id: string): Promise<void> {
  return ctx.store.deleteDomain(id);
}
