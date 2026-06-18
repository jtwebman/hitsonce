-- HitsOnce schema (D1 / SQLite). Access is gated by Cloudflare Access (an email
-- allowlist in Zero Trust), so there are no user/account tables — every allowed
-- user has full access to all domains. This is the built-in D1 adapter's schema;
-- other Store adapters bring their own.

create table domains (
  id              text primary key,
  hostname        text not null unique,
  collector_path  text not null default '/_stats',
  identity_mode   text not null default 'cookieless' check (identity_mode in ('cookieless', 'cookie')),
  salt            text not null,
  created_at      text not null default (datetime('now'))
);

create table events (
  id             text primary key,
  domain_id      text not null references domains (id) on delete cascade,
  ts             text not null default (datetime('now')),
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
  is_bot         integer not null default 0
);

create index events_domain_ts_idx on events (domain_id, ts);
create index events_domain_visitor_ts_idx on events (domain_id, visitor_hash, ts);
