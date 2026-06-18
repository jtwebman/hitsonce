import type { Generated } from 'kysely';

// The typed database Kysely is generic over. Kept in sync with migrations/ by hand.
// `Generated<T>` marks columns the DB fills in (defaults), so inserts can omit them.

export interface AccountsTable {
  id: Generated<string>;
  name: string;
  plan: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string | null;
  avatar_url: string | null;
  google_sub: string | null;
  active_account_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MembershipsTable {
  id: Generated<string>;
  user_id: string;
  account_id: string;
  role: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface DomainsTable {
  id: Generated<string>;
  account_id: string;
  hostname: string;
  collector_path: Generated<string>;
  identity_mode: Generated<string>;
  salt: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface EventsTable {
  id: Generated<string>;
  domain_id: string;
  ts: Generated<Date>;
  visitor_hash: string;
  name: Generated<string>;
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
  is_bot: Generated<boolean>;
}

export interface Database {
  accounts: AccountsTable;
  users: UsersTable;
  memberships: MembershipsTable;
  domains: DomainsTable;
  events: EventsTable;
}
