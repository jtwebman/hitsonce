import { sql } from 'kysely';
import type { IContext } from '../context.ts';

// Cheap liveness ping for the health check.
export async function pingDb(ctx: IContext): Promise<boolean> {
  try {
    await sql`select 1`.execute(ctx.db);
    return true;
  } catch {
    return false;
  }
}
