import { beforeEach, describe, expect, it } from 'vitest';
import { bucketOf, daysAgo, insertRaw, makeStore, minutesAgo } from './helpers.ts';
import { dayStartUTC } from '../src/lib/time.ts';

// Convert a Date to the 'YYYY-MM-DD HH:MM:SS' UTC form the adapter stores buckets in.
const toBucket = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
// Parse a 'YYYY-MM-DD HH:MM:SS' (UTC) test timestamp back into a Date.
const parseTs = (ts) => new Date(ts.replace(' ', 'T') + 'Z');

const FIVE_MIN = 300;
const HOUR = 3600;
const DAY = 86_400;

describe('maintainRollups', () => {
  let db;
  let store;

  beforeEach(() => {
    ({ db, store } = makeStore());
  });

  // Read a single rollup_totals row by grain + bucket.
  const totalsAt = (grain, bucket) =>
    db
      .prepare('select pageviews, uniques from rollup_totals where grain = ? and bucket = ?')
      .get(grain, bucket);

  const sumTotals = (grain) =>
    db
      .prepare(
        'select coalesce(sum(pageviews), 0) as pv, count(*) as buckets from rollup_totals where grain = ?',
      )
      .get(grain);

  const dimCounts = (grain, bucket, dim) => {
    const rows = db
      .prepare(
        'select key, count from rollup_dim where grain = ? and bucket = ? and dim = ? order by key',
      )
      .all(grain, bucket, dim);
    return Object.fromEntries(rows.map((r) => [r.key, r.count]));
  };

  const eventCounts = (grain, bucket) => {
    const rows = db
      .prepare('select name, value, count from rollup_event where grain = ? and bucket = ?')
      .all(grain, bucket);
    return Object.fromEntries(rows.map((r) => [`${r.name}:${r.value}`, r.count]));
  };

  it('aggregates pageviews and per-bucket unique visitors into 5m buckets', async () => {
    const tA = minutesAgo(20);
    const tB = minutesAgo(48);
    // Same 5m bucket: 3 pageviews from 2 distinct visitors.
    insertRaw(db, { id: 'a1', ts: tA, visitor_hash: 'v1' });
    insertRaw(db, { id: 'a2', ts: tA, visitor_hash: 'v1' });
    insertRaw(db, { id: 'a3', ts: tA, visitor_hash: 'v2' });
    // A different 5m bucket: 1 pageview from 1 visitor.
    insertRaw(db, { id: 'b1', ts: tB, visitor_hash: 'v3' });

    await store.maintainRollups('UTC');

    expect(totalsAt('5m', bucketOf(tA, FIVE_MIN))).toEqual({ pageviews: 3, uniques: 2 });
    expect(totalsAt('5m', bucketOf(tB, FIVE_MIN))).toEqual({ pageviews: 1, uniques: 1 });
    expect(sumTotals('5m').buckets).toBe(2);
  });

  it('breaks pageviews down by dimension (path, country, device, browser, referrer)', async () => {
    const t = minutesAgo(15);
    const bucket = bucketOf(t, FIVE_MIN);
    insertRaw(db, {
      id: 'd1',
      ts: t,
      visitor_hash: 'v1',
      path: '/a',
      country: 'US',
      device: 'desktop',
      browser: 'Chrome',
      referrer_host: 'google.com',
    });
    insertRaw(db, {
      id: 'd2',
      ts: t,
      visitor_hash: 'v2',
      path: '/a',
      country: 'US',
      device: 'mobile',
      browser: 'Chrome',
      referrer_host: 'google.com',
    });
    insertRaw(db, {
      id: 'd3',
      ts: t,
      visitor_hash: 'v3',
      path: '/b',
      country: 'CA',
      device: 'desktop',
      browser: 'Firefox',
      referrer_host: null,
    });

    await store.maintainRollups('UTC');

    expect(dimCounts('5m', bucket, 'path')).toEqual({ '/a': 2, '/b': 1 });
    expect(dimCounts('5m', bucket, 'country')).toEqual({ US: 2, CA: 1 });
    expect(dimCounts('5m', bucket, 'device')).toEqual({ desktop: 2, mobile: 1 });
    expect(dimCounts('5m', bucket, 'browser')).toEqual({ Chrome: 2, Firefox: 1 });
    // The null referrer is excluded — only the two google.com hits count.
    expect(dimCounts('5m', bucket, 'referrer')).toEqual({ 'google.com': 2 });
  });

  it('tallies custom events by name + value, separately from pageviews', async () => {
    const t = minutesAgo(12);
    const bucket = bucketOf(t, FIVE_MIN);
    insertRaw(db, { id: 'p1', ts: t, visitor_hash: 'v1' }); // pageview
    insertRaw(db, { id: 'e1', ts: t, visitor_hash: 'v1', name: 'timer_start', value: '45' });
    insertRaw(db, { id: 'e2', ts: t, visitor_hash: 'v2', name: 'timer_start', value: '45' });
    insertRaw(db, { id: 'e3', ts: t, visitor_hash: 'v3', name: 'timer_start', value: '30' });
    insertRaw(db, { id: 'e4', ts: t, visitor_hash: 'v4', name: 'breath_cycle', value: 'box' });

    await store.maintainRollups('UTC');

    // Custom events do not inflate the pageview total.
    expect(totalsAt('5m', bucket)).toEqual({ pageviews: 1, uniques: 1 });
    expect(eventCounts('5m', bucket)).toEqual({
      'timer_start:45': 2,
      'timer_start:30': 1,
      'breath_cycle:box': 1,
    });
  });

  it('excludes bot traffic from totals, dimensions, and events', async () => {
    const t = minutesAgo(10);
    const bucket = bucketOf(t, FIVE_MIN);
    insertRaw(db, { id: 'h1', ts: t, visitor_hash: 'human', path: '/x', is_bot: 0 });
    insertRaw(db, { id: 'b1', ts: t, visitor_hash: 'bot', path: '/x', is_bot: 1 });
    insertRaw(db, {
      id: 'b2',
      ts: t,
      visitor_hash: 'bot',
      name: 'timer_start',
      value: '5',
      is_bot: 1,
    });

    await store.maintainRollups('UTC');

    expect(totalsAt('5m', bucket)).toEqual({ pageviews: 1, uniques: 1 });
    expect(dimCounts('5m', bucket, 'path')).toEqual({ '/x': 1 });
    expect(eventCounts('5m', bucket)).toEqual({});
  });

  it('is idempotent — re-running does not double-count an already-rolled bucket', async () => {
    const t = minutesAgo(25);
    const bucket = bucketOf(t, FIVE_MIN);
    insertRaw(db, { id: 'i1', ts: t, visitor_hash: 'v1', path: '/a' });
    insertRaw(db, { id: 'i2', ts: t, visitor_hash: 'v2', path: '/a' });

    await store.maintainRollups('UTC');
    await store.maintainRollups('UTC');
    await store.maintainRollups('UTC');

    expect(totalsAt('5m', bucket)).toEqual({ pageviews: 2, uniques: 2 });
    expect(dimCounts('5m', bucket, 'path')).toEqual({ '/a': 2 });
    expect(sumTotals('5m').buckets).toBe(1);
  });

  it('picks up late-arriving events within the re-roll window on a later run', async () => {
    const t = minutesAgo(30);
    const bucket = bucketOf(t, FIVE_MIN);
    insertRaw(db, { id: 'l1', ts: t, visitor_hash: 'v1' });
    await store.maintainRollups('UTC');
    expect(totalsAt('5m', bucket)).toEqual({ pageviews: 1, uniques: 1 });

    // A delayed/queued event for the same bucket lands after the first roll.
    insertRaw(db, { id: 'l2', ts: t, visitor_hash: 'v2' });
    await store.maintainRollups('UTC');
    expect(totalsAt('5m', bucket)).toEqual({ pageviews: 2, uniques: 2 });
  });

  it('writes the 1h and 1d tiers alongside 5m, each with correct totals', async () => {
    // One shared timestamp: every grain then has a single bucket holding all three
    // hits, so the assertions can't straddle a 5m / hour / day boundary.
    const t = minutesAgo(20);
    insertRaw(db, { id: 'g1', ts: t, visitor_hash: 'v1' });
    insertRaw(db, { id: 'g2', ts: t, visitor_hash: 'v2' });
    insertRaw(db, { id: 'g3', ts: t, visitor_hash: 'v1' });

    await store.maintainRollups('UTC');

    // 3 pageviews from 2 distinct visitors, rolled identically into all three tiers.
    expect(totalsAt('5m', bucketOf(t, FIVE_MIN))).toEqual({ pageviews: 3, uniques: 2 });
    expect(totalsAt('1h', bucketOf(t, HOUR))).toEqual({ pageviews: 3, uniques: 2 });
    expect(totalsAt('1d', bucketOf(t, DAY))).toEqual({ pageviews: 3, uniques: 2 });
  });

  it('leaves rollups empty when there are no qualifying events', async () => {
    insertRaw(db, { id: 'only-bot', ts: minutesAgo(5), visitor_hash: 'bot', is_bot: 1 });
    await store.maintainRollups('UTC');
    expect(sumTotals('5m')).toEqual({ pv: 0, buckets: 0 });
  });

  it('buckets the daily tier by the configured timezone civil day, not UTC', async () => {
    const tz = 'America/Los_Angeles';
    const t = minutesAgo(90);
    insertRaw(db, { id: 'tz1', ts: t, visitor_hash: 'v1' });
    insertRaw(db, { id: 'tz2', ts: t, visitor_hash: 'v2' });

    await store.maintainRollups(tz);

    // The daily bucket is the UTC instant Pacific midnight began — a real UTC datetime
    // that is offset from (never equal to) a naive UTC-midnight rollover.
    const expected = toBucket(dayStartUTC(parseTs(t), tz));
    expect(totalsAt('1d', expected)).toEqual({ pageviews: 2, uniques: 2 });
    expect(expected).not.toBe(bucketOf(t, DAY));
    // The 5m/1h tiers stay UTC-aligned regardless of the configured timezone.
    expect(totalsAt('5m', bucketOf(t, FIVE_MIN))).toEqual({ pageviews: 2, uniques: 2 });
  });
});

