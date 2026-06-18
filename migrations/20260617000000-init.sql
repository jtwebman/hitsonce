-- init: accounts, users (Google auth), memberships, domains, events. PostgreSQL.
-- A user can belong to many accounts (per-account role); domains belong to an
-- account; events belong to a domain and are range-partitioned by month.

create extension if not exists citext;

create table accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table users (
  id                 uuid primary key default gen_random_uuid(),
  email              citext unique not null,
  name               text,
  avatar_url         text,
  google_sub         text unique,                 -- Google OIDC subject
  active_account_id  uuid references accounts (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- A user can belong to many accounts, with a role per account.
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  account_id  uuid not null references accounts (id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, account_id)
);

create index memberships_account_idx on memberships (account_id);

-- A tracked site. The collector path is first-party and configurable; salt is a
-- per-domain secret mixed into the cookieless daily visitor hash.
create table domains (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts (id) on delete cascade,
  hostname        text not null unique,
  collector_path  text not null default '/_stats',
  identity_mode   text not null default 'cookieless' check (identity_mode in ('cookieless', 'cookie')),
  salt            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index domains_account_idx on domains (account_id);

-- Events (pageviews etc.), range-partitioned by month on ts. The partition key
-- must be part of the primary key, hence (id, ts). A DEFAULT partition catches
-- rows whose month partition is missing so inserts never fail; the daily cron
-- (create_events_month) pre-creates the current + next month.
create table events (
  id             uuid not null default gen_random_uuid(),
  domain_id      uuid not null references domains (id) on delete cascade,
  ts             timestamptz not null default now(),
  visitor_hash   text not null,
  name           text not null default 'pageview',
  path           text,
  referrer_host  text,
  country        text,
  region         text,
  city           text,
  timezone       text,
  language       text,
  browser        text,
  os             text,
  device         text,             -- 'mobile' | 'tablet' | 'desktop'
  screen_w       integer,
  screen_h       integer,
  is_bot         boolean not null default false,
  primary key (id, ts)
) partition by range (ts);

create table events_default partition of events default;

create index events_domain_ts_idx on events (domain_id, ts desc);
create index events_domain_visitor_ts_idx on events (domain_id, visitor_hash, ts);

-- Create a month partition, e.g. select create_events_month('2026-06-01').
create or replace function create_events_month(p_month date)
returns void language plpgsql as $$
declare
  start_date date := date_trunc('month', p_month)::date;
  end_date   date := (date_trunc('month', p_month) + interval '1 month')::date;
  part_name  text := 'events_' || to_char(start_date, 'YYYY_MM');
begin
  execute format(
    'create table if not exists %I partition of events for values from (%L) to (%L)',
    part_name, start_date, end_date
  );
end;
$$;

select create_events_month(now()::date);
select create_events_month((now() + interval '1 month')::date);
