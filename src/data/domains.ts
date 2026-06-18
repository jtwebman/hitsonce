import type { IContext } from '../context.ts';

export interface Domain {
  id: string;
  account_id: string;
  hostname: string;
  collector_path: string;
  identity_mode: string;
  salt: string;
}

const COLUMNS = [
  'id',
  'account_id',
  'hostname',
  'collector_path',
  'identity_mode',
  'salt',
] as const;

export async function getDomainByHost(ctx: IContext, hostname: string): Promise<Domain | null> {
  const row = await ctx.db
    .selectFrom('domains')
    .select(COLUMNS)
    .where('hostname', '=', hostname)
    .executeTakeFirst();
  return row ?? null;
}