describe('pruneRollups', () => {
  let db;
  let store;

  beforeEach(() => {
    ({ db, store } = makeStore());
  });

  const insertTotal = (grain, bucket) =>
    db
      .prepare(
        'insert into rollup_totals (domain_id, grain, bucket, pageviews, uniques) values (?, ?, ?, 1, 1)',
      )
      .run('dom1', grain, bucket);

  const grainBuckets = (grain) =>
    db
      .prepare('select bucket from rollup_totals where grain = ? order by bucket')
      .all(grain)
      .map((r) => r.bucket);

  it('keeps 5m for 30d, 1h for 90d, and 1d forever', async () => {
    const old5m = daysAgo(40);
    const keep5m = daysAgo(10);
    const old1h = daysAgo(100);
    const keep1h = daysAgo(50);
    const ancient1d = daysAgo(400);

    insertTotal('5m', old5m);
    insertTotal('5m', keep5m);
    insertTotal('1h', old1h);
    insertTotal('1h', keep1h);
    insertTotal('1d', ancient1d);

    await store.pruneRollups();

    expect(grainBuckets('5m')).toEqual([keep5m]);
    expect(grainBuckets('1h')).toEqual([keep1h]);
    expect(grainBuckets('1d')).toEqual([ancient1d]);
  });
});
