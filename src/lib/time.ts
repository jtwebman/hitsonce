// Timezone-aware day boundaries.
//
// Event timestamps (`ts`) are ALWAYS stored in UTC — the database never holds a
// local datetime. The configured timezone only decides *which civil day* a UTC
// instant belongs to, and that drives two things (see config.timezone):
//   1. when the cookieless visitor hash rotates (a new salted hash per civil day), and
//   2. the daily rollup rollover (the "1d" tier buckets by civil day).
//
// DST caveat: for a timezone that observes daylight saving, the two transition days
// are NOT 24h long. On "spring forward" the civil day is 23h; on "fall back" it's
// 25h. That is expected and correct — those two daily buckets will simply cover an
// hour less / an hour more than every other day. Use observesDst() to surface this.

// 'YYYY-MM-DD' — the civil date of `date` in `timeZone` (DST-aware, via Intl). en-CA
// formats dates as YYYY-MM-DD.
export function civilDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Signed offset (ms) of `timeZone` from UTC at `date`, i.e. localWallClock - UTC.
// Derived by reading the wall-clock time in the zone and diffing it against the
// instant — the standard Intl-only way to get a DST-correct offset.
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const f: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') f[p.type] = Number(p.value);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  return asUtc - date.getTime();
}

// The UTC instant at which `date`'s civil day (in `timeZone`) began. This is what the
// daily rollup stores as its bucket — a genuine UTC datetime, so the DB stays UTC.
// Consecutive day starts are 23h/25h apart across a DST transition.
export function dayStartUTC(date: Date, timeZone: string): Date {
  const [y, m, d] = civilDay(date, timeZone).split('-').map(Number);
  // Local midnight read as if it were UTC, then shifted by the zone offset. Correct
  // twice so the offset is taken at the resolved instant (handles DST edges).
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const off1 = offsetMs(new Date(guess), timeZone);
  let inst = guess - off1;
  const off2 = offsetMs(new Date(inst), timeZone);
  if (off2 !== off1) inst = guess - off2;
  return new Date(inst);
}

// Whether `timeZone` observes daylight saving (its offset differs across the year).
export function observesDst(timeZone: string): boolean {
  const jan = offsetMs(new Date(Date.UTC(2025, 0, 1)), timeZone);
  const jul = offsetMs(new Date(Date.UTC(2025, 6, 1)), timeZone);
  return jan !== jul;
}

// Validate an IANA timezone name; returns it if usable, otherwise falls back to 'UTC'
// so a typo can never crash ingestion (it just rolls over at UTC midnight).
export function normalizeTimeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}
