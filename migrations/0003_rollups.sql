-- Tiered rollups computed from raw events by the maintenance cron. `grain` is one of
-- '5m' | '1h' | '1d'; `bucket` is the grain-aligned UTC timestamp ('YYYY-MM-DD HH:MM:SS').
-- Retention (enforced by the cron): 5m -> 30d, 1h -> 90d, 1d -> forever. Raw events are
-- the source and stay long enough to (re)aggregate before pruning.
--
-- Counts cover real humans only (is_bot = 0). pageviews/uniques live in rollup_totals;
-- per-dimension pageview breakdowns in rollup_dim; custom (non-pageview) events in
-- rollup_event. Per-bucket `uniques` is exact (the cookieless hash is stable within a
-- day) but is never summed across buckets — the rolling 24h unique still comes from raw.

create table rollup_totals (
  domain_id  text not null,
  grain      text not null,
  bucket     text not null,
  pageviews  integer not null default 0,
  uniques    integer not null default 0,
  primary key (domain_id, grain, bucket)
);

create table rollup_dim (
  domain_id  text not null,
  grain      text not null,
  bucket     text not null,
  dim        text not null, -- 'path' | 'referrer' | 'country' | 'device' | 'browser'
  key        text not null,
  count      integer not null default 0,
  primary key (domain_id, grain, bucket, dim, key)
);

create index rollup_dim_range on rollup_dim (domain_id, grain, dim, bucket);

create table rollup_event (
  domain_id  text not null,
  grain      text not null,
  bucket     text not null,
  name       text not null,
  value      text not null default '',
  count      integer not null default 0,
  primary key (domain_id, grain, bucket, name, value)
);
