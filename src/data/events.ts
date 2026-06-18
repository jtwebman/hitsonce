import { sql } from 'kysely';
import type { IContext } from '../context.ts';

// The insertable shape of an event (DB-defaulted columns omitted: id, ts).
export interface NewEvent {
  domain_id: string;
  visitor_hash: string;
  name: string;
  path: string | null;
  referrer_host: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  language: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  screen_w: number | null;
  screen_h: number | null;
  is_bot: boolean;
}

export async function insertEvent(ctx: IContext, event: NewEvent): Promise<void> {
  await ctx.db.insertInto('events').values(event).execute();
}

// Ensure the month partition that `month` falls in exists (idempotent).
export async function ensureEventsMonth(ctx: IContext, month: Date): Promise<void> {
  await sql`select create_events_month(${month}::date)`.execute(ctx.db);
}
