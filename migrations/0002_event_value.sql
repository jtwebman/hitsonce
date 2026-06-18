-- Optional value for custom events (e.g. the minutes a timer was set to). Additive
-- and nullable, so it's backward-compatible with existing rows.
alter table events add column value text;
